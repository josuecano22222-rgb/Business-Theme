import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.permissions import is_system_user
from frappe.utils import cint

from business_theme.theme import SIDEBARS, compile_theme, json_object, normalize_theme

DOCTYPE = "Workspace Theme"
CACHE_KEY = "business_theme:active:v1"
PRESENTATION_FIELDS = (
	"primary_color",
	"sidebar_style",
	"sidebar_density",
	"sidebar_tint",
	"custom_css",
	"settings_json",
)


class WorkspaceTheme(Document):
	def validate(self):
		values = normalize_theme(self.as_dict())
		values["settings_json"] = json.dumps(values["settings_json"], indent=2)
		self.update(values)

		# NULL for any number of drafts, one unique slot for the site default. The
		# DB constraint also arbitrates concurrent promotions on an empty table.
		self.default_slot = "active" if cint(self.is_default) else None
		if self.default_slot:
			frappe.db.set_value(
				DOCTYPE, {"is_default": 1, "name": ("!=", self.name)}, {"is_default": 0, "default_slot": None}
			)

	def on_update(self):
		frappe.db.after_commit.add(invalidate_theme)

	def on_trash(self):
		frappe.db.after_commit.add(invalidate_theme)


def invalidate_theme():
	# bootinfo is v15's site-prefixed hash of per-user Desk boot caches, NOT login sessions.
	frappe.cache().delete_key([CACHE_KEY, "bootinfo"])
	frappe.publish_realtime("business_theme_changed")


def _active_theme():
	row = frappe.db.get_value(
		DOCTYPE, {"is_default": 1}, ["name", "modified", *PRESENTATION_FIELDS], as_dict=True, order_by=None
	)
	# Tag the compiled result with its DB revision. A slow reader cannot repopulate
	# Redis with an old default that will be used after another transaction commits.
	revision = (row.name, row.modified) if row else None
	cached = frappe.cache().get_value(CACHE_KEY)
	if cached and cached[0] == revision:
		return cached[1]
	payload = compile_theme(row or {})
	frappe.cache().set_value(CACHE_KEY, (revision, payload))
	return payload


@frappe.whitelist(methods=["GET", "POST"])
def get_active_theme():
	"""Desk users receive presentation data, not read access to the configuration DocType."""
	if not is_system_user():
		frappe.throw(_("Desk access is required to load a workspace theme."), frappe.PermissionError)
	return _active_theme()


@frappe.whitelist(methods=["POST"])
def compile_theme_preview(theme: str | dict):
	"""Compile an unsaved draft. No document hooks, writes or shared cache entries."""
	frappe.has_permission(DOCTYPE, "write", throw=True)
	return compile_theme(json_object(theme, _("Theme preview settings must be a JSON object.")))


def extend_bootinfo(bootinfo):
	"""Called by frappe.sessions.get, including on warm per-user boots."""
	if is_system_user():
		bootinfo["business_theme"] = {"active": _active_theme(), "sidebars": SIDEBARS}

# Workspace Theme · implementation handoff

**Target: Frappe v15.126.1.** Place the three files below together in `apps/business_theme/business_theme/business_theme/doctype/workspace_theme/`. They are standard app files, not scripts to paste into Customize Form.

**Architecture.** The controller passes stored and unsaved settings through the same [validator and CSS compiler](../business_theme/theme.py). The [Desk boot hook](../business_theme/hooks.py) delivers the active presentation to the [Desk runtime](../business_theme/public/js/business_theme.bundle.js); the runtime sets logical direction, style tokens and a scoped stylesheet. The [Desk CSS bundle](../business_theme/public/css/business_theme.bundle.css) consumes those tokens. Frappe discovers the form script by filename, builds hashed assets for both directions, and resolves labels using the [Arabic catalog](../business_theme/translations/ar.csv).

**Install.** Register this checkout with Bench, run `bench --site SITE install-app business_theme`, `bench --site SITE migrate`, and `bench build --apps business_theme`. Clear the site cache, restart production workers and reload Desk. Open `/app/workspace-theme` as a System Manager. Preview an unsaved record or save it as the default. See the [installation commands, full directory tree, CSS allowlist and JSON contract](../README.md).

## A. DocType schema

[`workspace_theme.json`](../business_theme/business_theme/doctype/workspace_theme/workspace_theme.json)

```json
{
  "doctype": "DocType",
  "name": "Workspace Theme",
  "module": "Business Theme",
  "autoname": "field:theme_name",
  "naming_rule": "By fieldname",
  "engine": "InnoDB",
  "creation": "2026-11-18 00:00:00.000000",
  "modified": "2026-11-18 00:00:00.000000",
  "sort_field": "modified",
  "sort_order": "DESC",
  "track_changes": 1,
  "field_order": [
    "identity_section", "theme_name", "is_default", "default_slot", "palette_column", "primary_color",
    "sidebar_section", "sidebar_style", "sidebar_column", "sidebar_density", "sidebar_tint",
    "advanced_section", "settings_json", "custom_css"
  ],
  "fields": [
    {
      "fieldname": "identity_section",
      "fieldtype": "Section Break",
      "label": "Theme Identity"
    },
    {
      "fieldname": "theme_name",
      "fieldtype": "Data",
      "label": "Theme Name",
      "reqd": 1,
      "unique": 1,
      "set_only_once": 1,
      "in_list_view": 1
    },
    {
      "fieldname": "is_default",
      "fieldtype": "Check",
      "label": "Default Desk Theme",
      "description": "Use this theme for everyone in Desk. This replaces the previous default.",
      "default": "0",
      "search_index": 1,
      "in_list_view": 1
    },
    {
      "fieldname": "default_slot",
      "fieldtype": "Data",
      "label": "Default Theme Slot",
      "hidden": 1,
      "read_only": 1,
      "no_copy": 1,
      "unique": 1
    },
    { "fieldname": "palette_column", "fieldtype": "Column Break" },
    {
      "fieldname": "primary_color",
      "fieldtype": "Color",
      "label": "Primary Color",
      "default": "#176b68",
      "reqd": 1
    },
    {
      "fieldname": "sidebar_section",
      "fieldtype": "Section Break",
      "label": "Workspace Sidebar"
    },
    {
      "fieldname": "sidebar_style",
      "fieldtype": "Select",
      "label": "Sidebar Style",
      "options": "Minimal\nGlassmorphism\nFloating\nExpanded",
      "default": "Minimal",
      "reqd": 1,
      "in_list_view": 1
    },
    { "fieldname": "sidebar_column", "fieldtype": "Column Break" },
    {
      "fieldname": "sidebar_density",
      "fieldtype": "Select",
      "label": "Sidebar Density",
      "options": "Comfortable\nCompact\nSpacious",
      "default": "Comfortable",
      "reqd": 1
    },
    {
      "fieldname": "sidebar_tint",
      "fieldtype": "Color",
      "label": "Sidebar Tint",
      "description": "Leave blank to use the primary color."
    },
    {
      "fieldname": "advanced_section",
      "fieldtype": "Section Break",
      "label": "Advanced Styling",
      "collapsible": 1
    },
    {
      "fieldname": "settings_json",
      "fieldtype": "JSON",
      "label": "Widget and Dashboard Settings",
      "description": "Optional pixel values: widget_radius (0–32), widget_padding (4–32), dashboard_gap (4–32)."
    },
    {
      "fieldname": "custom_css",
      "fieldtype": "Code",
      "label": "Custom CSS",
      "options": "CSS",
      "description": "Use component rules such as .widget { border-radius: 12px; }. URLs and at-rules are not allowed."
    }
  ],
  "permissions": [
    { "role": "System Manager", "read": 1, "create": 1, "write": 1, "delete": 1, "report": 1 }
  ],
  "actions": [],
  "links": [],
  "states": []
}
```

## B. Document controller and Desk APIs

[`workspace_theme.py`](../business_theme/business_theme/doctype/workspace_theme/workspace_theme.py)

```python
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
```

## C. Form controller

[`workspace_theme.js`](../business_theme/business_theme/doctype/workspace_theme/workspace_theme.js)

```javascript
frappe.ui.form.on("Workspace Theme", {
	refresh(frm) {
		frappe.business_theme.sync_locale();
		frm.trigger("sidebar_style");
		frm.add_custom_button(__("Preview Theme"), () => {
			const { primary_color, sidebar_style, sidebar_density, sidebar_tint } = frm.doc;
			// Ace updates the model on a debounce. Include the latest editor keystroke.
			const editor_value = (field) =>
				frm.fields_dict[field].editor?.getValue() ?? frm.doc[field];
			return frappe.business_theme.preview({
				primary_color,
				sidebar_style,
				sidebar_density,
				sidebar_tint,
				custom_css: editor_value("custom_css"),
				settings_json: editor_value("settings_json"),
			});
		});
	},

	sidebar_style(frm) {
		const options = frappe.boot.business_theme.sidebars[frm.doc.sidebar_style];
		if (!options) return;
		frm.toggle_display("sidebar_tint", options.tinted);
		frm.set_df_property("sidebar_density", "options", options.densities.join("\n"));
		if (!options.densities.includes(frm.doc.sidebar_density)) {
			return frm.set_value("sidebar_density", options.densities[0]);
		}
	},

	after_save() {
		frappe.business_theme.end_preview();
		return frappe.business_theme.refresh_active();
	},
});
```

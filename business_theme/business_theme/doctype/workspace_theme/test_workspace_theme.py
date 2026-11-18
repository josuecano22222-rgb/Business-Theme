import json

import frappe
from frappe.tests.utils import FrappeTestCase

from business_theme.theme import DEFAULT_PRIMARY, SIDEBARS, compile_theme

from .workspace_theme import CACHE_KEY, DOCTYPE, compile_theme_preview, extend_bootinfo, get_active_theme


class TestWorkspaceTheme(FrappeTestCase):
	def setUp(self):
		self.addCleanup(frappe.db.rollback)
		self.addCleanup(frappe.cache().delete_key, CACHE_KEY)

	def new_theme(self, **values):
		return frappe.get_doc({"doctype": DOCTYPE, "theme_name": frappe.generate_hash(length=12), **values})

	def test_default_replacement_and_fallback(self):
		first = self.new_theme(is_default=1, primary_color="#ABCDEF").insert()
		self.assertEqual(first.name, first.theme_name)
		self.assertEqual(get_active_theme()["variables"]["--bt-primary"], "#abcdef")
		second = self.new_theme(is_default=1, primary_color="#123456").insert()
		self.assertEqual(frappe.db.get_value(DOCTYPE, first.name, "is_default"), 0)
		self.assertIsNone(frappe.db.get_value(DOCTYPE, first.name, "default_slot"))
		self.assertEqual(frappe.db.count(DOCTYPE, {"is_default": 1}), 1)
		self.assertEqual(get_active_theme()["variables"]["--bt-primary"], "#123456")
		second.is_default = 0
		second.save()
		self.assertEqual(get_active_theme(), compile_theme({}))
		second.is_default = 1
		second.save()
		second.delete()
		self.assertEqual(get_active_theme()["variables"]["--bt-primary"], DEFAULT_PRIMARY)

	def test_default_slot_is_unique_but_drafts_are_not(self):
		self.new_theme().insert()
		self.new_theme().insert()
		active = self.new_theme(is_default=1).insert()
		# Exercise the actual DB constraint, independently of the promotion hook.
		conflict = self.new_theme(is_default=1, default_slot=active.default_slot)
		conflict.name = conflict.theme_name
		with self.assertRaises(frappe.UniqueValidationError):
			conflict.db_insert()

	def test_boot_preview_and_save_share_a_compiler(self):
		base = self.new_theme(is_default=1).insert()
		original = get_active_theme()
		draft = {
			"primary_color": "#FAFAFA",
			"sidebar_style": "Floating",
			"sidebar_density": "Spacious",
			"sidebar_tint": "#234567",
			"custom_css": "/* Cards */ .widget, .desk-sidebar { border-radius: 16px; }",
			"settings_json": '{"widget_radius": 0, "widget_padding": 18, "dashboard_gap": 8}',
		}
		preview = compile_theme_preview(json.dumps(draft))
		self.assertEqual(get_active_theme(), original)
		self.assertEqual(preview["variables"]["--bt-on-primary"], "#000000")
		self.assertEqual(preview["variables"]["--bt-widget-radius"], "0px")
		self.assertEqual(preview["variables"]["--bt-sidebar-tint"], "#234567")
		self.assertIn("body.bt-desk .desk-sidebar", preview["custom_css"])
		base.update(draft)
		base.save()
		base.reload()
		self.assertNotIn("/*", base.custom_css)
		self.assertEqual(base.primary_color, "#fafafa")
		bootinfo = {}
		extend_bootinfo(bootinfo)
		self.assertEqual(bootinfo["business_theme"], {"active": preview, "sidebars": SIDEBARS})
		self.assertEqual(set(preview), {"sidebar_style", "variables", "custom_css"})

	def test_invalid_drafts_and_saves_are_rejected(self):
		for fields in (
			{"primary_color": "blue"},
			{"sidebar_tint": "#12345g"},
			{"sidebar_style": "Other"},
			{"sidebar_style": "Minimal", "sidebar_density": "Spacious"},
			{"settings_json": "{"},
			{"settings_json": "[]"},
			{"settings_json": {"arbitrary": 1}},
			{"settings_json": {"widget_radius": True}},
			{"settings_json": {"dashboard_gap": 33}},
			{"custom_css": "@import 'palette.css';"},
			{"custom_css": "body { color: #fff; }"},
			{"custom_css": ".widget { color: url(/palette); }"},
			{"custom_css": ".widget { position: fixed; }"},
			{"custom_css": ".widget { padding-inline: 4px !important; }"},
		):
			with self.subTest(fields=fields):
				with self.assertRaises(frappe.ValidationError):
					compile_theme_preview(fields)
				with self.assertRaises(frappe.ValidationError):
					self.new_theme(**fields).insert()

	def test_session_and_redis_invalidation_is_after_commit(self):
		cache = frappe.cache()
		doc = self.new_theme()
		for hook in (doc.on_update, doc.on_trash):
			cache.set_value(CACHE_KEY, (None, compile_theme({})))
			cache.hset("bootinfo", "theme-test-user", {"present": True})
			hook()
			frappe.db.rollback()
			self.assertIsNotNone(cache.get_value(CACHE_KEY))
			hook()
			self.assertIsNotNone(cache.hget("bootinfo", "theme-test-user"))
			frappe.db.commit()
			self.assertIsNone(cache.get_value(CACHE_KEY))
			self.assertIsNone(cache.hget("bootinfo", "theme-test-user"))

	def test_desk_access_does_not_grant_editor_access(self):
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": f"theme-{frappe.generate_hash(length=8)}@example.com",
				"first_name": "Theme Reader",
				"send_welcome_email": 0,
				"roles": [{"role": "Workspace Manager"}],
			}
		).insert()
		with self.set_user(user.name):
			self.assertIn("variables", get_active_theme())
			self.assertFalse(frappe.has_permission(DOCTYPE, "read"))
			with self.assertRaises(frappe.PermissionError):
				compile_theme_preview({})
		with self.set_user("Guest"):
			self.assertRaises(frappe.PermissionError, get_active_theme)
			bootinfo = {}
			extend_bootinfo(bootinfo)
			self.assertNotIn("business_theme", bootinfo)

	def test_arabic_labels_and_messages_are_available(self):
		self.assertEqual(frappe._("Preview Theme", lang="ar"), "معاينة السمة")
		self.assertNotEqual(
			frappe._("Choose a supported sidebar style.", lang="ar"), "Choose a supported sidebar style."
		)

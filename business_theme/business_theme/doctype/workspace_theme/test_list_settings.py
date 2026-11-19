"""Bench integration tests for the native List View Settings extension."""

import frappe
from frappe.tests.utils import FrappeTestCase

from business_theme.list_settings import extend_list_field_options


class TestListSettings(FrappeTestCase):
	def test_options_are_extended_and_idempotent(self):
		extend_list_field_options()
		field = frappe.get_meta("List View Settings").get_field("total_fields")
		options = field.options.split("\n")
		for value in ("", "4", "10", "11", "40"):
			self.assertIn(value, options)
		name = frappe.db.get_value(
			"Property Setter",
			{"doc_type": "List View Settings", "field_name": "total_fields", "property": "options"},
			"name",
		)
		extend_list_field_options()
		self.assertEqual(name, frappe.db.get_value(
			"Property Setter",
			{"doc_type": "List View Settings", "field_name": "total_fields", "property": "options"},
			"name",
		))
		self.assertEqual(options, frappe.get_meta("List View Settings").get_field("total_fields").options.split("\n"))

	def test_extended_select_value_passes_native_validation(self):
		extend_list_field_options()
		doc = frappe.new_doc("List View Settings")
		doc.total_fields = "25"
		doc._validate_selects()

	def test_native_settings_persist_extended_limit_and_flags(self):
		extend_list_field_options()
		name = "Business Theme Test " + frappe.generate_hash(length=8)
		doc = frappe.get_doc({
			"doctype": "List View Settings",
			"name": name,
			"total_fields": "25",
			"disable_count": 1,
			"disable_comment_count": 1,
			"disable_sidebar_stats": 1,
			"disable_auto_refresh": 1,
			"allow_edit": 1,
			"disable_automatic_recency_filters": 1,
			"fields": '[{"fieldname":"name","label":"ID"}]',
		}).insert()
		saved = frappe.get_doc("List View Settings", doc.name)
		self.assertEqual(saved.total_fields, "25")
		for fieldname in (
			"disable_count", "disable_comment_count", "disable_sidebar_stats", "disable_auto_refresh",
			"allow_edit", "disable_automatic_recency_filters",
		):
			self.assertEqual(saved.get(fieldname), 1)

"""Extend Frappe's native List View Settings field limit without changing core files."""

import frappe


MAX_FIELDS = 40


def extend_list_field_options():
	"""Run after model sync; preserve any pre-existing custom select options."""
	filters = {
		"doc_type": "List View Settings",
		"field_name": "total_fields",
		"property": "options",
	}
	name = frappe.db.get_value("Property Setter", filters, "name")
	field = frappe.get_meta("List View Settings").get_field("total_fields")
	if not field:
		return
	options = (field.options or "").split("\n")
	for number in range(4, MAX_FIELDS + 1):
		if str(number) not in options:
			options.append(str(number))
	value = "\n".join(options)
	if value == (field.options or ""):
		return
	if name:
		setter = frappe.get_doc("Property Setter", name)
		setter.value = value
		setter.save(ignore_permissions=True)
	else:
		frappe.make_property_setter(
			{
				"doctype": "List View Settings",
				"doctype_or_field": "DocField",
				"fieldname": "total_fields",
				"property": "options",
				"value": value,
				"property_type": "Small Text",
			},
			ignore_validate=True,
		)
	frappe.clear_cache(doctype="List View Settings")

app_name = "business_theme"
app_title = "Business Theme"
app_publisher = "Josue Aguilar Cano"
app_description = "A comprehensive business management application providing an integrated, customizable, and modern business interface for the Frappe Framework."
app_email = "josuecano22222@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "business_theme",
# 		"logo": "/assets/business_theme/logo.png",
# 		"title": "Business Theme",
# 		"route": "/business_theme",
# 		"has_permission": "business_theme.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# Desk only. Frappe resolves these names to hashed assets at boot.
app_include_css = "business_theme.bundle.css"
app_include_js = "business_theme.bundle.js"
after_migrate = "business_theme.list_settings.extend_list_field_options"
after_install = "business_theme.list_settings.extend_list_field_options"
extend_bootinfo = "business_theme.business_theme.doctype.workspace_theme.workspace_theme.extend_bootinfo"

# include js, css files in header of web template
# web_include_css = "/assets/business_theme/css/business_theme.css"
# web_include_js = "/assets/business_theme/js/business_theme.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "business_theme/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "business_theme/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "business_theme.utils.jinja_methods",
# 	"filters": "business_theme.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "business_theme.install.before_install"
# after_install = "business_theme.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "business_theme.uninstall.before_uninstall"
# after_uninstall = "business_theme.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "business_theme.utils.before_app_install"
# after_app_install = "business_theme.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "business_theme.utils.before_app_uninstall"
# after_app_uninstall = "business_theme.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "business_theme.build.after_build"

# To hook into the build process of other apps
# The list of apps being built is passed as an argument

# after_app_build = "business_theme.build.after_app_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "business_theme.notifications.get_notification_config"

# Awesome Bar
# -----------
# Extra search results: list of dicts with label, description, route, index.
# route: ["List", "ToDo"], "/desk/docs/some/page", or "https://example.com"
# awesomebar_search = ["business_theme.search.awesomebar_results"]

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"business_theme.tasks.all"
# 	],
# 	"daily": [
# 		"business_theme.tasks.daily"
# 	],
# 	"hourly": [
# 		"business_theme.tasks.hourly"
# 	],
# 	"weekly": [
# 		"business_theme.tasks.weekly"
# 	],
# 	"monthly": [
# 		"business_theme.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "business_theme.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "business_theme.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "business_theme.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["business_theme.utils.before_request"]
# after_request = ["business_theme.utils.after_request"]

# Job Events
# ----------
# before_job = ["business_theme.utils.before_job"]
# after_job = ["business_theme.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"business_theme.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

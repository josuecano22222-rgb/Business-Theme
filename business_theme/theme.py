"""Presentation contract shared by document saves, Desk boot and unsaved previews."""

import json
import re

import frappe
import tinycss2
from frappe import _

DEFAULT_PRIMARY = "#176b68"
SIDEBARS = {
	"Minimal": {"densities": ["Comfortable", "Compact"], "tinted": False},
	"Glassmorphism": {"densities": ["Comfortable", "Compact"], "tinted": True},
	"Floating": {"densities": ["Comfortable", "Spacious"], "tinted": True},
	"Expanded": {"densities": ["Comfortable", "Spacious"], "tinted": False},
}
_ROW_HEIGHT = {"Compact": 28, "Comfortable": 34, "Spacious": 42}
# key: (minimum, maximum, built-in value), in CSS pixels
_SIZES = {"widget_radius": (0, 32, 12), "widget_padding": (4, 32, 12), "dashboard_gap": (4, 32, 16)}


def json_object(value, message):
	if isinstance(value, str):
		try:
			value = json.loads(value)
		except (ValueError, RecursionError):
			frappe.throw(message)
	if not isinstance(value, dict):
		frappe.throw(message)
	return value


def _settings(value):
	if value is None or value == "":
		return {}
	settings = json_object(value, _("Widget and Dashboard Settings must be a JSON object."))
	if settings.keys() - _SIZES.keys():
		frappe.throw(_("Supported settings are widget_radius, widget_padding and dashboard_gap."))
	for key, val in settings.items():
		low, high, _default = _SIZES[key]
		if type(val) is not int or not low <= val <= high:
			frappe.throw(_("Use a whole number from {0} to {1} for {2}.").format(low, high, key))
	return settings


def _hex(value, label):
	if not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", value.strip()):
		frappe.throw(_("{0} must be a six-digit hex color, such as #176b68.").format(label))
	return value.strip().lower()


# Only reconstruct known selectors and scalar property values. Never pass through raw CSS.
# Expand two short editor selectors to the actual v15 components so their
# declarations take precedence over Desk's more specific built-in rules.
_TARGETS = {
	".navbar": ".navbar",
	".page-head": ".page-head",
	".widget": ".widget",
	".widget-title": ".widget .widget-head .widget-label .widget-title",
	".desk-sidebar": ".desk-sidebar",
	".standard-sidebar-item": ".desk-sidebar .standard-sidebar-item",
}
_COLOR = re.compile(
	r"(?:#[0-9a-f]{3}|#[0-9a-f]{6}|transparent|currentcolor|var\(--bt-(?:primary|sidebar-tint)\))"
)
_LENGTH = re.compile(r"(?:0|(?:[0-9]|[1-5][0-9]|6[0-4])px)")
_PROPERTIES = {
	**dict.fromkeys(("color", "background-color", "border-color"), _COLOR),
	**dict.fromkeys(("border-radius", "padding-inline", "padding-block", "margin-block-start"), _LENGTH),
	"font-weight": re.compile(r"[4-7]00"),
}


def _clean_css(value, scoped):
	if value is None or value == "":
		return ""
	if not isinstance(value, str) or len(value) > 8192:
		frappe.throw(_("Custom CSS must be text of at most 8192 characters."))
	rules = []
	for rule in tinycss2.parse_stylesheet(value, skip_comments=True, skip_whitespace=True):
		if rule.type != "qualified-rule" or any(
			t.type not in {"ident", "literal", "whitespace"} for t in rule.prelude
		):
			frappe.throw(
				_("Only component style rules are allowed in Custom CSS (line {0}).").format(rule.source_line)
			)
		selectors = [s.strip() for s in tinycss2.serialize(rule.prelude).split(",")]
		if not all(s in _TARGETS for s in selectors):
			frappe.throw(_("Unsupported component selector on line {0}.").format(rule.source_line))
		declarations = []
		for d in tinycss2.parse_declaration_list(rule.content, skip_comments=True, skip_whitespace=True):
			if d.type == "declaration" and not d.important and (pattern := _PROPERTIES.get(d.lower_name)):
				try:
					v = tinycss2.serialize(d.value).strip().lower()
				except RecursionError:
					v = ""
				if pattern.fullmatch(v):
					declarations.append(f"{d.lower_name}:{v};")
					continue
			frappe.throw(_("Unsupported CSS property or value on line {0}.").format(d.source_line))
		if declarations:
			rules.append((selectors, "".join(declarations)))

	def render(scope):
		blocks = []
		for selectors, css in rules:
			targets = [f"body.bt-desk {_TARGETS[s]}" for s in selectors] if scope else selectors
			blocks.append(f"{','.join(targets)}{{{css}}}")
		return "\n".join(blocks)

	clean = render(False)
	if len(clean) > 8192:
		frappe.throw(_("Custom CSS must be text of at most 8192 characters."))
	return render(True) if scoped else clean


def normalize_theme(values, *, scoped=False):
	style = values.get("sidebar_style", "Minimal")
	if not isinstance(style, str) or style not in SIDEBARS:
		frappe.throw(_("Choose a supported sidebar style."))
	density = values.get("sidebar_density", "Comfortable")
	if density not in SIDEBARS[style]["densities"]:
		frappe.throw(_("Choose a density available for this sidebar style."))
	tint = values.get("sidebar_tint")
	return {
		"sidebar_style": style,
		"sidebar_density": density,
		"sidebar_tint": _hex(tint, _("Sidebar Tint")) if tint not in (None, "") else None,
		"primary_color": _hex(values.get("primary_color", DEFAULT_PRIMARY), _("Primary Color")),
		"settings_json": _settings(values.get("settings_json")),
		"custom_css": _clean_css(values.get("custom_css"), scoped),
	}


def _foreground(hex_color):
	"""Choose the higher WCAG contrast of white and black against the primary fill."""
	rgb = (int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5))
	linear = (v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb)
	luminance = sum(v * w for v, w in zip(linear, (0.2126, 0.7152, 0.0722), strict=True))
	return "#000000" if (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) else "#ffffff"


def compile_theme(values):
	theme = normalize_theme(values, scoped=True)
	style, primary = theme["sidebar_style"], theme["primary_color"]
	variables = {
		"--bt-primary": primary,
		"--bt-on-primary": _foreground(primary),
		"--bt-sidebar-tint": (theme["sidebar_tint"] or primary) if SIDEBARS[style]["tinted"] else primary,
		"--bt-sidebar-row": f"{_ROW_HEIGHT[theme['sidebar_density']]}px",
	}
	for key, (_low, _high, default) in _SIZES.items():
		variables["--bt-" + key.replace("_", "-")] = f"{theme['settings_json'].get(key, default)}px"
	return {"sidebar_style": style, "variables": variables, "custom_css": theme["custom_css"]}

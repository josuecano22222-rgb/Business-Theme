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

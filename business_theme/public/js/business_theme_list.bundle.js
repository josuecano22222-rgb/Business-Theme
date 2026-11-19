// Frappe v15 ships the List Settings dialog and stores it per DocType. Keep its
// permission checks, field selector and server save path; only adapt layout and
// the column limit for lists with an explicitly configured field count.
(() => {
	const proto = frappe.views?.ListView?.prototype;
	if (!proto || proto.__business_theme_list) return;
	proto.__business_theme_list = true;

	const setup_columns = proto.setup_columns;
	proto.setup_columns = function (...args) {
		if (this.view_name !== "List") return setup_columns.apply(this, args);
		const settings = this.list_view_settings;
		const limit = Number(settings?.total_fields);
		// Frappe counts its hidden Tag column against total_fields although it is
		// not part of the selector. Account for it without changing saved data.
		if (Number.isInteger(limit) && limit >= 4) {
			this.list_view_settings = { ...settings, total_fields: limit + 1 };
		}
		try {
			setup_columns.apply(this, args);
		} finally {
			this.list_view_settings = settings;
		}
		if (!this.$result) return;
		const enabled = Number.isInteger(limit) && limit >= 4;
		this.$result.toggleClass("bt-scrollable-list", enabled);
		if (enabled) {
			// Subject gets extra room; the activity column stays in the same scroll area.
			const visible = this.columns.filter((column) => column.type !== "Tag").length;
			this.$result[0].style.setProperty("--bt-list-min-width", `${visible * 150 + 250}px`);
			this.$result.attr({ tabindex: "0", role: "region", "aria-label": __("Scrollable list results") });
		} else {
			this.$result[0].style.removeProperty("--bt-list-min-width");
			this.$result.removeAttr("tabindex role aria-label");
		}
	};

	const refresh_columns = proto.refresh_columns;
	proto.refresh_columns = async function (meta, settings) {
		if (this.view_name !== "List") return refresh_columns.call(this, meta, settings);
		// Native refresh_columns changes the columns but does not rebuild the query
		// fields. Fetch newly selected columns on the first refresh, not just reload.
		this.meta = meta;
		this.list_view_settings = settings;
		this.fields = [];
		this.set_stats();
		await this.setup_fields();
		return refresh_columns.call(this, meta, settings);
	};
})();

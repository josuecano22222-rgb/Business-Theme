// Adapt only Frappe v15's standard List view; native settings and permissions
// remain the source of truth for which fields may be displayed.
(() => {
	const proto = frappe.views?.ListView?.prototype;
	if (!proto || proto.__business_theme_list) return;
	proto.__business_theme_list = true;

	const MIN_WIDTH = 80;
	const MAX_WIDTH = 800;
	const SUBJECT_WIDTH = 240;
	const FIELD_WIDTH = 150;
	const ACTIVITY_WIDTH = 180;
	const COLUMN_GAP = 15; // Frappe's .list-row-col margin
	let styledColumns = 0;

	function column_key(column) {
		return `${column.type}:${column.df?.fieldname || column.type}`;
	}

	function default_width(column) {
		return column.type === "Subject" ? SUBJECT_WIDTH : FIELD_WIDTH;
	}

	function storage_key(view) {
		return `business_theme:list_widths:${window.location.host}:${frappe.session.user}:${view.doctype}`;
	}

	function widths(view) {
		if (!view._bt_column_widths) {
			view._bt_column_widths = Object.create(null);
			try {
				const saved = JSON.parse(window.localStorage.getItem(storage_key(view)) || "{}");
				if (saved && typeof saved === "object" && !Array.isArray(saved)) {
					for (const [key, value] of Object.entries(saved)) {
						if (Number.isFinite(value) && value >= MIN_WIDTH && value <= MAX_WIDTH) {
							view._bt_column_widths[key] = value;
						}
					}
				}
			} catch (e) {
				// Storage may be unavailable in private or restricted browsing modes.
			}
		}
		return view._bt_column_widths;
	}

	function save_widths(view) {
		try {
			window.localStorage.setItem(storage_key(view), JSON.stringify(widths(view)));
		} catch (e) {
			// Resizing still works for the current page when storage is unavailable.
		}
	}

	function ensure_column_rules(count) {
		if (count <= styledColumns) return;
		let sheet = document.getElementById("bt-list-column-widths");
		if (!sheet) {
			sheet = document.createElement("style");
			sheet.id = "bt-list-column-widths";
			document.head.appendChild(sheet);
		}
		let rules = "";
		for (let i = styledColumns + 1; i <= count; i++) {
			const header = `.bt-scrollable-list .list-header-subject > .list-row-col:nth-child(${i})`;
			const row = `.bt-scrollable-list .list-row > .level-left > .list-row-col:nth-child(${i})`;
			rules += `${header},${row}{flex:0 0 var(--bt-col-${i});width:var(--bt-col-${i});min-width:0;max-width:var(--bt-col-${i});}\n`;
		}
		sheet.appendChild(document.createTextNode(rules));
		styledColumns = count;
	}

	function apply_widths(view) {
		if (!view.$result || !view.columns) return;
		const result = view.$result[0];
		const saved = widths(view);
		let leftWidth = 0;
		ensure_column_rules(view.columns.length);
		view.columns.forEach((column, index) => {
			const width = saved[column_key(column)] ?? default_width(column);
			result.style.setProperty(`--bt-col-${index + 1}`, `${width}px`);
			if (column.type !== "Tag" || view.tags_shown) leftWidth += width + COLUMN_GAP;
		});
		result.style.setProperty("--bt-list-left-width", `${leftWidth}px`);
		result.style.setProperty("--bt-list-min-width", `${leftWidth + ACTIVITY_WIDTH + 15}px`);
	}

	function set_width(view, column, value, persist = false) {
		const key = column_key(column);
		if (value == null) delete widths(view)[key];
		else widths(view)[key] = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value)));
		apply_widths(view);
		if (persist) save_widths(view);
	}

	function add_handles(view) {
		const root = view.$result?.[0];
		const header = root?.querySelector(".list-row-head .list-header-subject");
		if (!header || !view.columns) return;
		// Frappe recreates the header with its Tag column hidden even if tags
		// are currently visible in the rows.
		const tag = header.querySelector(".tag-col");
		if (tag) tag.classList.toggle("hide", !view.tags_shown);
		const cells = header.querySelectorAll(":scope > .list-row-col");
		view.columns.forEach((column, index) => {
			const cell = cells[index];
			if (!cell || cell.querySelector(".bt-column-resize")) return;
			const handle = document.createElement("span");
			const label = __(column.df?.label || column.type);
			handle.className = "bt-column-resize";
			handle.tabIndex = 0;
			handle.setAttribute("role", "separator");
			handle.setAttribute("aria-orientation", "vertical");
			handle.setAttribute("aria-label", __("Resize {0} column", [label]));
			handle.setAttribute("aria-valuemin", MIN_WIDTH);
			handle.setAttribute("aria-valuemax", MAX_WIDTH);
			handle.title = __("Drag or use arrow keys to resize; double-click or press Home to reset");
			const current = () => widths(view)[column_key(column)] ?? default_width(column);
			const update_aria = () => handle.setAttribute("aria-valuenow", current());
			const direction = () => getComputedStyle(root).direction === "rtl" ? -1 : 1;
			update_aria();
			handle.addEventListener("click", (event) => event.stopPropagation());
			handle.addEventListener("dblclick", (event) => {
				event.preventDefault();
				event.stopPropagation();
				set_width(view, column, null, true);
				update_aria();
			});
			handle.addEventListener("keydown", (event) => {
				if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
				event.preventDefault();
				event.stopPropagation();
				const delta = (event.key === "ArrowRight" ? 1 : -1) * direction() * (event.shiftKey ? 40 : 10);
				set_width(view, column, event.key === "Home" ? null : current() + delta, true);
				update_aria();
			});
			let drag = null;
			handle.addEventListener("pointerdown", (event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.stopPropagation();
				drag = { id: event.pointerId, x: event.clientX, width: current(), direction: direction() };
				handle.setPointerCapture(event.pointerId);
			});
			handle.addEventListener("pointermove", (event) => {
				if (!drag || drag.id !== event.pointerId) return;
				set_width(view, column, drag.width + (event.clientX - drag.x) * drag.direction);
				update_aria();
			});
			const end_drag = (event) => {
				if (!drag || drag.id !== event.pointerId) return;
				if (event.type === "pointercancel") set_width(view, column, drag.width);
				drag = null;
				save_widths(view);
				update_aria();
			};
			handle.addEventListener("pointerup", end_drag);
			handle.addEventListener("pointercancel", end_drag);
			cell.appendChild(handle);
		});
	}

	const setup_columns = proto.setup_columns;
	proto.setup_columns = function (...args) {
		if (this.view_name !== "List") return setup_columns.apply(this, args);
		const settings = this.list_view_settings;
		const limit = Number(settings?.total_fields);
		// The native hidden Tag column is not part of the selector's field count.
		if (Number.isInteger(limit) && limit >= 4) {
			this.list_view_settings = { ...settings, total_fields: limit + 1 };
		}
		try {
			setup_columns.apply(this, args);
		} finally {
			this.list_view_settings = settings;
		}
		if (!this.$result) return;
		this.$result.toggleClass("bt-scrollable-list", true);
		this.$result.attr({ tabindex: "0", role: "region", "aria-label": __("Scrollable list results") });
		apply_widths(this);
	};

	const render_header = proto.render_header;
	proto.render_header = function (...args) {
		const result = render_header.apply(this, args);
		if (this.view_name === "List") add_handles(this);
		return result;
	};

	const toggle_tags = proto.toggle_tags;
	proto.toggle_tags = function (...args) {
		const result = toggle_tags.apply(this, args);
		if (this.view_name === "List") apply_widths(this);
		return result;
	};

	const refresh_columns = proto.refresh_columns;
	proto.refresh_columns = async function (meta, settings) {
		if (this.view_name !== "List") return refresh_columns.call(this, meta, settings);
		// Rebuild query fields immediately after selecting new columns.
		this.meta = meta;
		this.list_view_settings = settings;
		this.fields = [];
		this.set_stats();
		await this.setup_fields();
		return refresh_columns.call(this, meta, settings);
	};
})();

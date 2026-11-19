// The list adapter is bundled here as well, so existing Desk hooks load it.
import "./business_theme_list.bundle.js";

// Desk boot already contains the validated presentation. No startup RPC or localStorage.
(() => {
	const boot = frappe.boot.business_theme;
	if (!boot) return;
	const api = "business_theme.business_theme.doctype.workspace_theme.workspace_theme";
	let active = boot.active;
	let previewBar = null;
	let previewRequest = 0;
	let activeRequest = 0;

	function sync_locale() {
		const lang = (frappe.boot.lang || "en").replace(/_/g, "-");
		const rtl = frappe.utils.is_rtl(lang.split("-")[0].toLowerCase());
		document.documentElement.lang = lang;
		document.documentElement.dir = document.body.dir = rtl ? "rtl" : "ltr";
		document.body.classList.toggle("bt-rtl", rtl);
		document.body.classList.toggle("bt-ltr", !rtl);
	}

	function apply(theme) {
		document.body.classList.add("bt-desk");
		document.body.dataset.btSidebar = theme.sidebar_style;
		for (const [key, value] of Object.entries(theme.variables)) {
			document.body.style.setProperty(key, value);
		}
		let sheet = document.getElementById("bt-component-styles");
		if (theme.custom_css) {
			if (!sheet) {
				sheet = document.createElement("style");
				sheet.id = "bt-component-styles";
				document.head.append(sheet);
			}
			sheet.textContent = theme.custom_css;
		} else {
			sheet?.remove();
		}
	}

	function end_preview() {
		++previewRequest;
		previewBar?.remove();
		previewBar = null;
		apply(active);
	}

	async function preview(theme) {
		const request = ++previewRequest;
		const draft = await frappe.xcall(`${api}.compile_theme_preview`, { theme });
		if (request !== previewRequest) return;
		apply(draft);
		if (previewBar) return;

		// Keep the preview reversible even when navigating to an actual Workspace.
		previewBar = document.createElement("aside");
		previewBar.className = "bt-preview-bar";
		const status = document.createElement("span");
		status.setAttribute("role", "status");
		status.textContent = __("Theme preview is active in this tab.");
		const end = document.createElement("button");
		end.type = "button";
		end.className = "btn btn-xs btn-default";
		end.textContent = __("End Preview");
		end.addEventListener("click", end_preview);
		previewBar.append(status, end);
		document.body.append(previewBar);
	}

	async function refresh_active() {
		const request = ++activeRequest;
		const theme = await frappe.xcall(`${api}.get_active_theme`);
		if (request !== activeRequest) return;
		active = theme;
		if (!previewBar) apply(active);
	}

	function add_language_switch() {
		const menu = document.getElementById("toolbar-user");
		if (!menu || menu.querySelector(".bt-language-switch")) return;
		const toEnglish = document.documentElement.lang.split("-")[0].toLowerCase() === "ar";
		const button = document.createElement("button");
		button.type = "button";
		button.className = "dropdown-item btn-reset bt-language-switch";
		button.textContent = toEnglish ? __("Switch to English") : __("Switch to Arabic");
		button.addEventListener("click", async () => {
			if (frappe.get_route()?.[0] === "Form" && window.cur_frm?.is_dirty()) {
				frappe.msgprint(__("Save or discard your changes before switching languages."));
				return;
			}
			button.disabled = true;
			try {
				await frappe.xcall("frappe.client.set_value", {
					doctype: "User",
					name: frappe.session.user,
					fieldname: "language",
					value: toEnglish ? "en" : "ar",
				});
				// Frappe loads dictionaries, formats and its own RTL bundle at boot.
				window.location.reload();
			} finally {
				button.disabled = false;
			}
		});
		menu.prepend(button);
	}

	frappe.business_theme = { sync_locale, preview, end_preview, refresh_active };
	sync_locale();
	apply(active);
	$(document).on("toolbar_setup", add_language_switch);
	frappe.router.on("change", sync_locale);
	$(document).on("app_ready", () => {
		sync_locale();
		frappe.realtime.on("business_theme_changed", refresh_active);
	});
})();

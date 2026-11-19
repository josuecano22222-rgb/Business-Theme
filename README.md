# Business Theme · Workspace Theme Engine

A Desk theme app for **Frappe v15.126.1 (version-15)**, including ERPNext sites on that framework. A System Manager designs a theme once; English and Arabic users see the same design in their own language and reading direction. The app does not change the website, login page, print formats or Frappe core.

[Implementation handoff: complete JSON, Python and JavaScript code blocks](docs/workspace-theme.md)

## Install on a bench

Start in **this checkout**, outside an existing v15 bench. Use your bench directory and actual site name below. `--soft-link` lets Bench use the files in the checkout, including local changes.

```bash
THEME_SRC="$PWD"
cd ~/frappe-bench
SITE=erp.example.com
bench get-app --soft-link --skip-assets "$THEME_SRC"
bench --site "$SITE" install-app business_theme
bench --site "$SITE" migrate
bench build --apps business_theme
bench --site "$SITE" clear-cache
```

For an existing installation, update the checkout, run `bench setup requirements --python`, then run the migrate, build and clear-cache commands above. Restart production workers with `bench restart` and refresh Desk once. ERPNext is optional; the app depends only on Frappe and the `tinycss2` parser.

## Use it

1. As **System Manager**, open **Workspace Theme** in the Desk search bar (or `/app/workspace-theme`) and create a record. Give it a unique name and pick a primary color.
2. Choose **Minimal**, **Glassmorphism**, **Floating** or **Expanded**. The density choices follow the style. Glassmorphism and Floating also accept a sidebar tint; blank inherits the primary color.
3. Click **Preview Theme**, even before the first save. Navigate to a Workspace to inspect real widgets and sidebar items. **End Preview** restores the latest saved default. A preview affects only this tab; it never writes a document, user preference or shared cache.
4. Check **Default Desk Theme** and save to publish. Saving an unchecked theme keeps it available without activating it. Unchecking or deleting the last default restores the built-in Minimal theme. Saving also ends a local preview.
5. In the user menu, choose **Switch to Arabic** / **التبديل إلى الإنجليزية**, or change **Language** in the native User settings. The menu saves only the current user's language and reloads the **same route once** so that Frappe also changes translations, number/date formats and its core RTL/LTR assets. It won't discard a dirty form. Theme previews do **not** need a reload.

## File placement

Bench checkout: `apps/business_theme/`. The first `business_theme/` inside the checkout is the **Python app package**; the next is the **Business Theme module** declared in `modules.txt`.

```text
apps/business_theme/
├── pyproject.toml
└── business_theme/
    ├── hooks.py
    ├── modules.txt
    ├── theme.py                         # shared validation and compiler
    ├── translations/ar.csv
    ├── public/
    │   ├── css/business_theme.bundle.css
    │   ├── js/business_theme.bundle.js
    │   └── fonts/                       # Cairo Arabic WOFF2 and its OFL license
    └── business_theme/doctype/workspace_theme/
        ├── __init__.py
        ├── workspace_theme.json         # schema, naming, permissions
        ├── workspace_theme.py           # controller, RPCs, boot hook
        ├── workspace_theme.js           # native form behavior
        └── test_workspace_theme.py
```

Core files: [DocType JSON](business_theme/business_theme/doctype/workspace_theme/workspace_theme.json) · [Python controller](business_theme/business_theme/doctype/workspace_theme/workspace_theme.py) · [form JavaScript](business_theme/business_theme/doctype/workspace_theme/workspace_theme.js).

When porting to a different app, the pattern is `apps/<app>/<app>/<module_slug>/doctype/workspace_theme/`. Keep `__init__.py` in the Python package directories. Match the JSON `module` to `modules.txt` and update the Python imports, boot hook, RPC prefix and `/assets/<app>/` font URL together. The three core files use the shared compiler and Desk assets; they are **not** three standalone Client Scripts.

## How it reaches Desk

- **Persistence:** `autoname: field:theme_name` names the record. Promotion clears the previous default in the same DB transaction. A hidden unique `default_slot` contains `active` for the default and SQL `NULL` for every other record. Even concurrent first-time promotions cannot commit two defaults. A manager who encounters a concurrent write conflict should reload and retry.
- **Compilation:** [theme.py](business_theme/theme.py) is the single validation path for saving, boot and preview. It normalizes six-digit hex colors, checks style-dependent options, bounds JSON pixel values and reconstructs allowed CSS rules. It computes a contrasting black or white primary-button foreground. The Desk payload contains only `sidebar_style`, `variables` and scoped `custom_css`, not the admin document.
- **Delivery:** [hooks.py](business_theme/hooks.py) registers `extend_bootinfo`. Frappe calls it even on warm per-user boots. `frappe.boot.business_theme` contains the active presentation and the sidebar option table. The compiled result is cached in site-prefixed Redis and matched against the active row's name and modification timestamp. A committed update or deletion drops just the compiled entry and v15's per-user `bootinfo` hash, **not login sessions**. A Desk realtime notification refreshes connected clients; without Socket.IO the next boot still picks up the change.
- **Assets:** `bench build` discovers the `*.bundle.js` and `*.bundle.css` entries, writes hashed files and registers the CSS/RTL-CSS and JS in Frappe's asset manifests. `app_include_css` and `app_include_js` load them on Desk. Frappe loads the same-named DocType form script separately and automatically. Changing a theme record requires **no asset rebuild**.
- **Rendering:** the [Desk runtime](business_theme/public/js/business_theme.bundle.js) sets `lang`/`dir` from `frappe.boot.lang`, mirrors direction on the body, and applies `--bt-*` variables with `style.setProperty`. Custom rules use one replaceable `<style>` node with `textContent`. The [stylesheet](business_theme/public/css/business_theme.bundle.css) uses logical edges and Frappe's surface tokens, preserving dark mode and the mobile drawer. InterVariable comes from Frappe; the Arabic subset of Cairo is served locally. DocType labels/select options use Frappe's native translation, and all additional messages use `__()` / `_()` and the [Arabic catalog](business_theme/translations/ar.csv).

### RPC contract

Both methods are in `business_theme.business_theme.doctype.workspace_theme.workspace_theme`. Use `frappe.xcall` or `/api/method/<dotted_method>` with the normal Frappe session/API authentication.

| Method | Access | Result |
| --- | --- | --- |
| `get_active_theme()` · GET/POST | Desk users | Active compiled presentation, or the built-in defaults |
| `compile_theme_preview(theme)` · POST | Workspace Theme write permission | Same payload for an unsaved settings object or JSON object string; no persistence |

## Advanced styling contract

**Widget and Dashboard Settings** accepts an object. All keys are optional; omitted keys take the defaults shown below. Values are whole CSS pixels, not CSS strings. Radius allows 0–32; padding and gap allow 4–32. Unknown keys or out-of-range values are rejected.

```json
{
  "widget_radius": 12,
  "widget_padding": 12,
  "dashboard_gap": 16
}
```

**Custom CSS** is a component stylesheet, not a general-purpose stylesheet. For example:

```css
.widget { border-radius: 18px; padding-block: 12px; }
.desk-sidebar { border-color: var(--bt-primary); }
```

- Targets: `.widget`, `.widget-title`, `.desk-sidebar`, `.standard-sidebar-item`, `.page-head`, `.navbar`. Comma-separated lists of these exact selectors are supported.
- `color`, `background-color`, `border-color`: `#RGB`, `#RRGGBB`, `transparent`, `currentcolor`, `var(--bt-primary)` or `var(--bt-sidebar-tint)`.
- `border-radius`, `padding-inline`, `padding-block`, `margin-block-start`: a single value of `0` or 0–64px. `font-weight`: 400, 500, 600 or 700.
- The server parses, validates and reserializes the rules before **either** preview or save. No URLs, at-rules, HTML, arbitrary functions, custom selectors or `!important`. The limit is 8192 characters. Use the version-controlled CSS bundle for broader changes.

## Verify

On a disposable installed site whose name starts with `test_`:

```bash
bench --site test_theme set-config allow_tests true
bench --site test_theme run-tests --app business_theme
```

Desk DOM tests (Node 18+, from this checkout): `npm ci --prefix tests/desk && npm test --prefix tests/desk`. To check visually, preview a Floating theme, navigate to a Workspace, end the preview, then switch from English to Arabic. The sidebar's selected edge and preview control should change sides without reversing the content order manually.

For development, run `pre-commit install` in this checkout to enable the repository's formatting and lint checks.

## License

App code: [MIT](license.txt). The bundled unmodified Cairo Arabic weight subset is from `@fontsource-variable/cairo` 5.3.0 and is distributed under the [SIL Open Font License 1.1](business_theme/public/fonts/Cairo-OFL.txt).

## Advanced DocType list settings

Business Theme extends **Frappe v15's native List Settings**, rather than creating a second set of settings. A System Manager can open a DocType's **List** view, choose **Menu → List Settings**, and configure:

- **Disable Count**, **Disable Comment Count**, **Disable Sidebar Stats**, and **Disable Auto Refresh**.
- **Allow Bulk Editing** (permits the native bulk edit action for a DocType with a workflow; it does not bypass permissions or validation).
- **Disable Automatic Recency Filters** for large tables.
- **Maximum Number of Fields**, now 4–40, and **Fields → + Add / Remove Fields**. Select fields, drag to reorder, or use **Reset Fields** in the selector. Save both the selector and the settings dialog.

The settings are **shared per DocType**, not per user. Choose the maximum *before* selecting the fields; the title and a status indicator, when present, count toward the maximum. Frappe can also append an ID column when a title field is configured. Use a reasonably small number of fields for good query and rendering performance. The header and rows share a horizontal scrollbar; on a narrow screen, swipe sideways or focus the results region and use the arrow keys. Drag the divider at the edge of any column heading to resize it; double-click the divider to reset that column. You can also focus a divider and use the left/right arrow keys (hold Shift for larger steps), or press Home to reset. Widths are saved per user, site and DocType in that browser, not shared with other users or devices; if browser storage is blocked they last only for the current page. The field limit still follows Frappe defaults until explicitly configured. Other views and form child tables are unchanged.

The native save path creates `in_list_view` Property Setters on the target DocType, so the selection affects other consumers of that metadata too. Field visibility and reads remain subject to Frappe permissions. Frappe's **Reset Fields** reads the original DocType JSON and may not work for database-only custom DocTypes. Some options, including sidebar and realtime setup, take full effect when the list is reopened or Desk is reloaded. In v15, **Disable Auto Refresh** disables realtime updates, not Frappe's separate five-minute refresh timer. Disabling the recency filter can make very large lists slower.

On install and migration the app adds missing values through 40 to the `List View Settings.total_fields` options using a Property Setter, preserving existing options. This site-wide metadata extension is intentionally left in place on uninstall so saved values above 10 remain valid; to revert it, first reduce those saved values to 10 or less and then remove the `options` Property Setter for that field. Other customizations of the same Property Setter should be reviewed before removal. Run the usual `bench --site SITE migrate`, `bench build --apps business_theme` and clear-cache steps after updating.

The list adapter is included in the existing Desk bundle so it loads even when an older cached hook only names `business_theme.bundle.js`. It retries installation at startup and navigation if the native ListView class is loaded later. The list layout does not depend on the workspace-theme boot payload or `bt-desk` body class. After updating on a production bench, restart the web workers and hard-refresh the browser so the new manifest and JavaScript are loaded. If the layout still looks compressed, open the browser console on the affected list and run `frappe.business_theme_list?.diagnostics()`; `active` should be true, `handles` should be nonzero, and for a wide list `scrollWidth` should exceed `clientWidth`. An undefined result means the updated Desk bundle has not loaded. The diagnostic includes the DocType name but no document rows.

Test the Desk adapters with `cd tests/desk && npm ci && npm test`. The Chromium layout/drag test runs when `CHROMIUM_PATH` points to a Chromium executable (for example, `CHROMIUM_PATH=/usr/bin/chromium npm test`); otherwise it is skipped. It uses a Frappe-v15-style markup and CSS fixture, not a live Frappe site. On a v15 bench, run `bench --site SITE run-tests --module business_theme.business_theme.doctype.workspace_theme.test_list_settings` for the metadata integration tests.

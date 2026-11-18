const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const app = path.resolve(__dirname, "../../business_theme");
const bundle = fs.readFileSync(
  path.join(app, "public/js/business_theme.bundle.js"),
  "utf8"
);
const form = fs.readFileSync(
  path.join(app, "business_theme/doctype/workspace_theme/workspace_theme.js"),
  "utf8"
);
const active = {
  sidebar_style: "Minimal",
  variables: { "--bt-primary": "#176b68" },
  custom_css: "",
};
const draft = {
  sidebar_style: "Floating",
  variables: { "--bt-primary": "#123456" },
  custom_css: "body.bt-desk .widget{border-radius:6px;}",
};

function desk(lang = "en") {
  const { document } = parseHTML(
    '<html><head></head><body><div id="toolbar-user"></div></body></html>'
  );
  const events = {};
  const emitter = { on: (name, fn) => (events[name] = fn) };
  const frappe = {
    boot: {
      lang,
      business_theme: {
        active,
        sidebars: {
          Floating: { densities: ["Comfortable", "Spacious"], tinted: true },
        },
      },
    },
    utils: { is_rtl: (base) => ["ar", "he", "fa", "ps"].includes(base) },
    router: emitter,
    realtime: emitter,
    session: { user: "reader@example.com" },
    get_route: () => ["Form"],
    ui: { form: { on: (_doctype, handlers) => (events.form = handlers) } },
  };
  const window = { location: {} };
  const context = vm.createContext({
    document,
    window,
    frappe,
    $: () => emitter,
    __: (s) => s,
  });
  vm.runInContext(bundle, context);
  vm.runInContext(form, context);
  events.app_ready();
  return { frappe, theme: frappe.business_theme, document, window, events };
}

test("boot and SPA navigation follow the session language in both directions", () => {
  const { document, frappe, events } = desk("ar_EG");
  assert.equal(document.documentElement.lang, "ar-EG");
  assert.equal(document.documentElement.dir, "rtl");
  assert.equal(document.body.dir, "rtl");
  assert.ok(document.body.classList.contains("bt-rtl"));
  frappe.boot.lang = "en-GB";
  events.change();
  assert.equal(document.documentElement.dir, "ltr");
  assert.equal(document.body.dir, "ltr");
  assert.ok(!document.body.classList.contains("bt-rtl"));
  assert.ok(document.body.classList.contains("bt-ltr"));
});

test("preview is tab-local, survives navigation, and restores the latest saved default", async () => {
  const { document, frappe, theme, events } = desk();
  const saved = { ...active, variables: { "--bt-primary": "#abcdef" } };
  frappe.xcall = async (method) =>
    method.endsWith("compile_theme_preview") ? draft : saved;
  await theme.preview({});
  events.change();
  await theme.preview({});
  assert.equal(document.querySelectorAll("#bt-component-styles").length, 1);
  assert.equal(
    document.querySelector("#bt-component-styles").textContent,
    draft.custom_css
  );
  assert.equal(document.querySelectorAll(".bt-preview-bar").length, 1);
  await events.business_theme_changed();
  assert.equal(document.body.dataset.btSidebar, "Floating");
  document.querySelector(".bt-preview-bar button").click();
  assert.equal(document.body.dataset.btSidebar, "Minimal");
  assert.equal(document.body.style.getPropertyValue("--bt-primary"), "#abcdef");
  assert.equal(document.querySelector("#bt-component-styles"), null);
  assert.equal(document.querySelector(".bt-preview-bar"), null);
});

test("a delayed or rejected preview cannot override an ended preview", async () => {
  const { document, frappe, theme } = desk();
  let complete;
  frappe.xcall = () => new Promise((resolve) => (complete = resolve));
  const pending = theme.preview({});
  theme.end_preview();
  complete(draft);
  await pending;
  frappe.xcall = () => Promise.reject(new Error("Invalid settings"));
  await assert.rejects(theme.preview({}));
  assert.equal(document.body.dataset.btSidebar, "Minimal");
  assert.equal(document.querySelector(".bt-preview-bar"), null);
});

test("form filters densities and sends unsaved editor content for compilation", async () => {
  const { frappe, events } = desk();
  let button;
  const frm = {
    doc: {
      sidebar_style: "Floating",
      sidebar_density: "Compact",
      custom_css: "",
    },
    fields_dict: {
      custom_css: {
        editor: { getValue: () => ".widget {padding-inline: 8px;}" },
      },
      settings_json: {},
    },
    trigger: (name) => events.form[name](frm),
    set_df_property: (field, prop, value) =>
      assert.deepEqual(
        [field, prop, value],
        ["sidebar_density", "options", "Comfortable\nSpacious"]
      ),
    toggle_display: (field, visible) =>
      assert.deepEqual([field, visible], ["sidebar_tint", true]),
    set_value: (name, value) => (frm.doc[name] = value),
    add_custom_button: (_label, fn) => (button = fn),
  };
  frappe.xcall = async (method, { theme }) => {
    assert.ok(method.endsWith(".compile_theme_preview"));
    assert.equal(theme.custom_css, ".widget {padding-inline: 8px;}");
    assert.equal(theme.sidebar_density, "Comfortable");
    return draft;
  };
  events.form.refresh(frm);
  await button();
});

test("locale switch protects edits and saves only the current user's language before reloading", async () => {
  const { document, frappe, window, events } = desk("ar");
  events.toolbar_setup();
  events.toolbar_setup();
  const button = document.querySelector(".bt-language-switch");
  assert.equal(document.querySelectorAll(".bt-language-switch").length, 1);
  assert.equal(button.textContent, "Switch to English");
  window.cur_frm = { is_dirty: () => true };
  let warned = false;
  frappe.msgprint = () => (warned = true);
  button.click();
  assert.ok(warned);
  window.cur_frm = { is_dirty: () => false };
  let reloaded = false;
  window.location.reload = () => (reloaded = true);
  frappe.xcall = async (method, args) => {
    assert.equal(method, "frappe.client.set_value");
    assert.deepEqual(
      { ...args },
      {
        doctype: "User",
        name: frappe.session.user,
        fieldname: "language",
        value: "en",
      }
    );
  };
  button.click();
  await new Promise(setImmediate);
  assert.ok(reloaded);
});

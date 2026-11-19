const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");

const source = fs.readFileSync(path.join(__dirname, "../../business_theme/public/js/business_theme_list.bundle.js"), "utf8");

function environment(storage = new Map(), user = "alice") {
  const { document, Event } = parseHTML('<html><head></head><body></body></html>');
  const window = {
    location: {host: "site.example"},
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  const fields = [
    {type: "Subject", df: {fieldname: "title", label: "Title"}},
    {type: "Tag"},
    {type: "Status"},
    {type: "Field", df: {fieldname: "customer", label: "Customer"}},
    {type: "Field", df: {fieldname: "name", label: "ID"}},
  ];
  class ListView {
    setup_columns() {
      this.observedLimit = this.list_view_settings.total_fields;
      this.columns = fields.slice(0, this.observedLimit || 4);
    }
    render_header() {
      const header = this.$result[0].querySelector(".list-header-subject");
      header.innerHTML = this.columns.map((c) => `<div class="list-row-col ${c.type === "Tag" ? "tag-col hide" : ""}"><span>${c.type}</span></div>`).join("");
    }
    toggle_tags() {}
    refresh_columns(meta, settings) { this.refreshed = [meta, settings, this.fields.slice()]; }
    set_stats() { this.fields.push("workflow_state"); }
    async setup_fields() { this.fields.push("new_field"); }
  }
  const frappe = {views: {ListView}, session: {user}};
  const context = vm.createContext({
    frappe, window, document,
    getComputedStyle: () => ({direction: document.documentElement.dir || "ltr"}),
    __: (s, args) => args ? s.replace("{0}", args[0]) : s,
  });
  vm.runInContext(source, context);
  vm.runInContext(source, context); // hot reload must not wrap twice
  function makeView(doctype = "Task", settings = {total_fields: "4"}) {
    const el = document.createElement("div");
    el.innerHTML = '<header class="list-row-head"><div class="list-header-subject"></div></header><div class="list-row-container"><div class="list-row"><div class="level-left"></div></div></div>';
    document.body.appendChild(el);
    const wrapper = {
      0: el,
      toggleClass: (name, enabled) => el.classList.toggle(name, enabled),
      attr: (attrs) => Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)),
    };
    const view = new ListView();
    Object.assign(view, {view_name: "List", doctype, list_view_settings: settings, $result: wrapper});
    view.setup_columns();
    view.render_header();
    return view;
  }
  function event(type, props = {}) {
    const e = new Event(type, {bubbles: true, cancelable: true});
    Object.assign(e, props);
    return e;
  }
  return {document, Event, storage, ListView, makeView, event};
}

function handle(view, index) {
  return view.$result[0].querySelectorAll(".bt-column-resize")[index];
}

test("explicit maximum accounts for tag and uses shared column tracks", () => {
  const env = environment();
  const saved = {total_fields: "4", disable_count: 1};
  const view = env.makeView("Task", saved);
  assert.equal(view.observedLimit, 5);
  assert.equal(view.list_view_settings, saved);
  assert.equal(saved.total_fields, "4");
  assert.equal(view.columns.length, 5);
  assert.ok(view.$result[0].classList.contains("bt-scrollable-list"));
  assert.equal(view.$result[0].style.getPropertyValue("--bt-col-1"), "240px");
  assert.equal(view.$result[0].style.getPropertyValue("--bt-list-left-width"), "750px");
  assert.equal(view.$result[0].getAttribute("role"), "region");
  const rules = env.document.getElementById("bt-list-column-widths").textContent;
  assert.match(rules, /list-header-subject > .list-row-col:nth-child\(5\)/);
  assert.match(rules, /list-row > .level-left > .list-row-col:nth-child\(5\)/);
});

test("drag, keyboard, bounds and reset persist by user and field across rerenders", () => {
  const env = environment();
  const view = env.makeView();
  const resize = handle(view, 3);
  resize.setPointerCapture = () => {};
  resize.dispatchEvent(env.event("pointerdown", {button: 0, pointerId: 1, clientX: 100}));
  resize.dispatchEvent(env.event("pointermove", {pointerId: 1, clientX: 200}));
  assert.equal(view.$result[0].style.getPropertyValue("--bt-col-4"), "250px");
  resize.dispatchEvent(env.event("pointerup", {pointerId: 1}));
  view.render_header();
  assert.equal(handle(view, 3).getAttribute("aria-valuenow"), "250");
  handle(view, 3).dispatchEvent(env.event("keydown", {key: "ArrowRight", shiftKey: true}));
  assert.equal(view.$result[0].style.getPropertyValue("--bt-col-4"), "290px");
  const reloaded = env.makeView();
  assert.equal(reloaded.$result[0].style.getPropertyValue("--bt-col-4"), "290px");
  const otherDoctype = env.makeView("Issue");
  assert.equal(otherDoctype.$result[0].style.getPropertyValue("--bt-col-4"), "150px");
  const otherUser = environment(env.storage, "bob").makeView();
  assert.equal(otherUser.$result[0].style.getPropertyValue("--bt-col-4"), "150px");
  handle(reloaded, 3).dispatchEvent(env.event("keydown", {key: "Home"}));
  assert.equal(env.makeView().$result[0].style.getPropertyValue("--bt-col-4"), "150px");
  handle(reloaded, 3).setPointerCapture = () => {};
  handle(reloaded, 3).dispatchEvent(env.event("pointerdown", {button: 0, pointerId: 2, clientX: 100}));
  handle(reloaded, 3).dispatchEvent(env.event("pointermove", {pointerId: 2, clientX: 2000}));
  assert.equal(reloaded.$result[0].style.getPropertyValue("--bt-col-4"), "800px");
  handle(reloaded, 3).dispatchEvent(env.event("pointercancel", {pointerId: 2}));
  assert.equal(reloaded.$result[0].style.getPropertyValue("--bt-col-4"), "150px");
});

test("RTL drag and arrows follow the physical resize edge; tag width follows visibility", () => {
  const env = environment();
  env.document.documentElement.dir = "rtl";
  const view = env.makeView();
  const resize = handle(view, 0);
  resize.dispatchEvent(env.event("keydown", {key: "ArrowLeft"}));
  assert.equal(view.$result[0].style.getPropertyValue("--bt-col-1"), "250px");
  view.tags_shown = true;
  view.toggle_tags();
  assert.equal(view.$result[0].style.getPropertyValue("--bt-list-left-width"), "925px");
  view.render_header();
  assert.ok(!view.$result[0].querySelector(".tag-col").classList.contains("hide"));
});

test("default lists are resizable and non-list views keep native behavior", () => {
  const env = environment();
  const view = env.makeView("Task", {});
  assert.equal(view.observedLimit, undefined);
  assert.equal(view.$result[0].querySelectorAll(".bt-column-resize").length, 4);
  view.view_name = "Kanban";
  view.list_view_settings = {total_fields: "4"};
  view.setup_columns();
  assert.equal(view.observedLimit, "4");
});

test("saving rebuilds query fields and retains workflow field before native refresh", async () => {
  const env = environment();
  const view = env.makeView();
  view.fields = ["old_field"];
  const meta = {name: "Example"};
  const settings = {total_fields: "12"};
  await view.refresh_columns(meta, settings);
  assert.equal(view.refreshed[0], meta);
  assert.equal(view.refreshed[1], settings);
  assert.deepEqual(Array.from(view.refreshed[2]), ["workflow_state", "new_field"]);
});

test("resize handle does not trigger header clicks and still works without storage", () => {
  const env = environment();
  const view = env.makeView();
  let bubbled = 0;
  view.$result[0].querySelector('.list-header-subject').addEventListener('click', () => bubbled++);
  handle(view, 0).dispatchEvent(env.event('click'));
  assert.equal(bubbled, 0);
  // Widths remain usable when the browser refuses persistence.
  const saved = env.storage;
  saved.set = () => { throw new Error('storage blocked'); };
  assert.doesNotThrow(() => handle(view, 0).dispatchEvent(env.event('keydown', {key: 'ArrowRight'})));
  assert.equal(view.$result[0].style.getPropertyValue('--bt-col-1'), '250px');
});

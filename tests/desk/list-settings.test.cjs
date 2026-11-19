const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../business_theme/public/js/business_theme_list.bundle.js"), "utf8");

function environment() {
  class ListView {
    setup_columns() {
      this.observedLimit = this.list_view_settings.total_fields;
      this.columns = [{ type: "Subject" }, { type: "Tag" }, ...Array.from({length: 12}, () => ({type: "Field"}))].slice(0, this.observedLimit || 6);
    }
    refresh_columns(meta, settings) { this.refreshed = [meta, settings, this.fields.slice()]; }
    set_stats() { this.fields.push("workflow_state"); }
    async setup_fields() { this.fields.push("new_field"); }
  }
  const context = vm.createContext({frappe: {views: {ListView}}, __: (s) => s});
  vm.runInContext(source, context);
  vm.runInContext(source, context); // hot reload must not wrap twice
  return ListView;
}

function result() {
  const classes = new Set();
  const properties = {};
  const attrs = {};
  return {
    0: {style: {setProperty: (k,v) => properties[k] = v, removeProperty: (k) => delete properties[k]}},
    toggleClass: (name, on) => on ? classes.add(name) : classes.delete(name),
    attr: (values) => Object.assign(attrs, values),
    removeAttr: (keys) => keys.split(" ").forEach((k) => delete attrs[k]),
    classes, properties, attrs,
  };
}

test("explicit maximum accounts for the hidden tag and restores persisted settings", () => {
  const View = environment();
  const view = new View();
  view.view_name = "List";
  view.list_view_settings = { total_fields: "12", disable_count: 1 };
  const saved = view.list_view_settings;
  view.$result = result();
  view.setup_columns();
  assert.equal(view.observedLimit, 13);
  assert.equal(view.list_view_settings, saved);
  assert.equal(saved.total_fields, "12");
  assert.equal(view.columns.length, 13);
  assert.ok(view.$result.classes.has("bt-scrollable-list"));
  assert.equal(view.$result.properties["--bt-list-min-width"], "2050px");
  assert.equal(view.$result.attrs.tabindex, "0");
  assert.equal(view.$result.attrs.role, "region");
});

test("default settings and non-list views keep native behavior", () => {
  const View = environment();
  const view = new View();
  view.view_name = "List";
  view.list_view_settings = {};
  view.$result = result();
  view.setup_columns();
  assert.equal(view.observedLimit, undefined);
  assert.equal(view.$result.classes.size, 0);
  view.view_name = "Kanban";
  view.list_view_settings = { total_fields: "12" };
  view.setup_columns();
  assert.equal(view.observedLimit, "12");
  assert.equal(view.$result.classes.size, 0);
});

test("saving rebuilds query fields and retains workflow field before native refresh", async () => {
  const View = environment();
  const view = new View();
  view.view_name = "List";
  view.fields = ["old_field"];
  const meta = {name: "Example"};
  const settings = {total_fields: "12"};
  await view.refresh_columns(meta, settings);
  assert.equal(view.refreshed[0], meta);
  assert.equal(view.refreshed[1], settings);
  assert.deepEqual(Array.from(view.refreshed[2]), ["workflow_state", "new_field"]);
});

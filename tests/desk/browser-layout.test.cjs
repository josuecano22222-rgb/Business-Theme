// Browser regression for the Frappe 15.126.1 list-row/header structure and flex rules.
// Run with CHROMIUM_PATH=/path/to/chromium npm test (requires a Chromium runtime).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { chromium } = require("playwright-core");

const app = path.resolve(__dirname, "../../business_theme");
const css = fs.readFileSync(path.join(app, "public/css/business_theme.bundle.css"), "utf8");
const built = esbuild.buildSync({
  entryPoints: [path.join(app, "public/js/business_theme.bundle.js")],
  bundle: true, write: false, format: "iife", platform: "browser",
}).outputFiles[0].text;

// Relevant Frappe v15 flex, list and responsive rules (Frappe is MIT licensed).
const nativeCSS = `
*{box-sizing:border-box} body{margin:0} .frappe-list{width:100%}
.level{display:flex;justify-content:space-between;align-items:center}
.level-left,.level-right{display:flex;flex-basis:auto;flex-grow:0;flex-shrink:0;align-items:center}
.level-left{justify-content:flex-start}.level-right{justify-content:flex-end}
.ellipsis{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.hide{display:none!important} .list-row-container{display:flex;flex-direction:column;padding:0 8px}
.list-row,.list-row-head{padding:15px 15px 15px 0;height:40px}
.list-row .level-left,.list-row-head .level-left{flex:4;min-width:80%}
.list-row .level-right,.list-row-head .level-right{flex:1;overflow:visible;align-items:center}
.list-row .tag-col,.list-row-head .tag-col{margin-left:10px;min-width:125px}
.list-row-head{height:30px;margin:8px}.list-row-head .checkbox-actions{display:none}
.list-row-col{flex:1;margin-right:15px}.list-subject{flex:2;justify-content:start}
@media(max-width:767px){.hidden-xs{display:none!important}.visible-xs{display:block!important}}
html[dir="rtl"] .list-row-col{margin-right:0;margin-left:15px}
html[dir="rtl"] .list-row .tag-col,html[dir="rtl"] .list-row-head .tag-col{margin-left:0;margin-right:10px}
html[dir="rtl"] .list-row,html[dir="rtl"] .list-row-head{padding-right:0;padding-left:15px}
`;

const nativeHarness = `
window.frappe={views:{},session:{user:'reader'},boot:{}};
window.__=(s,args)=>args?s.replace('{0}',args[0]):s;
frappe.views.ListView=class {
  get view_name(){return 'List'}
  setup_columns(){
    this.columns=[{type:'Subject',df:{fieldname:'title',label:'Title'}}, {type:'Tag'},
      ...Array.from({length:20},(_,i)=>({type:'Field',df:{fieldname:'f'+i,label:'Field '+i}}))];
  }
  render_header(){
    const cells=this.columns.map(c=>\`<div class="list-row-col ellipsis \${c.type==='Subject'?'list-subject level':'hidden-xs'} \${c.type==='Tag'?'tag-col hide':''}"><span>\${c.df?.label||c.type}</span></div>\`).join('');
    this.$result[0].innerHTML=\`<header class="level list-row-head text-muted"><div class="level-left list-header-subject">\${cells}</div><div class="level-left checkbox-actions"><div class="level list-subject">Selected</div></div><div class="level-right">3 of 3</div></header><div class="list-row-container"><div class="level list-row"><div class="level-left ellipsis">\${cells}</div><div class="level-right">now</div></div><div class="list-row-border"></div></div>\`;
  }
  toggle_tags(){this.$result[0].querySelectorAll('.tag-col').forEach(e=>e.classList.toggle('hide'))}
  refresh_columns(){}
};
window.makeView=()=>{
  const el=document.querySelector('.result');
  const view=new frappe.views.ListView();
  view.doctype='Example'; view.list_view_settings={total_fields:'25'};
  view.$result={0:el,toggleClass:(n,b)=>el.classList.toggle(n,b),attr:o=>Object.entries(o).forEach(([k,v])=>el.setAttribute(k,v))};
  view.setup_columns();view.render_header();window.cur_list=view;
};
`;

async function metrics(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.result');
    const h = root.querySelector('.list-header-subject');
    const row = root.querySelector('.list-row > .level-left');
    const rect = (el) => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,width:r.width}; };
    return {
      clientWidth: root.clientWidth, scrollWidth: root.scrollWidth,
      h: rect(h), row: rect(row),
      headerCells: [...h.children].map(rect), rowCells: [...row.children].map(rect),
      handles: root.querySelectorAll('.bt-column-resize').length,
    };
  });
}

function aligned(m) {
  m.headerCells.forEach((cell, i) => {
    assert.ok(Math.abs(cell.left - m.rowCells[i].left) < 1, `column ${i} left edge`);
    assert.ok(Math.abs(cell.width - m.rowCells[i].width) < 1, `column ${i} width`);
  });
}

test('built Desk bundle renders and resizes wide Frappe lists in Chromium', {skip: !process.env.CHROMIUM_PATH}, async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:900,height:600}});
  try {
    await page.route('http://desk.example/**', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><style>${nativeCSS}</style><style>${css}</style></head><body><div class="frappe-list"><div class="result"></div></div></body></html>`}));
    await page.goto('http://desk.example/');
    await page.addScriptTag({content:nativeHarness});
    // boot.business_theme and body.bt-desk are deliberately absent. The existing
    // Desk bundle must still activate the list feature independently.
    await page.addScriptTag({content:built});
    await page.evaluate(() => makeView());
    let m = await metrics(page);
    assert.equal(m.handles, 22);
    assert.ok(m.scrollWidth > m.clientWidth * 3, 'wide list must overflow rather than squeeze');
    assert.equal(m.headerCells[0].width, 240);
    assert.equal(m.headerCells[2].width, 150);
    aligned(m);
    assert.equal(await page.evaluate(() => frappe.business_theme_list.diagnostics().active), true);

    const first = page.locator('.list-header-subject .bt-column-resize').first();
    const box = await first.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2);
    await page.mouse.up();
    m = await metrics(page);
    assert.equal(m.headerCells[0].width, 320);
    aligned(m);
    await page.evaluate(() => makeView());
    assert.equal((await metrics(page)).headerCells[0].width, 320, 'width survives reconstruction');
    await page.locator('.list-header-subject .bt-column-resize').first().focus();
    await page.keyboard.press('Home');
    assert.equal((await metrics(page)).headerCells[0].width, 240);

    await page.evaluate(() => { cur_list.tags_shown = true; cur_list.toggle_tags(); });
    m = await metrics(page);
    aligned(m);
    assert.ok(m.headerCells[21].right <= m.h.right + 1, 'visible tag margin must not clip last column');

    await page.setViewportSize({width:360,height:600});
    m = await metrics(page);
    assert.ok(m.scrollWidth > m.clientWidth);
    assert.equal(m.headerCells[2].width, 150, 'mobile columns stay visible');
    aligned(m);

    await page.setViewportSize({width:900,height:600});
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; makeView(); });
    m = await metrics(page);
    aligned(m);
    assert.ok(m.scrollWidth > m.clientWidth);
    const rtlHandle = page.locator('.list-header-subject .bt-column-resize').first();
    const rtlBox = await rtlHandle.boundingBox();
    await page.mouse.move(rtlBox.x + rtlBox.width / 2, rtlBox.y + rtlBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rtlBox.x + rtlBox.width / 2 - 50, rtlBox.y + rtlBox.height / 2);
    await page.mouse.up();
    m = await metrics(page);
    assert.equal(m.headerCells[0].width, 290, 'RTL dragging left expands the column');
    aligned(m);
  } finally {
    await browser.close();
  }
});

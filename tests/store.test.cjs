const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('entry pages reference existing local scripts, styles and images', () => {
  for (const file of ['index.html', 'NewDrop.html', 'admin.html', '404.html']) {
    const html = fs.readFileSync(file, 'utf8');
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(https?:|#)/.test(url)) continue;
      const target = url.split('#')[0].split('?')[0].replace(/^\//, '');
      if (target) assert.ok(fs.existsSync(path.resolve(target)), `${file}: ${url}`);
    }
  }
});

test('Shop, Admin and NewDrop share the new Supabase project', () => {
  for (const file of ['index.html', 'admin.html', 'NewDrop.html']) {
    assert.match(fs.readFileSync(file, 'utf8'), /src="config\.js"/);
  }
  assert.match(fs.readFileSync('config.js', 'utf8'), /https:\/\/ixkiwzhzcivwqjebuqzt\.supabase\.co/);
  assert.match(fs.readFileSync('index.html', 'utf8'), /href="NewDrop\.html"/);
});

test('NewDrop shows released products from its own project and opens public product links', async () => {
  function element() {
    return {
      hidden: true, dataset: {}, children: [], style: {}, textContent: '', innerHTML: '',
      classList: { toggle() {} }, setAttribute() {}, append(child) { this.children.push(child); },
      replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); },
      querySelectorAll() { return []; }, showModal() { this.open = true; }, addEventListener() {},
    };
  }
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const product = { id: 'released', name: 'Jacket', category: 'jacket_damas', price: 5000, availability: 'available', image_urls: [] };
  const calls = [];
  const client = { async rpc(name) {
    calls.push(name);
    if (name === 'get_current_drop') return { data: [] };
    if (name === 'get_public_catalog' || name === 'get_public_product') return { data: [product] };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync('assets/js/pages/newdrop.js', 'utf8'), {
    document: { getElementById: get, createElement: element, querySelector: get, addEventListener() {}, querySelectorAll() { return []; } },
    console, URL, URLSearchParams, Intl, Date,
    window: {
      location: { href: 'https://store.example/NewDrop.html?prenda=released', search: '?prenda=released' },
      FUCK_FACE_CONFIG: { url: 'new', anonKey: 'public' }, supabase: { createClient: () => client },
      ProductImages: { prepare() {}, setSource() {} }, ProductMeasurements: { display() {} },
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    clearInterval() {}, setInterval() { throw new Error('No countdown for released drop'); },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(get('closedDrop').hidden, true);
  assert.equal(get('exclusiveCategories').hidden, false);
  assert.equal(get('productDialog').open, true);
  assert.equal(get('dialogName').textContent, 'Jacket');
  assert.ok(calls.includes('get_public_catalog'));
  assert.ok(calls.includes('get_public_product'));
});

for (const deepLink of [false, true]) for (const previewMode of [false, true]) test(`New Drop filters and access (admin preview: ${previewMode}, product link: ${deepLink})`, async () => {
  function element() {
    return {
      hidden: true, dataset: {}, children: [], style: {}, textContent: '', innerHTML: '',
      classList: { toggle() {} }, setAttribute(name, value) { this[name] = value; },
      append(child) { this.children.push(child); }, replaceChildren() { this.children = []; },
      appendChild(child) { this.children.push(child); }, querySelectorAll() { return []; },
      showModal() { this.open = true; },
      addEventListener(name, callback) { this[name] = callback; },
      querySelector() { return this.button ||= { disabled: false }; },
    };
  }
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const products = [
    { id: '1', category: 'pantalones', name: 'Pantalón', size: ' M ', availability: 'available' },
    { id: '2', category: 'chalecos', name: 'Chaleco', size: 'm', availability: 'available' },
    { id: '3', category: 'pantalones', name: 'Otro pantalón', size: '32', availability: 'available' },
  ];
  let tick;
  const document = {
    getElementById: get, createElement: element, addEventListener() {},
    querySelector: get,
    querySelectorAll(selector) { return selector.includes('exclusiveCategorySlider') ? get('exclusiveCategorySlider').children : []; },
  };
  const client = { async rpc(name) {
    assert.equal(previewMode, false, 'Admin preview must not call public RPCs');
    if (name === 'get_current_drop') return { data: [{ id: 'drop', exclusive_at: new Date(Date.now()-10000).toISOString(), public_at: new Date(Date.now()+60000).toISOString() }] };
    if (name === 'get_exclusive_products') return { data: products };
    return {};
  } };
  vm.runInNewContext(fs.readFileSync('assets/js/pages/newdrop.js','utf8'), {
    document, console, URL, URLSearchParams, Intl, Date,
    window: { location: { href: 'https://store.example/NewDrop.html?preview=admin&password=secret', search: `?${previewMode ? 'preview=admin&' : ''}${deepLink ? 'prenda=1' : ''}` }, DropPreview: { async load() { return { drop: { id: 'future' }, products }; }, async products() { return products; } }, FUCK_FACE_CONFIG: { url: 'test', anonKey: 'test' }, supabase: { createClient: () => client }, ProductImages: { prepare() {}, setSource() {} }, ProductMeasurements: { display() {} } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    clearInterval() {}, setInterval(callback) { tick = callback; return 1; },
  });
  await new Promise(resolve => setImmediate(resolve));
  if (!previewMode) {
    assert.ok(!get('productDialog').open, 'Exclusive product must stay closed before password entry');
    get('accessPassword').value = 'test';
    await get('accessForm').submit({ preventDefault() {} });
  }
  if (deepLink) {
    assert.equal(get('productDialog').open, true);
    assert.equal(get('dialogName').textContent, 'Pantalón');
    const message = new URL(get('dialogWhatsapp').href).searchParams.get('text');
    assert.ok(message.includes('https://store.example/NewDrop.html?prenda=1'));
    assert.ok(!message.includes('preview=') && !message.includes('password=') && !message.includes('Foto de la prenda:'));
  }
  assert.equal(get('exclusiveCategories').hidden, false);
  if (previewMode) assert.equal(tick, undefined, 'Preview must not schedule automatic release');
  else await tick();
  assert.equal(get('exclusiveCategories').hidden, false);
  assert.equal(get('accessForm').hidden, true);
  const buttons = get('exclusiveCategorySlider').children;
  assert.deepEqual(buttons.map(button => button.textContent), ['TODAS (3)', 'PANTALONES (2)', 'CHALECOS (1)']);
  get('exclusiveCategorySlider').click({ target: { closest: () => buttons[1] } });
  assert.equal(get('exclusiveResultCount').textContent, '2 PRENDAS');
  assert.equal(buttons[1]['aria-pressed'], 'true');
  get('exclusiveCategorySlider').click({ target: { closest: () => buttons[0] } });
  assert.equal(get('exclusiveResultCount').textContent, '3 PRENDAS');
  assert.equal(buttons[0]['aria-pressed'], 'true');
  assert.deepEqual(get('dropSizeFilter').children.map(option => option.textContent), ['TODAS LAS TALLAS', '32', 'M']);
  get('dropSearch').input({ target: { value: '  PANTALON  ' } });
  assert.equal(get('exclusiveResultCount').textContent, '2 PRENDAS');
  get('dropSizeFilter').change({ target: { value: 'm' } });
  assert.equal(get('exclusiveResultCount').textContent, '1 PRENDA');
  get('exclusiveCategorySlider').click({ target: { closest: () => buttons[2] } });
  assert.equal(get('exclusiveResultCount').textContent, '0 PRENDAS');
  assert.match(get('exclusiveProductGrid').innerHTML, /NO HAY PRENDAS QUE COINCIDAN/);
  get('clearDropFilters').click();
  assert.equal(get('exclusiveResultCount').textContent, '3 PRENDAS');
  assert.equal(get('dropSearch').value, '');
  assert.equal(get('dropSizeFilter').value, '');
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const reviews = require('../assets/js/shared/customer-reviews.js');
const valid = { customer_name: ' Cliente de prueba ', rating: '4', comment: ' Una experiencia de prueba. ', experience: 'delivery' };

test('reviews trim input and exclude publication state, dates and unexpected fields', () => {
  assert.deepEqual(reviews.payload({ ...valid, status: 'approved', reviewed_at: 'fake', id: 'fake', email: 'excluded' }), {
    customer_name: 'Cliente de prueba', rating: 4, comment: 'Una experiencia de prueba.', experience: 'delivery',
  });
});
test('reviews reject invalid stars, blank names, oversized text and unknown experience', () => {
  for (const patch of [{ rating: 0 }, { rating: 6 }, { rating: 1.5 }, { rating: '' }, { customer_name: '  ' }, { customer_name: 'a'.repeat(61) }, { comment: 'corto' }, { comment: 'a'.repeat(1501) }, { experience: '__proto__' }]) {
    assert.throws(() => reviews.payload({ ...valid, ...patch }));
  }
  for (let rating = 1; rating <= 5; rating++) assert.equal(reviews.payload({ ...valid, rating }).rating, rating);
});
test('review cards render customer content as text and announce star values', () => {
  const html = reviews.card({ ...reviews.payload(valid), customer_name: '<img onerror="run()">', comment: '<script>run()</script> & "texto"', created_at: '2026-11-02T05:00:00Z' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot;/);
  assert.match(html, /aria-label="4 de 5 estrellas"/);
});
function mock({ data, error } = {}) {
  const calls = [];
  const query = {};
  for (const name of ['select', 'eq', 'order', 'range', 'insert', 'update', 'single']) query[name] = (...args) => { calls.push([name, ...args]); return query; };
  query.then = (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject);
  return { calls, client: { from(table) { calls.push(['from', table]); return query; } } };
}
test('public queries explicitly request approved reviews and paginate with a lookahead row', async () => {
  const s = mock({ data: Array.from({ length: 7 }, (_, id) => ({ id })) });
  const page = await reviews.list(s.client, 'approved', 6);
  assert.equal(page.rows.length, 6); assert.equal(page.more, true);
  assert.deepEqual(s.calls.find(c => c[0] === 'eq'), ['eq', 'status', 'approved']);
  assert.deepEqual(s.calls.find(c => c[0] === 'range'), ['range', 6, 12]);
  assert.deepEqual(s.calls.filter(c => c[0] === 'order').map(c => c[1]), ['created_at', 'id']);
  await assert.rejects(reviews.list(s.client, 'fake'));
});
test('submission needs no SELECT permission on pending rows and reports database failures', async () => {
  const s = mock(); await reviews.submit(s.client, { ...valid, status: 'approved' });
  assert.equal(s.calls.filter(c => c[0] === 'select').length, 0);
  assert.deepEqual(s.calls.find(c => c[0] === 'insert')[1], reviews.payload(valid));
  await assert.rejects(reviews.submit(mock({ error: new Error('offline') }).client, valid), /offline/);
});
test('moderation changes only state and review date, detects a concurrent decision and propagates load errors', async () => {
  const s = mock({ data: { id: 'review', status: 'approved' } });
  await reviews.moderate(s.client, { id: 'review', status: 'pending' }, 'approved');
  const update = s.calls.find(c => c[0] === 'update')[1];
  assert.deepEqual(Object.keys(update).sort(), ['reviewed_at', 'status']);
  assert.ok(Number.isFinite(Date.parse(update.reviewed_at)));
  assert.deepEqual(s.calls.filter(c => c[0] === 'eq'), [['eq', 'id', 'review'], ['eq', 'status', 'pending']]);
  await assert.rejects(reviews.moderate(mock({ data: null }).client, { id: 'review', status: 'pending' }, 'rejected'), /Actualizá/);
  await assert.rejects(reviews.list(mock({ error: new Error('load failure') }).client, 'approved'), /load failure/);
});
test('Apartado y vendido includes active reservations and sold pieces once, independently of inventory filters', () => {
  const source = fs.readFileSync('assets/js/pages/admin.js', 'utf8');
  const render = source.slice(source.indexOf('  function renderReservedSold()'), source.indexOf('  document.getElementById("reservedSoldFilter")'));
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, { value: '', innerHTML: '', textContent: '' }); return nodes.get(id); };
  const products = [
    { id: 'r', name: 'Apartada prueba', availability: 'reserved', status: 'new_drop', price: 5000 },
    { id: 's', name: 'Vendida prueba', availability: 'reserved', status: 'sold', sale_price: 3000 },
    { id: 'a', name: 'Disponible prueba', availability: 'available', status: 'published', price: 5000 },
    { id: 'p', name: 'En proceso prueba', availability: 'payment_pending', status: 'published', price: 5000 },
  ];
  const context = { products, document: { getElementById: get }, window: {}, safe: reviews.escape };
  vm.runInNewContext(render + '\nthis.render = renderReservedSold;', context);
  context.render();
  assert.equal(get('reservedSoldCount').textContent, '1 APARTADAS · 1 VENDIDAS');
  assert.match(get('reservedSoldList').innerHTML, /Apartada prueba/);
  assert.match(get('reservedSoldList').innerHTML, /Vendida prueba/);
  assert.ok(!get('reservedSoldList').innerHTML.includes('Disponible prueba'));
  assert.ok(!get('reservedSoldList').innerHTML.includes('En proceso prueba'));
  get('reservedSoldFilter').value = 'sold'; context.render();
  assert.ok(!get('reservedSoldList').innerHTML.includes('Apartada prueba'));
  get('reservedSoldFilter').value = 'reserved'; context.render();
  assert.ok(!get('reservedSoldList').innerHTML.includes('Vendida prueba'));
  products[0].availability = 'available'; context.render();
  assert.equal(get('reservedSoldCount').textContent, '0 APARTADAS · 1 VENDIDAS');
});

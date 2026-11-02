const { test } = require('node:test');
const assert = require('node:assert/strict');
const chats = require('../assets/js/shared/review-chat-images.js');
const reviews = require('../assets/js/shared/customer-reviews.js');
const file = { name: 'captura.png', type: 'image/png', size: 1000 };
const values = { experience: 'both', consent: 'on' };
const admin = '10000000-0000-4000-8000-000000000001';
const imageId = '20000000-0000-4000-8000-000000000001';
function mock({ uploadError, saveError, savedAfterError = false, lookupError, signedError } = {}) {
  const calls = []; let insert;
  const bucket = {
    async upload(path, image, options) { calls.push(['upload', path, image, options]); return { error: uploadError }; },
    async remove(paths) { calls.push(['remove', paths]); return {}; },
    async createSignedUrls(paths, seconds) { calls.push(['sign', paths, seconds]); return { error: signedError, data: paths.map(path => ({ path, signedUrl: 'https://example.com/private.png?token=test' })) }; },
  };
  const client = {
    auth: { async getUser() { return { data: { user: { id: admin } } }; } },
    storage: { from(name) { assert.equal(name, 'review-chats'); return bucket; } },
    from(table) {
      assert.equal(table, 'customer_reviews');
      const q = {
        insert(value) { insert = value; calls.push(['insert', value]); return q; },
        select() { return q; }, eq() { return q; }, order() { return q; }, range() { return q; },
        async single() { return { data: saveError ? null : { id: 'review', ...insert }, error: saveError }; },
        async maybeSingle() { return { data: savedAfterError ? { id: 'review', ...insert } : null, error: lookupError }; },
      };
      q.then = resolve => Promise.resolve({ data: [{ id: 'chat', source: 'chat', image_path: admin + '/' + imageId + '.webp' }] }).then(resolve);
      return q;
    },
  };
  return { calls, client, options: { prepare: async () => [{ type: 'image/webp', size: 900 }], randomUUID: () => imageId } };
}
test('chat submission validates image and consent, and never invents a star rating', () => {
  for (const bad of [null, { ...file, type: 'image/svg+xml' }, { ...file, size: 0 }, { ...file, size: 11 * 1024 * 1024 }]) assert.throws(() => chats.validateFile(bad));
  assert.throws(() => chats.payload({ experience: 'both' }), /autorización/);
  assert.throws(() => chats.payload({ ...values, customer_name: 'a'.repeat(61) }));
  assert.deepEqual(chats.payload({ ...values, rating: 5, status: 'approved' }), { customer_name: 'Compra por chat', comment: '', experience: 'both', rating: null, source: 'chat' });
});
test('chat upload uses prepared bytes, private bucket, random filename and pending defaults', async () => {
  const s = mock(); await chats.save(s.client, values, file, s.options);
  const upload = s.calls.find(c => c[0] === 'upload');
  assert.equal(upload[1], admin + '/' + imageId + '.webp');
  assert.equal(upload[2].size, 900); assert.equal(upload[3].upsert, false);
  const inserted = s.calls.find(c => c[0] === 'insert')[1];
  assert.equal(inserted.source, 'chat'); assert.equal(inserted.rating, null); assert.equal(inserted.status, undefined);
  assert.equal(s.calls.some(c => c[0] === 'remove'), false);
});
test('a lost save response recovers the saved review and never removes its image', async () => {
  const s = mock({ saveError: new Error('lost response'), savedAfterError: true });
  const result = await chats.save(s.client, values, file, s.options);
  assert.equal(result.id, 'review'); assert.equal(s.calls.some(c => c[0] === 'remove'), false);
});
test('failed upload or save cleans only a confirmed unreferenced path', async () => {
  for (const config of [{ uploadError: new Error('upload') }, { saveError: new Error('save') }]) {
    const s = mock(config); await assert.rejects(chats.save(s.client, values, file, s.options), /confirmar/);
    assert.deepEqual(s.calls.find(c => c[0] === 'remove')[1], [admin + '/' + imageId + '.webp']);
  }
  const s = mock({ saveError: new Error('save'), lookupError: new Error('lookup') });
  await assert.rejects(chats.save(s.client, values, file, s.options));
  assert.equal(s.calls.some(c => c[0] === 'remove'), false);
});
test('reviews request short-lived signed image URLs and preserve text when Storage fails', async () => {
  const s = mock(); const page = await reviews.list(s.client, 'approved');
  assert.match(page.rows[0].image_url, /private.png/);
  assert.equal(s.calls.find(c => c[0] === 'sign')[2], 300);
  const fail = mock({ signedError: new Error('offline') });
  const unavailable = await reviews.list(fail.client, 'approved');
  assert.equal(unavailable.rows.length, 1); assert.equal(unavailable.rows[0].image_url, undefined);
});
test('chat cards identify their source, omit stars, escape captions and reject unsafe image links', () => {
  const review = { source: 'chat', rating: null, customer_name: '<Cliente>', comment: '<script>bad()</script>', created_at: '2026-11-02T12:00:00Z', image_url: 'https://example.com/capture.png?x="test"' };
  const html = reviews.card(review);
  assert.match(html, /CAPTURA AÑADIDA POR EL EQUIPO/);
  assert.ok(!html.includes('de 5 estrellas')); assert.ok(!html.includes('<script>'));
  assert.match(html, /review-chat-image/); assert.match(html, /VER CAPTURA COMPLETA/);
  const bad = reviews.card({ ...review, image_url: 'javascript:bad()' });
  assert.ok(!bad.includes('src=')); assert.match(bad, /No se pudo cargar/);
});

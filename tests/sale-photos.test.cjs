const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plan, storagePath, cleanup, cleanupDeleted } = require('../assets/js/shared/sale-photos.js');

const base = 'https://ixkiwzhzcivwqjebuqzt.supabase.co';
const folder = 'f0dfa11f-d5ad-473e-ba77-98997b89e37e';
const url = (name) => `${base}/storage/v1/object/public/product-images/${folder}/${name}.webp`;

test('sale keeps the original first image and queues each additional image once', () => {
  assert.deepEqual(plan({ image_urls: [url('first'), url('second'), url('second'), url('first'), url('third')] }),
    { kept: [url('first')], extra: [url('second'), url('third')] });
  assert.deepEqual(plan({ image_urls: [] }), { kept: [], extra: [] });
});

test('storage deletion accepts only paths in the configured product bucket', () => {
  assert.equal(storagePath(url('second'), base), `${folder}/second.webp`);
  for (const unsafe of [
    'https://other.supabase.co/storage/v1/object/public/product-images/admin/second.webp',
    `${base}/storage/v1/object/public/other-bucket/admin/second.webp`,
    `${url('second')}?download=1`,
    `${base}/storage/v1/object/public/product-images/admin/%2e%2e/other.webp`,
  ]) assert.equal(storagePath(unsafe, base), null);
});

test('cleanup deletes only unshared valid extras and preserves failed candidates for retry', async () => {
  const shared = url('shared'), removable = url('remove'), foreign = 'https://other.example/photo.webp';
  const removed = [];
  let saved;
  const client = {
    from(table) {
      assert.equal(table, 'products');
      return {
        select() { return this; }, contains(column, values) { assert.equal(column, 'image_urls'); this.url = values[0]; return this; },
        neq() { return this; }, limit() { return Promise.resolve({ data: this.url === shared ? [{ id: 'other' }] : [], error: null }); },
        update(value) { saved = value; return this; }, eq() { return this; },
        single() { return Promise.resolve({ data: { id: 'sold', updated_at: saved.updated_at, image_cleanup_pending: saved.image_cleanup_pending }, error: null }); },
      };
    },
    storage: { from(bucket) { assert.equal(bucket, 'product-images'); return { async remove(paths) { removed.push(...paths); return { error: null }; } }; } },
  };
  const result = await cleanup(client, { id: 'sold', updated_at: '2026-09-29T00:00:00Z', image_cleanup_pending: [shared, removable, foreign] }, base);
  assert.deepEqual(removed, [`${folder}/remove.webp`]);
  assert.deepEqual(result.product.image_cleanup_pending, [shared, foreign]);
  assert.equal(result.remaining, 2);
});

test('cleanup never deletes the retained first image and queues Storage failures', async () => {
  const first = url('first'), failed = url('failed');
  const removed = [];
  let saved;
  const client = {
    from() { return {
      select() { return this; }, contains() { return this; }, neq() { return this; }, limit() { return Promise.resolve({ data: [], error: null }); },
      update(value) { saved = value; return this; }, eq() { return this; }, single() { return Promise.resolve({ data: saved, error: null }); },
    }; },
    storage: { from() { return { async remove(paths) { removed.push(...paths); return { error: new Error('Storage unavailable') }; } }; } },
  };
  const result = await cleanup(client, { id: 'sold', updated_at: '2026-09-29T00:00:00Z', image_urls: [first], image_cleanup_pending: [first, failed] }, base);
  assert.deepEqual(removed, [`${folder}/failed.webp`]);
  assert.deepEqual(result.product.image_cleanup_pending, [first, failed]);
});

test('deleted product cleanup removes files and clears its retry job', async () => {
  const removed = [], deletedJobs = [];
  const client = {
    from(table) {
      if (table === 'products') return { select() { return this; }, contains() { return this; }, limit() { return Promise.resolve({ data: [], error: null }); } };
      assert.equal(table, 'deleted_product_images');
      return { delete() { return this; }, eq(column, value) { deletedJobs.push([column, value]); return this; }, select() { return this; }, single() { return Promise.resolve({ data: { id: 'job-1' }, error: null }); } };
    },
    storage: { from() { return { async remove(paths) { removed.push(...paths); return { error: null }; } }; } },
  };
  const remaining = await cleanupDeleted(client, { id: 'job-1', urls: [url('one'), url('two')] }, base);
  assert.equal(remaining, 0);
  assert.deepEqual(removed, [`${folder}/one.webp`, `${folder}/two.webp`]);
  assert.deepEqual(deletedJobs, [['id', 'job-1']]);
});

test('cleanup preserves a photo referenced by a saved product and closes the job', async () => {
  let deleted = false;
  const client = {
    from(table) {
      if (table === 'products') return { select() { return this; }, contains() { return this; }, limit() { return Promise.resolve({ data: [{ id: 'still-active' }], error: null }); } };
      return { delete() { deleted = true; return this; }, eq() { return this; }, select() { return this; }, single() { return Promise.resolve({ error: null }); } };
    },
    storage: { from() { throw new Error('Shared photo must never be deleted'); } },
  };
  const remaining = await cleanupDeleted(client, { id: 'job-1', urls: [url('shared')] }, base);
  assert.equal(remaining, 0);
  assert.equal(deleted, true);
});

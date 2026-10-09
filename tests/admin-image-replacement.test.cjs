const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const SalePhotos = require('../assets/js/shared/sale-photos.js');
const source = fs.readFileSync('assets/js/pages/admin.js', 'utf8');
const helper = source.slice(source.indexOf('  async function saveProductEdits('), source.indexOf('  const editDialog ='));
const base = 'https://example.com';
const url = name => `${base}/storage/v1/object/public/product-images/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/${name}.webp`;

function setup({ conflict = false, ambiguous = false, queueFailure = false, cleanupFailure = false, shared = false, uploadFailure = false } = {}) {
  const original = { id: 'piece', status: 'published', updated_at: 'before', name: 'Jacket', image_urls: [url('old')] };
  let current = structuredClone(original);
  const jobs = new Map(), removed = [], events = [];
  let uploads = 0;
  const client = {
    from(table) {
      let action, values, contains, filters = {};
      const query = {
        insert(value) { action = 'insert'; values = value; return this; },
        update(value) { action = 'update'; values = value; return this; },
        delete() { action = 'delete'; return this; },
        select() { return this; },
        eq(key, value) { filters[key] = value; return this; },
        contains(key, value) { contains = value[0]; return this; },
        async limit() { return { data: current.image_urls.includes(contains) || (shared && contains === url('old')) ? [{ id: 'reference' }] : [], error: null }; },
        async single() {
          if (table === 'products') {
            events.push('update');
            assert.equal(filters.id, original.id);
            assert.equal(filters.status, original.status);
            assert.equal(filters.updated_at, original.updated_at);
            if (conflict) return { data: null, error: new Error('Concurrent sale') };
            current = { ...current, ...values };
            if (ambiguous) throw new Error('Network response lost');
            return { data: current, error: null };
          }
          assert.equal(table, 'deleted_product_images');
          if (action === 'insert') {
            events.push('queue-old');
            if (queueFailure) return { error: new Error('Queue unavailable') };
            const job = { id: 'old-job', ...values };
            assert.ok(Date.parse(job.available_at) > Date.now() + 3500000);
            jobs.set(job.id, job);
            return { data: job };
          }
          if (action === 'delete') jobs.delete(filters.id);
          if (action === 'update') Object.assign(jobs.get(filters.id), values);
          return { data: { id: filters.id } };
        },
      };
      return query;
    },
    storage: { from() { return { async remove(paths) {
      events.push('remove');
      if (cleanupFailure) return { error: new Error('Storage unavailable') };
      removed.push(...paths);
      return {};
    } }; } },
  };
  const context = {
    client, config: { url: base }, window: { SalePhotos }, console: { warn() {} },
    async uploadImages() {
      uploads++;
      if (uploadFailure) throw new Error('Invalid photo');
      events.push('upload');
      const cleanupJob = { id: 'new-job', urls: [url('new')] };
      jobs.set(cleanupJob.id, cleanupJob);
      return { urls: cleanupJob.urls, cleanupJob };
    },
  };
  vm.runInNewContext(helper + '\nthis.save = saveProductEdits;', context);
  return { save: (files = [{}]) => context.save(original, { name: 'Updated' }, files, () => {}), jobs, removed, events, current: () => current, uploads: () => uploads };
}

test('editing without files preserves photos and does not create upload or cleanup jobs', async () => {
  const s = setup(); const result = await s.save([]);
  assert.deepEqual(result.product.image_urls, [url('old')]);
  assert.equal(result.photosReplaced, false); assert.equal(s.uploads(), 0); assert.equal(s.jobs.size, 0);
});
test('replacement uploads and queues old photos before conditional save, then removes only unused old photos', async () => {
  const s = setup(); const result = await s.save();
  assert.equal(result.product.image_urls[0], url('new'));
  assert.equal(result.photosReplaced, true); assert.equal(result.cleanupPending, false);
  assert.deepEqual(s.events.slice(0, 3), ['upload', 'queue-old', 'update']);
  assert.equal(s.removed.length, 1); assert.ok(s.removed[0].endsWith('/old.webp')); assert.equal(s.jobs.size, 0);
});
test('concurrent product change keeps previous photos and cleans the unused new upload', async () => {
  const s = setup({ conflict: true }); await assert.rejects(s.save(), /otra sesión/);
  assert.equal(s.current().image_urls[0], url('old'));
  assert.equal(s.removed.length, 1); assert.ok(s.removed[0].endsWith('/new.webp')); assert.equal(s.jobs.size, 0);
});
test('lost response after a committed save never deletes referenced new photos', async () => {
  const s = setup({ ambiguous: true }); await assert.rejects(s.save(), /Network response lost/);
  assert.equal(s.current().image_urls[0], url('new'));
  assert.equal(s.removed.length, 1); assert.ok(s.removed[0].endsWith('/old.webp'));
});
test('failure to queue old photos aborts replacement and cleans unused new upload', async () => {
  const s = setup({ queueFailure: true }); await assert.rejects(s.save(), /Queue unavailable/);
  assert.equal(s.current().image_urls[0], url('old')); assert.ok(!s.events.includes('update'));
  assert.equal(s.removed.length, 1); assert.ok(s.removed[0].endsWith('/new.webp'));
});
test('storage failure retains a retry job while keeping the successful replacement', async () => {
  const s = setup({ cleanupFailure: true }); const result = await s.save();
  assert.equal(result.product.image_urls[0], url('new')); assert.equal(result.cleanupPending, true);
  assert.equal(s.jobs.size, 1); assert.ok(s.jobs.has('old-job')); assert.equal(s.removed.length, 0);
});
test('old photos referenced by another product survive replacement', async () => {
  const s = setup({ shared: true }); await s.save();
  assert.equal(s.removed.length, 0); assert.equal(s.jobs.size, 0);
});
test('invalid photo preparation stops replacement before modifying product data', async () => {
  const s = setup({ uploadFailure: true }); await assert.rejects(s.save(), /Invalid photo/);
  assert.equal(s.current().image_urls[0], url('old')); assert.equal(s.jobs.size, 0); assert.equal(s.events.length, 0);
});

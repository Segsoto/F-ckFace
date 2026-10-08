const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/pages/admin.js', 'utf8');
const uploadFunction = source.slice(source.indexOf('  async function uploadImages('), source.indexOf('  function numberOrNull('));
function setup(prepare, uploadErrorAt = -1) {
  const uploads = [], queued = [], removed = [], context = { window: { ImageCompression: { prepare }, SalePhotos: {
    async cleanupDeleted(client, job) { removed.push(...job.urls); return 0; }
  } }, config: { url: 'https://example.com' }, filename: name => name,
    crypto: { randomUUID: () => 'unique' }, client: {
      auth: { async getUser() { return { data: { user: { id: 'admin' } } }; } },
      from(table) { assert.equal(table, 'deleted_product_images'); return {
        insert(job) { queued.push(job); return this; }, select() { return this; },
        async single() { return { data: { id: 'job-1', urls: queued.at(-1).urls }, error: null }; }
      }; },
      storage: { from(bucket) { assert.equal(bucket, 'product-images'); return {
        async upload(path, file, options) { uploads.push({ path, file, options }); return { error: uploads.length === uploadErrorAt ? new Error('Upload failed') : null }; },
        getPublicUrl(path) { return { data: { publicUrl: `https://example.com/${path}` } }; }
      }; } }
    } };
  vm.runInNewContext(uploadFunction + '\nthis.runUpload = uploadImages;', context);
  return { run: context.runUpload, uploads, queued, removed };
}
test('admin uploads only compressed bytes with correct extension and content type', async () => {
  const compressed = new File([new Uint8Array(200000)], 'foto.webp', { type: 'image/webp' });
  const s = setup(async (files, progress) => { progress(1, 1); return [compressed]; });
  const progress = [];
  const result = await s.run([new File([new Uint8Array(5000000)], 'foto.jpg', { type: 'image/jpeg' })], text => progress.push(text));
  assert.equal(s.uploads.length, 1); assert.equal(s.uploads[0].file, compressed);
  assert.ok(s.uploads[0].path.endsWith('.webp')); assert.equal(s.uploads[0].options.contentType, 'image/webp');
  assert.equal(s.uploads[0].options.cacheControl, '86400');
  assert.equal(result.optimizedBytes, 200000); assert.equal(result.originalBytes, 5000000);
  assert.equal(s.queued.length, 1); assert.equal(s.queued[0].urls[0], result.urls[0]);
  assert.equal(result.cleanupJob.id, 'job-1');
  assert.ok(progress.some(text => text.includes('COMPRIMIENDO')));
});
test('admin sends no original or partial selection if compression fails', async () => {
  const s = setup(async () => { throw new Error('Invalid image'); });
  await assert.rejects(s.run([{}], () => {}), /Invalid image/); assert.equal(s.uploads.length, 0);
  assert.equal(s.queued.length, 0);
});
test('admin queues all image paths before uploading and cleans a partial failed upload', async () => {
  const files = [1, 2].map(i => new File([new Uint8Array(5)], `${i}.webp`, { type: 'image/webp' }));
  const s = setup(async () => files, 2);
  await assert.rejects(s.run(files, () => {}), /Upload failed/);
  assert.equal(s.queued.length, 1);
  assert.equal(s.queued[0].urls.length, 2);
  assert.equal(s.removed.length, 2);
});

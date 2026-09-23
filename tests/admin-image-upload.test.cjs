const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('assets/js/pages/admin.js', 'utf8');
const uploadFunction = source.slice(source.indexOf('  async function uploadImages('), source.indexOf('  function numberOrNull('));
function setup(prepare) {
  const uploads = [], context = { window: { ImageCompression: { prepare } }, filename: name => name,
    crypto: { randomUUID: () => 'unique' }, client: {
      auth: { async getUser() { return { data: { user: { id: 'admin' } } }; } },
      storage: { from(bucket) { assert.equal(bucket, 'product-images'); return {
        async upload(path, file, options) { uploads.push({ path, file, options }); return { error: null }; },
        getPublicUrl(path) { return { data: { publicUrl: `https://example.com/${path}` } }; }
      }; } }
    } };
  vm.runInNewContext(uploadFunction + '\nthis.runUpload = uploadImages;', context);
  return { run: context.runUpload, uploads };
}
test('admin uploads only compressed bytes with correct extension and content type', async () => {
  const compressed = new File([new Uint8Array(200000)], 'foto.webp', { type: 'image/webp' });
  const s = setup(async (files, progress) => { progress(1, 1); return [compressed]; });
  const progress = [];
  const result = await s.run([new File([new Uint8Array(5000000)], 'foto.jpg', { type: 'image/jpeg' })], text => progress.push(text));
  assert.equal(s.uploads.length, 1); assert.equal(s.uploads[0].file, compressed);
  assert.ok(s.uploads[0].path.endsWith('.webp')); assert.equal(s.uploads[0].options.contentType, 'image/webp');
  assert.equal(result.optimizedBytes, 200000); assert.equal(result.originalBytes, 5000000);
  assert.ok(progress.some(text => text.includes('COMPRIMIENDO')));
});
test('admin sends no original or partial selection if compression fails', async () => {
  const s = setup(async () => { throw new Error('Invalid image'); });
  await assert.rejects(s.run([{}], () => {}), /Invalid image/); assert.equal(s.uploads.length, 0);
});

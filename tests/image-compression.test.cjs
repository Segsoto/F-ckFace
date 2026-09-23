const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup({ width = 4000, height = 3000, size = 200000, webp = true, failure = false } = {}) {
  const calls = [], canvases = []; let closed = 0, opened = 0, active = 0, peak = 0;
  const window = {};
  vm.runInNewContext(fs.readFileSync('assets/js/shared/image-compression.js', 'utf8'), {
    window, File,
    async createImageBitmap() { opened++; active++; peak = Math.max(peak, active); return { width, height, close() { closed++; active--; } }; },
    document: { createElement() {
      const canvas = { width: 0, height: 0, getContext() { return { clearRect() {}, fillRect() {}, drawImage() {} }; },
        toBlob(callback, type, quality) {
          calls.push({ width: this.width, height: this.height, type, quality });
          callback(failure ? null : new Blob([new Uint8Array(typeof size === 'function' ? size(this, quality) : size)],
            { type: !webp && type === 'image/webp' ? 'image/png' : type }));
        } };
      canvases.push(canvas); return canvas;
    } }
  });
  return { api: window.ImageCompression, calls, canvases, counts: () => ({ closed, opened, peak }) };
}
const photo = (bytes = 2000000, name = 'prenda.jpeg', type = 'image/jpeg') => new File([new Uint8Array(bytes)], name, { type });
test('large photo becomes WebP below limit, proportional and no larger than 1600px', async () => {
  const s = setup(); const result = await s.api.compress(photo());
  assert.equal(result.type, 'image/webp'); assert.equal(result.name, 'prenda.webp'); assert.ok(result.size <= 300000);
  assert.deepEqual([s.calls[0].width, s.calls[0].height], [1600, 1200]);
  assert.equal(s.counts().closed, 1); assert.equal(s.canvases[0].width, 1);
});
test('small bytes do not bypass oversized dimension reduction', async () => {
  const s = setup({ width: 3000, height: 1000, size: 100000 });
  const result = await s.api.compress(photo(200000)); assert.equal(result.type, 'image/webp'); assert.equal(s.calls[0].width, 1600);
});
test('already small photos are not enlarged or recompressed', async () => {
  const s = setup({ width: 800, height: 600 }); const result = await s.api.compress(photo(80000));
  assert.equal(result.size, 80000); assert.equal(result.type, 'image/jpeg'); assert.equal(s.calls.length, 0); assert.equal(s.counts().closed, 1);
});
test('JPEG fallback uses matching MIME and filename when WebP encoder is unavailable', async () => {
  const s = setup({ webp: false }); const result = await s.api.compress(photo());
  assert.equal(result.type, 'image/jpeg'); assert.equal(result.name, 'prenda.jpg');
});
test('hard-to-compress image is resized further until under the limit', async () => {
  const s = setup({ size: canvas => canvas.width > 1100 ? 400000 : 250000 });
  const result = await s.api.compress(photo()); assert.equal(result.size, 250000);
  assert.ok(s.calls.some(c => c.width < 1600));
});
test('uncompressible images fail without returning an oversized upload', async () => {
  const s = setup({ size: 400000 }); await assert.rejects(s.api.compress(photo()), /300 KB/); assert.equal(s.counts().closed, 1);
});
test('entire selection is validated before any image is decoded', async () => {
  const s = setup(); await assert.rejects(s.api.prepare([photo(), photo(1000, 'x.heic', 'image/heic')]), /HEIC/);
  assert.equal(s.counts().opened, 0);
  await assert.rejects(s.api.prepare(Array.from({ length: 8 }, () => photo(1000))), /1 y 7/);
});
test('files compress sequentially and encoding failures release memory', async () => {
  const s = setup(); const progress = []; await s.api.prepare([photo(), photo()], (i, n) => progress.push([i, n]));
  assert.equal(s.counts().peak, 1); assert.deepEqual(progress, [[1, 2], [2, 2]]);
  const broken = setup({ failure: true }); await assert.rejects(broken.api.compress(photo()), /comprimir/); assert.equal(broken.counts().closed, 1);
});

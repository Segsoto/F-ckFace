const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(root, 'storage-cleanup-audit-20260922.json')));
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'storage-cleanup-baseline-20260922.json')));
const source = fs.readFileSync(path.join(root, 'tools/cleanup-orphan-images.cjs'), 'utf8');
async function simulate({ execute = false, changeReference = false, restricted = false, changeObject = false } = {}) {
  const deleted = [], writes = [], errors = [];
  const objects = new Map(audit.objects.filter(o => !o.name.startsWith('61711c70-')).map(o => [o.name, {
    ...o, metadata: { size: o.bytes }
  }]));
  if (changeObject) objects.get(audit.candidates.find(o => objects.has(o.name)).name).id = 'replacement-id';
  let inventoryReads = 0;
  const processMock = { argv: ['node', 'cleanup', ...(execute ? ['--execute'] : [])],
    env: { SUPABASE_SERVICE_ROLE_KEY: 'test-only-not-a-real-key' }, exitCode: 0 };
  await vm.runInNewContext(source, {
    __dirname: path.join(root, 'tools'), process: processMock, URL, AbortSignal,
    require(name) { return name === 'node:fs' ? {
      readFileSync: (...args) => fs.readFileSync(...args), writeFileSync: (file, data) => writes.push({ file, data })
    } : require(name); },
    console: { log() {}, error(message) { errors.push(message); } },
    async fetch(url, options) {
      if (restricted) return { ok: false, status: 402 };
      const u = new URL(url); let response;
      if (u.pathname === '/rest/v1/products') {
        inventoryReads++;
        response = structuredClone(baseline.products);
        if (changeReference && inventoryReads >= 2) {
          response[0].image_urls.push('https://zfyotvnrvfbegfrmjygo.supabase.co/storage/v1/object/public/product-images/' + audit.candidates.find(o => objects.has(o.name)).name);
        }
      } else if (options.method === 'DELETE') {
        const { prefixes } = JSON.parse(options.body);
        const protectedNames = new Set(baseline.products.flatMap(p => p.image_urls).map(u => decodeURIComponent(u.split('/product-images/')[1])));
        for (const name of prefixes) {
          assert.ok(!protectedNames.has(name), 'A referenced photo must never be deleted');
          assert.ok(objects.has(name)); deleted.push(name); objects.delete(name);
        }
        response = prefixes.map(name => ({ name }));
      } else {
        const { prefix, offset, limit } = JSON.parse(options.body);
        response = prefix ? [...objects.values()].filter(o => o.name.startsWith(prefix + '/')).map(o => ({ ...o, name: o.name.slice(prefix.length + 1) }))
          : [...new Set([...objects.keys()].map(n => n.split('/')[0]))].map(name => ({ name, id: null }));
        response.sort((a, b) => a.name.localeCompare(b.name));
        response = response.slice(offset, offset + limit);
      }
      return { ok: true, json: async () => response };
    }
  });
  return { deleted, writes, errors, code: processMock.exitCode, remaining: objects.size, inventoryReads };
}
test('cleanup dry run checks twice without deleting', async () => {
  const r = await simulate(); assert.equal(r.code, 0); assert.equal(r.deleted.length, 0); assert.equal(r.inventoryReads, 2);
});
test('cleanup deletes exactly 390 remaining audited orphans and preserves 247 images', async () => {
  const r = await simulate({ execute: true }); assert.equal(r.code, 0, r.errors.join());
  assert.equal(r.deleted.length, 390); assert.equal(r.remaining, 247); assert.equal(r.writes.length, 2);
});
test('cleanup aborts if a candidate acquires a product reference', async () => {
  const r = await simulate({ execute: true, changeReference: true }); assert.equal(r.code, 1); assert.equal(r.deleted.length, 0);
});
test('cleanup aborts if an audited object was replaced', async () => {
  const r = await simulate({ execute: true, changeObject: true }); assert.equal(r.code, 1); assert.equal(r.deleted.length, 0);
});
test('cleanup stops on quota HTTP 402 without attempting deletion', async () => {
  const r = await simulate({ execute: true, restricted: true }); assert.equal(r.code, 1); assert.equal(r.deleted.length, 0);
  assert.ok(r.errors[0].includes('402'));
});

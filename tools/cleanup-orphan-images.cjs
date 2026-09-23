// One-time cleanup of the exact audited files. Dry run unless --execute is supplied.
// Pass the existing service-role key through SUPABASE_SERVICE_ROLE_KEY, never source control.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const audit = JSON.parse(fs.readFileSync(path.join(root, 'storage-cleanup-audit-20260922.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'storage-cleanup-baseline-20260922.json'), 'utf8'));
const base = 'https://zfyotvnrvfbegfrmjygo.supabase.co';
const bucket = 'product-images';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const execute = process.argv.includes('--execute');
function canonical(value) {
  return JSON.stringify(value, (k, v) => {
    if (k.endsWith('_at') && typeof v === 'string') return new Date(v).toISOString();
    return v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v;
  });
}
async function api(route, options = {}) {
  const response = await fetch(base + route, { ...options, redirect: 'error',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Supabase returned HTTP ${response.status}; stopped.`);
  return response.json();
}
async function inventory() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await api(`/rest/v1/products?select=*&order=id&limit=500&offset=${offset}`);
    rows.push(...page);
    if (page.length < 500) break;
  }
  assert.equal(canonical(rows), canonical(baseline.products), 'Inventory changed since audit; stopped.');
  return rows;
}
async function list(prefix) {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const page = await api(`/storage/v1/object/list/${bucket}`, { method: 'POST',
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }) });
    rows.push(...page);
    if (page.length < 100) break;
  }
  return rows;
}
async function objects() {
  const rows = [];
  async function visit(prefix) {
    for (const item of await list(prefix)) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) await visit(name);
      else rows.push({ ...item, name });
    }
  }
  await visit('');
  return rows;
}
function referencedPaths(rows) {
  return new Set(rows.flatMap(p => p.image_urls).map(raw => {
    const u = new URL(raw), prefix = `/storage/v1/object/public/${bucket}/`;
    assert.equal(u.origin, base, 'Unrecognized image origin.');
    assert.ok(u.pathname.startsWith(prefix), 'Unrecognized image URL.');
    return decodeURIComponent(u.pathname.slice(prefix.length));
  }));
}
function unchangedObject(actual, old) {
  assert.ok(actual, 'An audited image is missing.');
  assert.equal(actual.id, old.id, 'Object identity changed.');
  assert.equal(Number(actual.metadata.size), old.bytes, 'Object size changed.');
  assert.equal(Date.parse(actual.updated_at), Date.parse(old.updated_at), 'Object was modified.');
}
async function main() {
  assert.ok(key, 'Provide SUPABASE_SERVICE_ROLE_KEY in the process environment.');
  assert.equal(audit.project, 'zfyotvnrvfbegfrmjygo');
  const rows = await inventory(), refs = referencedPaths(rows);
  const first = await objects(), firstMap = new Map(first.map(o => [o.name, o]));
  const audited = new Map(audit.objects.map(o => [o.name, o]));
  const candidates = audit.candidates.filter(o => firstMap.has(o.name));
  for (const name of refs) unchangedObject(firstMap.get(name), audited.get(name));
  for (const o of candidates) {
    assert.ok(!refs.has(o.name), 'A candidate is referenced.');
    assert.ok(Date.parse(o.created_at) < Date.parse(audit.checkedAt) - 86400000, 'Recent upload excluded.');
    unchangedObject(firstMap.get(o.name), o);
  }
  // Second full read immediately before deletion; fail closed on any inventory or object change.
  const second = await objects();
  assert.equal(canonical(second.sort((a,b) => a.name.localeCompare(b.name))),
    canonical(first.sort((a,b) => a.name.localeCompare(b.name))), 'Storage changed between checks.');
  const freshRefs = referencedPaths(await inventory());
  assert.ok(candidates.every(o => !freshRefs.has(o.name)), 'A candidate became referenced.');
  const report = { checkedAt: new Date().toISOString(), execute, products: rows.length,
    protectedPhotos: refs.size, candidates: candidates.length, bytes: candidates.reduce((n,o) => n+o.bytes,0) };
  console.log(JSON.stringify(report));
  const totalBytes = first.reduce((n, o) => n + Number(o.metadata.size), 0);
  console.log(JSON.stringify({ GBactuales: +(totalBytes / 1e9).toFixed(3),
    GBaLiberar: +(report.bytes / 1e9).toFixed(3),
    porcentajeALiberar: totalBytes ? +(100 * report.bytes / totalBytes).toFixed(2) : 0,
    GBrestantes: +((totalBytes - report.bytes) / 1e9).toFixed(3) }));
  if (!execute) console.log('Solo revisión; no se borró ninguna foto.');
  if (!execute || !candidates.length) return;
  assert.ok(candidates.length <= 562 && candidates.length <= 1000);
  fs.writeFileSync(path.join(root, 'storage-cleanup-pending-20260922.json'), JSON.stringify({
    checkedAt: report.checkedAt, candidates: candidates.map(o => ({ id: o.id, name: o.name, bytes: o.bytes }))
  }, null, 2));
  await api(`/storage/v1/object/${bucket}`, { method: 'DELETE',
    body: JSON.stringify({ prefixes: candidates.map(o => o.name) }) });
  await inventory();
  const after = await objects(), afterMap = new Map(after.map(o => [o.name, o]));
  for (const name of refs) unchangedObject(afterMap.get(name), audited.get(name));
  assert.ok(candidates.every(o => !afterMap.has(o.name)), 'Some candidates remain. Do not retry blindly.');
  report.remainingFiles = after.length;
  report.remainingBytes = after.reduce((n,o) => n+Number(o.metadata.size),0);
  report.deleted = candidates.map(o => ({ id:o.id, name:o.name, bytes:o.bytes }));
  fs.writeFileSync(path.join(root, 'storage-cleanup-result-20260922.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify({ deleted: candidates.length, preserved: refs.size, remainingBytes: report.remainingBytes }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

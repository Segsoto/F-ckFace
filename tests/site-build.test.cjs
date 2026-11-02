const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildSite } = require('../tools/build-site.cjs');

test('deployment output preserves public routes and excludes internal files and the separate app', (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-public-build-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const output = buildSite(path.join(temporary, 'public'));
  const entries = fs.readdirSync(output);
  assert.ok(entries.includes('NewDrop.html'));
  assert.ok(!entries.includes('newdrop.html'));
  for (const name of ['docs', 'supabase', 'tools', 'tests', 'Camisadel10', 'AGENTS.md', 'README.md', 'package.json', 'supabase-schema.sql', 'storage-cleanup-audit-20260922.json']) {
    assert.ok(!fs.existsSync(path.join(output, name)), name + ' must not be public');
  }
  for (const page of ['index.html', 'admin.html', 'NewDrop.html', '404.html']) {
    for (const [, url] of fs.readFileSync(path.join(output, page), 'utf8').matchAll(/(?:src|href)="([^\"]+)"/g)) {
      if (/^(https?:|#)/.test(url)) continue;
      const resource = url.split(/[?#]/)[0].replace(/^\//, '');
      assert.ok(fs.existsSync(path.join(output, resource)), page + ': ' + resource);
    }
  }
});

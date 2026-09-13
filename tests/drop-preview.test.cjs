const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture({ user = { id: 'admin' }, profile = { user_id: 'admin' }, drop = { id: 'future-drop' }, error = null } = {}) {
  const calls = [];
  const window = {};
  vm.runInNewContext(fs.readFileSync('assets/js/shared/drop-preview.js', 'utf8'), { window });
  const client = {
    auth: { async getUser() { return { data: { user } }; } },
    from(table) {
      calls.push(['from', table]);
      const query = {
        select(value) { calls.push(['select', value]); return this; },
        eq(key, value) { calls.push(['eq', key, value]); return this; },
        order() { return this; }, limit() { return this; },
        maybeSingle() { return this; },
        then(resolve, reject) { return Promise.resolve({ data: table === 'admin_profiles' ? profile : table === 'drops' ? (drop ? [drop] : []) : [{ id: 'pants' }], error: table === 'products' ? error : null }).then(resolve, reject); },
      };
      return query;
    },
    rpc() { throw new Error('Preview must never invoke publishing RPCs'); },
  };
  return { api: window.DropPreview, client, calls };
}

test('preview authorizes admin and only reads unpublished pieces from active drop', async () => {
  const { api, client, calls } = fixture();
  const result = await api.load(client);
  assert.equal(result.drop.id, 'future-drop');
  assert.equal(result.products.length, 1);
  assert.ok(calls.some(call => call.join(':') === 'eq:drop_id:future-drop'));
  assert.ok(calls.some(call => call.join(':') === 'eq:status:new_drop'));
});
test('preview rejects absent sessions and users without administrator authorization', async () => {
  for (const options of [{ user: null }, { profile: null }]) {
    const { api, client, calls } = fixture(options);
    await assert.rejects(api.load(client));
    assert.ok(!calls.some(call => call[1] === 'products' || call[1] === 'drops'));
  }
});
test('preview handles no active drop and query errors', async () => {
  const empty = fixture({ drop: null });
  assert.equal((await empty.api.load(empty.client)).products.length, 0);
  const failed = fixture({ error: { message: 'Denied' } });
  await assert.rejects(failed.api.load(failed.client));
});

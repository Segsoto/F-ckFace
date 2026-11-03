const { test } = require('node:test');
const assert = require('node:assert/strict');
const deletion = require('../assets/js/shared/review-deletion.js');
const image = '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.png';
function mock({ chat = false, conflict = false, lostResponse = false, storageFailure = false, silentlyKept = false, referenced = false, lookupFailure = false } = {}) {
  const calls = [], objects = new Set(chat ? [image] : []), jobs = new Map();
  let exists = true;
  const review = { id: 'review', status: 'pending', reviewed_at: null, image_path: chat ? image : null };
  const client = {
    storage: { from(bucket) { assert.equal(bucket, 'review-chats'); return { async remove(paths) {
      calls.push(['remove', paths]);
      if (storageFailure) return { error: new Error('Storage offline') };
      if (!silentlyKept) paths.forEach(path => objects.delete(path));
      return {};
    } }; } },
    from(table) {
      let action = 'select'; const filters = {};
      const query = {
        select() { return query; }, order() { return query; }, limit() { return query; },
        delete() { action = 'delete'; calls.push(['delete', table]); return query; },
        eq(key, value) { filters[key] = value; calls.push(['eq', table, key, value]); return query; },
        is(key, value) { filters[key] = value; calls.push(['is', table, key, value]); return query; },
        async single() {
          if (table === 'customer_reviews') {
            if (conflict) return { error: new Error('Changed state') };
            exists = false;
            if (chat) jobs.set('job', { id: 'job', review_id: 'review', image_path: image });
            if (lostResponse) return { error: new Error('Lost response') };
            return { data: { id: 'review', image_path: review.image_path } };
          }
          assert.equal(table, 'review_image_cleanup');
          const job = jobs.get(filters.id);
          if (!job || objects.has(job.image_path)) return { error: new Error('Object still exists') };
          jobs.delete(job.id); return { data: { id: job.id } };
        },
        then(resolve, reject) {
          const result = table === 'review_image_cleanup'
            ? { data: [...jobs.values()].filter(job => !filters.review_id || job.review_id === filters.review_id) }
            : lookupFailure ? { error: new Error('Lookup failed') } : { data: referenced ? [{ id: 'another-review' }] : [] };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, review, calls, jobs, objects, exists: () => exists };
}
test('deleting a written review checks state and null review date without touching Storage', async () => {
  const s = mock(); const result = await deletion.remove(s.client, s.review);
  assert.equal(result.cleanupPending, false); assert.equal(s.exists(), false);
  assert.ok(s.calls.some(c => c[0] === 'is' && c[2] === 'reviewed_at' && c[3] === null));
  assert.ok(s.calls.some(c => c[0] === 'eq' && c[2] === 'status' && c[3] === 'pending'));
  assert.equal(s.calls.some(c => c[0] === 'remove'), false);
});
test('deleting a chat cleans its server-returned queued image and closes the job', async () => {
  const s = mock({ chat: true }); const result = await deletion.remove(s.client, { ...s.review, image_path: 'stale-client-value' });
  assert.equal(result.cleanupPending, false); assert.equal(s.jobs.size, 0); assert.equal(s.objects.size, 0);
  assert.deepEqual(s.calls.find(c => c[0] === 'remove')[1], [image]);
});
test('conflict prevents cleanup and reviewed date participates in the conditional delete', async () => {
  const s = mock({ chat: true, conflict: true });
  await assert.rejects(deletion.remove(s.client, { ...s.review, reviewed_at: '2026-11-02T12:00:00Z' }), /Actualizá/);
  assert.equal(s.exists(), true); assert.equal(s.calls.some(c => c[0] === 'remove'), false);
  assert.ok(s.calls.some(c => c[0] === 'eq' && c[2] === 'reviewed_at' && c[3] === '2026-11-02T12:00:00Z'));
});
test('Storage failure keeps the deletion and durable cleanup job for a later attempt', async () => {
  const s = mock({ chat: true, storageFailure: true }); const result = await deletion.remove(s.client, s.review);
  assert.equal(result.cleanupPending, true); assert.equal(s.exists(), false); assert.equal(s.jobs.size, 1);
});
test('lost delete response leaves its server-generated cleanup job intact', async () => {
  const s = mock({ chat: true, lostResponse: true });
  await assert.rejects(deletion.remove(s.client, s.review), /confirmar/);
  assert.equal(s.exists(), false); assert.equal(s.jobs.size, 1); assert.equal(s.objects.size, 1);
});
test('silent Storage skip cannot discard a job while the object remains', async () => {
  const s = mock({ chat: true, silentlyKept: true }); const result = await deletion.remove(s.client, s.review);
  assert.equal(result.cleanupPending, true); assert.equal(s.jobs.size, 1);
});
test('invalid paths, references and lookup failures preserve jobs and never remove images', async () => {
  for (const config of [{ referenced: true }, { lookupFailure: true }, {}]) {
    const s = mock(config);
    const job = { id: 'job', review_id: 'review', image_path: Object.keys(config).length ? image : '../product-images/other.png' };
    const result = await deletion.cleanup(s.client, [job]);
    assert.equal(result.remaining, 1); assert.equal(s.calls.some(c => c[0] === 'remove'), false);
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { period, build } = require('../assets/js/shared/sales-report.js');

test('sales periods follow Costa Rica time across UTC and month boundaries', () => {
  const lateAugust = '2026-09-01T05:30:00Z'; // 31 Aug, 23:30 in Costa Rica
  assert.equal(period(lateAugust, 'month').key, '2026-08-01');
  assert.equal(period(lateAugust, 'fortnight').key, '2026-08-16');
  assert.equal(period(lateAugust, 'week').key, '2026-08-31');
  assert.equal(period('2026-09-16T05:30:00Z', 'fortnight').key, '2026-09-01');
  assert.equal(period('2026-09-16T06:00:00Z', 'fortnight').key, '2026-09-16');
});

test('sales report groups gross revenue and count for current and past periods', () => {
  const sales = [
    { sold_at: '2026-09-29T15:00:00Z', sale_price: 12000 },
    { sold_at: '2026-09-28T15:00:00Z', sale_price: 8000 },
    { sold_at: '2026-09-12T15:00:00Z', sale_price: 5000 },
    { sold_at: '2026-08-15T15:00:00Z', sale_price: 3000 },
  ];
  const report = build(sales, '2026-09-29T18:00:00Z');
  assert.deepEqual([report.week.current.total, report.week.current.count], [20000, 2]);
  assert.deepEqual([report.fortnight.current.total, report.fortnight.current.count], [20000, 2]);
  assert.deepEqual([report.month.current.total, report.month.current.count], [25000, 3]);
  assert.equal(report.fortnight.history.find(item => item.key === '2026-09-01').total, 5000);
  assert.equal(report.month.history.find(item => item.key === '2026-08-01').total, 3000);
});

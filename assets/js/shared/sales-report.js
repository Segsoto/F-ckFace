(function (root) {
  const zone = "America/Costa_Rica";
  const dayMs = 86400000;
  const dateParts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const monthName = new Intl.DateTimeFormat("es-CR", { timeZone: "UTC", month: "long" });
  const shortDate = new Intl.DateTimeFormat("es-CR", { timeZone: "UTC", day: "numeric", month: "short" });
  function parts(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const entries = Object.fromEntries(dateParts.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    return { year: entries.year, month: entries.month, day: entries.day };
  }
  function iso(day) { return new Date(day).toISOString().slice(0, 10); }
  function period(value, kind) {
    const local = parts(value);
    if (!local) return null;
    const day = Date.UTC(local.year, local.month - 1, local.day);
    const month = Date.UTC(local.year, local.month - 1, 1);
    if (kind === "week") {
      const monday = day - ((new Date(day).getUTCDay() + 6) % 7) * dayMs;
      return { key: iso(monday), start: monday, label: `Semana ${shortDate.format(monday)} – ${shortDate.format(monday + 6 * dayMs)}` };
    }
    if (kind === "fortnight") {
      const second = local.day > 15;
      const start = Date.UTC(local.year, local.month - 1, second ? 16 : 1);
      const endDay = new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();
      return { key: iso(start), start, label: `${second ? "16–" + endDay : "1–15"} ${monthName.format(month)} ${local.year}` };
    }
    return { key: iso(month), start: month, label: `${monthName.format(month)} ${local.year}` };
  }
  function build(sales, now = new Date()) {
    const result = {};
    for (const kind of ["week", "fortnight", "month"]) {
      const current = period(now, kind);
      const groups = new Map([[current.key, { ...current, total: 0, count: 0 }]]);
      for (const sale of sales) {
        const bucket = period(sale.sold_at, kind);
        if (!bucket) continue;
        if (!groups.has(bucket.key)) groups.set(bucket.key, { ...bucket, total: 0, count: 0 });
        const group = groups.get(bucket.key);
        group.total += Number(sale.sale_price) || 0;
        group.count++;
      }
      result[kind] = { current: groups.get(current.key), history: [...groups.values()].sort((a, b) => b.start - a.start) };
    }
    return result;
  }
  root.SalesReport = { period, build };
  if (typeof module !== "undefined") module.exports = root.SalesReport;
})(typeof window === "undefined" ? globalThis : window);

(function (root) {
  function plan(product) {
    const urls = Array.isArray(product?.image_urls) ? product.image_urls.filter((url) => typeof url === "string" && url.trim()) : [];
    const first = urls[0] || null;
    return { kept: first ? [first] : [], extra: [...new Set(urls.slice(1).filter((url) => url !== first))] };
  }
  function storagePath(url, baseUrl) {
    let parsed, base;
    try { parsed = new URL(url); base = new URL(baseUrl); } catch { return null; }
    const prefix = "/storage/v1/object/public/product-images/";
    const expected = base.origin + prefix;
    if (parsed.origin !== base.origin || parsed.search || parsed.hash || !url.startsWith(expected)) return null;
    const rawPath = url.slice(expected.length);
    if (/[?#]/.test(rawPath)) return null;
    let path;
    try { path = decodeURIComponent(rawPath); } catch { return null; }
    if (!path || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..") || !/^[0-9a-f-]{36}\/.+/.test(path)) return null;
    return path;
  }
  async function cleanup(client, product, baseUrl) {
    const pending = Array.isArray(product.image_cleanup_pending) ? product.image_cleanup_pending : [];
    if (!pending.length) return { product, remaining: 0 };
    const remaining = [];
    for (const url of pending) {
      const path = storagePath(url, baseUrl);
      if (!path || product.image_urls?.some((kept) => storagePath(kept, baseUrl) === path)) { remaining.push(url); continue; }
      const { data: references, error: referenceError } = await client.from("products").select("id").contains("image_urls", [url]).neq("id", product.id).limit(1);
      if (referenceError || references?.length) { remaining.push(url); continue; }
      const { error: storageError } = await client.storage.from("product-images").remove([path]);
      if (storageError) remaining.push(url);
    }
    const { data, error } = await client.from("products").update({ image_cleanup_pending: remaining, updated_at: new Date().toISOString() }).eq("id", product.id).eq("status", "sold").eq("updated_at", product.updated_at).select().single();
    if (error) throw error;
    return { product: data, remaining: remaining.length };
  }
  async function cleanupDeleted(client, job, baseUrl) {
    const remaining = [];
    for (const url of [...new Set(job.urls || [])]) {
      const path = storagePath(url, baseUrl);
      if (!path) { remaining.push(url); continue; }
      const { data: references, error: referenceError } = await client.from("products").select("id").contains("image_urls", [url]).limit(1);
      if (referenceError) { remaining.push(url); continue; }
      if (references?.length) continue;
      const { error: storageError } = await client.storage.from("product-images").remove([path]);
      if (storageError) remaining.push(url);
    }
    if (remaining.length) {
      const { error } = await client.from("deleted_product_images").update({ urls: remaining }).eq("id", job.id).select().single();
      if (error) throw error;
    } else {
      const { error } = await client.from("deleted_product_images").delete().eq("id", job.id).select("id").single();
      if (error) throw error;
    }
    return remaining.length;
  }
  root.SalePhotos = { plan, storagePath, cleanup, cleanupDeleted };
  if (typeof module !== "undefined") module.exports = root.SalePhotos;
})(typeof window === "undefined" ? globalThis : window);

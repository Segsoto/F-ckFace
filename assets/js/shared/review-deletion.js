(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReviewDeletion = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  async function pending(client, reviewId) {
    let query = client.from("review_image_cleanup").select("id,review_id,image_path,created_at").order("created_at", { ascending: true });
    if (reviewId) query = query.eq("review_id", reviewId);
    const { data, error } = await query.limit(20);
    if (error) throw error;
    return data || [];
  }
  async function cleanup(client, jobs) {
    let remaining = 0;
    for (const job of jobs) {
      try {
        if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(job.image_path)) throw new Error("Ruta de captura inválida.");
        const { data: references, error: lookupError } = await client.from("customer_reviews").select("id").eq("image_path", job.image_path).limit(1);
        if (lookupError || !references || references.length) throw new Error("No se pudo descartar una referencia.");
        const { error: storageError } = await client.storage.from("review-chats").remove([job.image_path]);
        if (storageError) throw storageError;
        // RLS no permite cerrar la tarea mientras el objeto todavía exista.
        const { data, error } = await client.from("review_image_cleanup").delete().eq("id", job.id).select("id").single();
        if (error || !data) throw new Error("La limpieza sigue pendiente.");
      } catch { remaining++; }
    }
    return { remaining, completed: jobs.length - remaining };
  }
  async function remove(client, review) {
    let query = client.from("customer_reviews").delete().eq("id", review.id).eq("status", review.status);
    query = review.reviewed_at == null ? query.is("reviewed_at", null) : query.eq("reviewed_at", review.reviewed_at);
    const { data, error } = await query.select("id,image_path").single();
    if (error || !data) throw new Error("No se pudo confirmar la eliminación. Actualizá la lista y comprobá tu sesión antes de reintentar.");
    if (!data.image_path) return { cleanupPending: false };
    try {
      const jobs = await pending(client, data.id);
      if (!jobs.length) return { cleanupPending: true };
      return { cleanupPending: Boolean((await cleanup(client, jobs)).remaining) };
    } catch { return { cleanupPending: true }; }
  }
  return { pending, cleanup, remove };
});

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CustomerReviews = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const fields = "id,customer_name,rating,comment,experience,status,created_at,reviewed_at";
  const experienceLabels = { service: "Servicio", delivery: "Entrega", both: "Servicio y entrega" };
  function escape(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
  function payload(values) {
    const customer_name = String(values.customer_name || "").trim();
    const comment = String(values.comment || "").trim();
    const rating = Number(values.rating);
    const experience = values.experience;
    if (!customer_name || Array.from(customer_name).length > 60) throw new Error("Ingresá un nombre o apodo de hasta 60 caracteres.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Elegí una calificación de 1 a 5 estrellas.");
    if (Array.from(comment).length < 10 || Array.from(comment).length > 1500) throw new Error("Escribí un comentario de 10 a 1500 caracteres.");
    if (!Object.hasOwn(experienceLabels, experience)) throw new Error("Elegí servicio, entrega o ambos.");
    // El cliente nunca decide el estado de publicación ni las fechas.
    return { customer_name, rating, comment, experience };
  }
  function stars(value) {
    const rating = Math.max(1, Math.min(5, Number(value) || 1));
    return `<span class="review-stars" role="img" aria-label="${rating} de 5 estrellas"><span aria-hidden="true">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span></span>`;
  }
  function card(review, actions = "") {
    const date = new Date(review.created_at).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "medium" });
    return `<article class="review-card">${stars(review.rating)}<p class="review-comment">${escape(review.comment)}</p><div class="review-author"><strong>${escape(review.customer_name)}</strong><span>${escape(experienceLabels[review.experience] || "Experiencia")} · ${escape(date)}</span></div>${actions}</article>`;
  }
  async function list(client, status, offset = 0, pageSize = 6) {
    if (!["pending", "approved", "rejected"].includes(status)) throw new Error("Estado de reseña inválido.");
    const { data, error } = await client.from("customer_reviews").select(fields).eq("status", status)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + pageSize);
    if (error) throw error;
    return { rows: (data || []).slice(0, pageSize), more: (data || []).length > pageSize };
  }
  async function submit(client, values) {
    const { error } = await client.from("customer_reviews").insert(payload(values));
    // No pedir RETURNING: las reseñas pendientes no son legibles públicamente.
    if (error) throw error;
  }
  async function moderate(client, review, status) {
    if (!["approved", "rejected"].includes(status)) throw new Error("Acción de moderación inválida.");
    const { data, error } = await client.from("customer_reviews").update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", review.id).eq("status", review.status).select(fields).single();
    if (error || !data) throw new Error("No se pudo actualizar la reseña. Actualizá la lista y comprobá tu sesión antes de reintentar.");
    return data;
  }
  return { payload, escape, stars, card, list, submit, moderate };
});

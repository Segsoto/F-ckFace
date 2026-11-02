(function () {
  const form = document.getElementById("reviewForm");
  if (!form) return;
  const config = window.FUCK_FACE_CONFIG;
  const client = config?.url && config?.anonKey && window.supabase
    ? window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "ff-public-reviews" },
    }) : null;
  const reviews = window.CustomerReviews;
  const list = document.getElementById("publicReviewsList");
  const more = document.getElementById("morePublicReviews");
  const message = document.getElementById("reviewFormMessage");
  const button = form.querySelector('[type="submit"]');
  let rows = [], loading = false, submitting = false;
  async function load() {
    if (loading) return;
    loading = true;
    more.disabled = true;
    try {
      if (!client) throw new Error("Sin conexión configurada.");
      const result = await reviews.list(client, "approved", rows.length);
      rows.push(...result.rows);
      list.innerHTML = rows.map((review) => reviews.card(review)).join("") || "<p>Todavía no hay reseñas publicadas. ¡Compartí tu experiencia!</p>";
      more.hidden = !result.more;
      if (more.dataset.retry) { delete more.dataset.retry; more.textContent = "VER MÁS RESEÑAS ↓"; }
    } catch (error) {
      if (!rows.length) list.textContent = "No se pudieron cargar las reseñas. Podés intentarlo de nuevo.";
      more.hidden = false;
      more.dataset.retry = "true";
      more.textContent = "REINTENTAR CARGA";
    } finally { loading = false; more.disabled = false; }
  }
  function updateRating() {
    const value = Number(form.querySelector('[name="rating"]:checked')?.value || 0);
    form.querySelectorAll('[name="rating"]').forEach((radio) => radio.nextElementSibling.classList.toggle("is-filled", Number(radio.value) <= value));
    document.getElementById("reviewRatingLabel").textContent = value ? `${value} de 5 estrellas` : "Elegí de 1 a 5 estrellas.";
  }
  form.querySelectorAll('[name="rating"]').forEach((radio) => radio.addEventListener("change", updateRating));
  more.addEventListener("click", load);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    const values = new FormData(form);
    if (values.get("website")) return;
    message.textContent = "";
    submitting = true;
    button.disabled = true;
    button.textContent = "ENVIANDO...";
    try {
      if (!client) throw new Error("Sin conexión configurada.");
      await reviews.submit(client, Object.fromEntries(values));
      form.reset();
      updateRating();
      message.textContent = "¡Gracias! Recibimos tu reseña. Quedó pendiente de aprobación antes de publicarse.";
      message.dataset.state = "success";
    } catch (error) {
      message.textContent = "No pudimos confirmar el envío. Revisá los datos y tu conexión antes de reintentar.";
      message.dataset.state = "error";
    } finally {
      submitting = false;
      button.disabled = false;
      button.textContent = "ENVIAR RESEÑA ↗";
    }
  });
  load();
})();

(function () {
  const list = document.getElementById("adminReviewsList");
  const filter = document.getElementById("reviewStatusFilter");
  const refresh = document.getElementById("refreshReviews");
  const more = document.getElementById("moreAdminReviews");
  const message = document.getElementById("reviewModerationMessage");
  const reviews = window.CustomerReviews;
  const chatForm = document.getElementById("chatReviewForm");
  const chatFile = document.getElementById("chatReviewImage");
  const chatPreview = document.getElementById("chatReviewPreview");
  const chatMessage = document.getElementById("chatReviewMessage");
  let previewUrl = null, savingChat = false, uploadRequest = 0;
  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    chatPreview.removeAttribute("src");
    chatPreview.hidden = true;
  }
  chatFile.addEventListener("change", () => {
    clearPreview();
    chatForm.elements.namedItem("consent").checked = false;
    chatMessage.textContent = "";
    const file = chatFile.files[0];
    if (!file) return;
    try {
      window.ReviewChatImages.validateFile(file);
      previewUrl = URL.createObjectURL(file);
      chatPreview.src = previewUrl;
      chatPreview.hidden = false;
    } catch (error) { chatFile.value = ""; chatMessage.textContent = error.message; chatMessage.dataset.state = "error"; }
  });
  window.addEventListener("pagehide", clearPreview);
  let client = null, rows = [], request = 0, busy = false;
  function render() {
    list.innerHTML = rows.map((review) => {
      const id = reviews.escape(review.id);
      const actions = `<div class="review-actions">${review.status !== "approved" ? `<button type="button" data-review-id="${id}" data-review-action="approved">ACEPTAR Y PUBLICAR</button>` : ""}${review.status !== "rejected" ? `<button type="button" class="secondary" data-review-id="${id}" data-review-action="rejected">${review.status === "approved" ? "RECHAZAR Y RETIRAR" : "RECHAZAR"}</button>` : ""}</div>`;
      return reviews.card(review, actions);
    }).join("") || "<p>NO HAY RESEÑAS EN ESTE ESTADO.</p>";
  }
  async function load(reset = true) {
    if (!client) return;
    const version = ++request;
    const status = filter.value;
    refresh.disabled = more.disabled = true;
    message.textContent = "Cargando reseñas...";
    if (reset) { rows = []; list.innerHTML = ""; more.hidden = true; }
    try {
      const result = await reviews.list(client, status, reset ? 0 : rows.length, 20);
      if (version !== request) return;
      rows = reset ? result.rows : [...rows, ...result.rows];
      more.hidden = !result.more;
      render();
      message.textContent = `${rows.length} ${rows.length === 1 ? "reseña cargada" : "reseñas cargadas"}${result.more ? "; hay más por revisar" : ""}.`;
      message.dataset.state = "success";
    } catch (error) {
      if (version !== request) return;
      message.textContent = "No se pudieron cargar las reseñas. Comprobá la conexión, tu sesión y que esté instalada la actualización de reseñas. Usá ACTUALIZAR RESEÑAS para reintentar.";
      message.dataset.state = "error";
    } finally { if (version === request) refresh.disabled = more.disabled = false; }
  }
  refresh.addEventListener("click", () => load());
  more.addEventListener("click", () => load(false));
  filter.addEventListener("change", () => load());
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (savingChat || !client || !chatForm.reportValidity()) return;
    const version = request;
    const uploadVersion = ++uploadRequest;
    const values = Object.fromEntries(new FormData(chatForm));
    const file = chatFile.files[0];
    savingChat = true;
    chatMessage.textContent = "";
    const controls = Array.from(chatForm.elements);
    controls.forEach((control) => { control.disabled = true; });
    try {
      await window.ReviewChatImages.save(client, values, file, {
        prepare: window.ImageCompression.prepare,
        randomUUID: () => crypto.randomUUID(),
        onProgress: (text) => { if (uploadVersion === uploadRequest && client) chatMessage.textContent = text; },
      });
      if (uploadVersion !== uploadRequest || !client) return;
      chatForm.reset();
      clearPreview();
      chatMessage.textContent = "Captura guardada. Revisá su legibilidad en PENDIENTES y aceptala cuando esté lista para publicarse.";
      chatMessage.dataset.state = "success";
      // No cambiar un filtro que la persona haya seleccionado durante la carga.
      if (version === request) { filter.value = "pending"; await load(); }
    } catch (error) {
      if (uploadVersion !== uploadRequest || !client) return;
      chatMessage.textContent = error.message;
      chatMessage.dataset.state = "error";
    } finally { if (uploadVersion === uploadRequest) { savingChat = false; controls.forEach((control) => { control.disabled = false; }); } }
  });
  list.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-review-action]");
    if (!button || busy) return;
    const review = rows.find((item) => item.id === button.dataset.reviewId);
    if (!review || !client) return;
    const version = request;
    busy = true;
    list.querySelectorAll("button").forEach((item) => { item.disabled = true; });
    try {
      await reviews.moderate(client, review, button.dataset.reviewAction);
      if (version !== request) return;
      await load();
    } catch (error) {
      if (version !== request) return;
      message.textContent = error.message;
      message.dataset.state = "error";
    } finally { busy = false; list.querySelectorAll("button").forEach((item) => { item.disabled = false; }); }
  });
  window.AdminReviews = {
    init(value) { client = value; if (!document.getElementById("reviewsModule").hidden) load(); },
    load,
    clear() {
      client = null;
      rows = [];
      ++request;
      ++uploadRequest;
      savingChat = busy = false;
      list.innerHTML = "";
      message.textContent = "";
      more.hidden = true;
      refresh.disabled = more.disabled = false;
      chatForm.reset();
      Array.from(chatForm.elements).forEach((control) => { control.disabled = false; });
      clearPreview();
      chatMessage.textContent = "";
      document.getElementById("chatReviewEditor").open = false;
    },
  };
})();

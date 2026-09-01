(function () {
  const config = window.FUCK_FACE_CONFIG;
  const whatsapp = config?.whatsappNumber || "50689652370";
  const client = config?.url && config?.anonKey && window.supabase ? window.supabase.createClient(config.url, config.anonKey) : null;
  const grid = document.getElementById("exclusiveProductGrid");
  const form = document.getElementById("accessForm");
  const closed = document.getElementById("closedDrop");
  const dialog = document.getElementById("productDialog");
  const whatsappButton = document.getElementById("dialogWhatsapp");
  let products = [], dropTimer, activeDrop;
  const currency = (value) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(value || 0);
  const escapeHtml = (value = "") => { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; };
  const statusLabel = (value) => ({ reserved: "APARTADA", payment_pending: "EN PROCESO" })[value] || "DISPONIBLE";
  const passwordKey = (drop) => `ff-exclusive-drop-${drop.id}`;
  document.querySelectorAll('[data-whatsapp="general"]').forEach((link) => {
    link.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, quiero consultar sobre el drop exclusivo de F-ck Face.")}`;
  });
  const whatsappLink = (product) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero consultar por la pieza: ${product.name} (${currency(product.price)}). ¿Aún está disponible?`)}`;
  function card(product) {
    const unavailable = product.availability !== "available" ? `<span class="product-availability ${escapeHtml(product.availability)}">${statusLabel(product.availability)}</span>` : "";
    return `<article class="product-card" data-id="${product.id}"><div class="product-image"><img src="${escapeHtml(product.image_urls?.[0] || "img/logo1.jpg")}" alt="${escapeHtml(product.name)}"><span class="product-label">${escapeHtml(product.category)}</span>${unavailable}</div><div class="product-info"><div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.size || "TALLA ÚNICA")} · ${escapeHtml(product.condition || "BUEN ESTADO")}</p></div><strong class="product-price">${currency(product.price)}</strong></div></article>`;
  }
  async function unlock(password) {
    const { data, error } = await client.rpc("get_exclusive_products", { p_drop_id: activeDrop.id, p_password: password });
    if (error) { document.getElementById("accessMessage").textContent = "La contraseña no es válida o el acceso ya no está disponible."; return false; }
    localStorage.setItem(passwordKey(activeDrop), JSON.stringify({ password, expiresAt: activeDrop.public_at }));
    products = data || []; grid.innerHTML = products.map(card).join("") || '<p class="empty-state">TODAVÍA NO HAY PIEZAS CARGADAS.</p>';
    form.hidden = true; document.getElementById("accessGranted").hidden = false; return true;
  }
  function updateCountdown(drop) {
    clearInterval(dropTimer);
    const state = document.getElementById("countdownState");
    const set = (name, value) => (document.getElementById(`count${name}`).textContent = value);
    if (!drop) { ["Days", "Hours", "Minutes", "Seconds"].forEach((key) => set(key, "--")); state.textContent = "PROGRAMANDO EL PRÓXIMO DROP"; return; }
    const tick = async () => {
      const now = Date.now(), exclusive = new Date(drop.exclusive_at).getTime(), publicAt = new Date(drop.public_at).getTime();
      if (now >= publicAt) { clearInterval(dropTimer); await client.rpc("release_due_drops"); localStorage.removeItem(passwordKey(drop)); await load(); return; }
      const target = now < exclusive ? exclusive : publicAt;
      let left = target - now;
      [["Days", 86400000], ["Hours", 3600000], ["Minutes", 60000], ["Seconds", 1000]].forEach(([key, unit]) => { const value = Math.floor(left / unit); set(key, String(value).padStart(2, "0")); left -= value * unit; });
      state.textContent = now < exclusive ? "ACCESO EXCLUSIVO PRÓXIMAMENTE" : "ACCESO EXCLUSIVO ACTIVO";
    };
    tick(); dropTimer = setInterval(tick, 1000);
  }
  async function load() {
    if (!client) { grid.innerHTML = '<p class="empty-state">CONFIGURÁ SUPABASE PARA CARGAR EL DROP.</p>'; return; }
    await client.rpc("release_due_drops");
    const { data } = await client.rpc("get_current_drop");
    activeDrop = data?.[0]; updateCountdown(activeDrop);
    document.getElementById("newDropDescription").textContent = activeDrop?.description || "Las próximas piezas están por caer.";
    const now = Date.now();
    if (!activeDrop || now >= new Date(activeDrop.public_at).getTime()) { closed.hidden = false; form.hidden = true; grid.innerHTML = ""; return; }
    closed.hidden = true;
    if (now < new Date(activeDrop.exclusive_at).getTime()) { form.hidden = true; grid.innerHTML = ""; return; }
    form.hidden = false;
    try {
      const saved = JSON.parse(localStorage.getItem(passwordKey(activeDrop)) || "null");
      if (saved?.password && new Date(saved.expiresAt).getTime() > now) await unlock(saved.password);
    } catch { localStorage.removeItem(passwordKey(activeDrop)); }
  }
  form.addEventListener("submit", async (event) => { event.preventDefault(); document.getElementById("accessMessage").textContent = ""; await unlock(document.getElementById("accessPassword").value); });
  function openProduct(product) {
    [ ["dialogImage", product.image_urls?.[0] || "img/logo1.jpg"], ["dialogCategory", product.category || "PIEZA"], ["dialogName", product.name], ["dialogPrice", currency(product.price)], ["dialogDescription", product.description || "Consultá por esta pieza para más detalles."], ["dialogSize", product.size || "—"], ["dialogCondition", product.condition || "—"], ["dialogLength", product.length_cm ? `${product.length_cm} cm` : "—"], ["dialogChestWidth", product.chest_width_cm ? `${product.chest_width_cm} cm` : "—"] ].forEach(([id, value]) => { document.getElementById(id).textContent = value; });
    document.getElementById("dialogImage").src = product.image_urls?.[0] || "img/logo1.jpg";
    const unavailable = product.availability !== "available", notice = document.getElementById("availabilityNotice"); notice.hidden = !unavailable; notice.textContent = unavailable ? `ESTA PRENDA ESTÁ ${statusLabel(product.availability)}. ESPERÁ A QUE SE LIBERE PARA PODER INTENTAR COMPRARLA.` : "";
    whatsappButton.href = whatsappLink(product); whatsappButton.dataset.availability = product.availability || "available"; dialog.showModal();
  }
  document.addEventListener("click", (event) => { const cardEl = event.target.closest(".product-card"); if (cardEl) openProduct(products.find((p) => p.id === cardEl.dataset.id)); });
  whatsappButton.addEventListener("click", (event) => { if (whatsappButton.dataset.availability !== "available") { event.preventDefault(); alert("Esta prenda está apartada o en proceso de compra. Esperá a que se libere de nuevo para poder intentar comprarla."); } });
  document.querySelector(".dialog-close").addEventListener("click", () => dialog.close()); dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  load();
})();

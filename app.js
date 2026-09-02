(function () {
  const config = window.FUCK_FACE_CONFIG;
  const whatsapp = config?.whatsappNumber || "50689652370";
  const client = config?.url && config?.anonKey && window.supabase ? window.supabase.createClient(config.url, config.anonKey) : null;
  const productGrid = document.getElementById("productGrid");
  const dialog = document.getElementById("productDialog");
  const whatsappButton = document.getElementById("dialogWhatsapp");
  let products = [], publicTimer;
  function currency(value) { return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(value || 0); }
  function escapeHtml(value = "") { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
  function statusLabel(availability) { return ({ reserved: "APARTADA", payment_pending: "EN PROCESO" })[availability] || "DISPONIBLE"; }
  function whatsappLink(product) { const message = product ? `Hola, quiero consultar por la pieza: ${product.name} (${currency(product.price)}). ¿Aún está disponible?` : "Hola, quiero consultar por las piezas disponibles de F-ck Face."; return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`; }
  document.querySelectorAll('[data-whatsapp="general"]').forEach((link) => (link.href = whatsappLink()));
  function card(product) {
    const image = product.image_urls?.[0] || "img/logo1.jpg";
    const status = product.availability !== "available" ? `<span class="product-availability ${escapeHtml(product.availability)}">${statusLabel(product.availability)}</span>` : "";
    return `<article class="product-card" data-id="${product.id}"><div class="product-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy"><span class="product-label">${escapeHtml(product.category || "PIEZA")}</span>${status}</div><div class="product-info"><div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.size || "TALLA ÚNICA")} · ${escapeHtml(product.condition || "BUEN ESTADO")}</p></div><strong class="product-price">${currency(product.price)}</strong></div></article>`;
  }
  function render() { productGrid.innerHTML = products.map(card).join("") || '<p class="empty-state">NO HAY PIEZAS DISPONIBLES TODAVÍA.</p>'; }
  function openProduct(product) {
    const gallery = document.getElementById("dialogGallery");
    const images = Array.isArray(product.image_urls) && product.image_urls.length
      ? product.image_urls.filter(Boolean)
      : [product.image_urls?.[0] || "img/logo1.jpg"];
    const mainImage = document.getElementById("dialogImage");

    mainImage.src = images[0];
    mainImage.alt = product.name;
    gallery.innerHTML = "";

    images.forEach((src, index) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = `dialog-gallery-item ${index === 0 ? "active" : ""}`;
      thumb.setAttribute("aria-label", `Ver imagen ${index + 1}`);
      thumb.innerHTML = `<img src="${src}" alt="${escapeHtml(product.name)} ${index + 1}" loading="lazy" />`;
      thumb.addEventListener("click", () => {
        mainImage.src = src;
        gallery.querySelectorAll(".dialog-gallery-item").forEach((item) => item.classList.toggle("active", item === thumb));
      });
      gallery.appendChild(thumb);
    });

    document.getElementById("dialogCategory").textContent = product.category || "PIEZA";
    document.getElementById("dialogName").textContent = product.name;
    document.getElementById("dialogPrice").textContent = currency(product.price);
    document.getElementById("dialogDescription").textContent = product.description || "Consultá por esta pieza para más detalles.";
    document.getElementById("dialogSize").textContent = product.size || "—";
    document.getElementById("dialogCondition").textContent = product.condition || "—";
    document.getElementById("dialogLength").textContent = product.length_cm ? `${product.length_cm} cm` : "—";
    document.getElementById("dialogChestWidth").textContent = product.chest_width_cm ? `${product.chest_width_cm} cm` : "—";
    const unavailable = product.availability !== "available";
    const notice = document.getElementById("availabilityNotice");
    notice.hidden = !unavailable;
    notice.textContent = unavailable ? `ESTA PRENDA ESTÁ ${statusLabel(product.availability)}. ESPERÁ A QUE SE LIBERE PARA PODER INTENTAR COMPRARLA.` : "";
    whatsappButton.href = whatsappLink(product);
    whatsappButton.dataset.availability = product.availability || "available";
    dialog.showModal();
  }
  document.addEventListener("click", (event) => { const cardEl = event.target.closest(".product-card"); if (cardEl) openProduct(products.find((p) => p.id === cardEl.dataset.id)); });
  whatsappButton.addEventListener("click", (event) => { if (whatsappButton.dataset.availability === "available") return; event.preventDefault(); alert("Esta prenda está apartada o en proceso de compra. Esperá a que se libere de nuevo para poder intentar comprarla."); });
  document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  function updatePublicCountdown(drop) {
    clearInterval(publicTimer); const target = document.getElementById("publicDropCountdown");
    if (!drop?.public_at) { target.textContent = "PRÓXIMO DROP: PROGRAMANDO"; return; }
    const tick = () => { const difference = new Date(drop.public_at).getTime() - Date.now(); if (difference <= 0) { clearInterval(publicTimer); target.textContent = "NUEVAS PIEZAS DISPONIBLES AHORA"; return; } const hours = Math.floor(difference / 3600000); const minutes = Math.floor((difference % 3600000) / 60000); target.textContent = `DROP PÚBLICO EN ${String(hours).padStart(2, "0")}H ${String(minutes).padStart(2, "0")}MIN`; };
    tick(); publicTimer = setInterval(tick, 1000);
  }
  async function load() {
    if (!client) { productGrid.innerHTML = '<p class="empty-state">CONFIGURÁ SUPABASE PARA CARGAR EL CATÁLOGO.</p>'; return; }
    await client.rpc("release_due_drops");
    const [{ data: catalog, error }, { data: drops }] = await Promise.all([client.rpc("get_public_catalog"), client.rpc("get_current_drop")]);
    if (error) { console.error(error); productGrid.innerHTML = '<p class="empty-state">NO SE PUDO CARGAR EL CATÁLOGO.</p>'; return; }
    products = catalog || []; updatePublicCountdown(drops?.[0]); render();
  }
  load();
})();

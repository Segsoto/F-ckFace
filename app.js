(function () {
  const config = window.FUCK_FACE_CONFIG;
  const whatsapp = config?.whatsappNumber || "50689652370";
  const client = config?.url && config?.anonKey && window.supabase ? window.supabase.createClient(config.url, config.anonKey) : null;
  const productGrid = document.getElementById("productGrid");
  const dialog = document.getElementById("productDialog");
  const whatsappButton = document.getElementById("dialogWhatsapp");
  let products = [], publicTimer, selectedCategory = null;
  const categoryNames = {
    jacket_damas: "JACKET DAMAS", jacket_caballeros: "JACKET CABALLEROS",
    pantalones: "PANTALONES", chalecos: "CHALECOS", tallas_plus: "TALLAS PLUS",
    ropa_ninos: "ROPA NIÑOS", mochilas: "MOCHILAS"
  };
  function currency(value) { return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(value || 0); }
  function escapeHtml(value = "") { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; }
  function statusLabel(availability) { return ({ reserved: "APARTADA", payment_pending: "EN PROCESO" })[availability] || "DISPONIBLE"; }
  function priceMarkup(product) { const discounted = Number(product.original_price) > Number(product.price); const percent = discounted ? Math.round((1 - Number(product.price) / Number(product.original_price)) * 100) : 0; return `${discounted ? `<span class="discount-badge">-${percent}%</span>` : ""}<span class="price-stack">${discounted ? `<s class="price-original">${currency(product.original_price)}</s>` : ""}<span class="price-current">${currency(product.price)}</span></span>`; }
  function whatsappLink(product) { const message = product ? `Hola, quiero consultar por la pieza: ${product.name} (${currency(product.price)}). ¿Aún está disponible?` : "Hola, quiero consultar por las piezas disponibles de F-ck Face."; return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`; }
  document.querySelectorAll('[data-whatsapp="general"]').forEach((link) => (link.href = whatsappLink()));
  function card(product) {
    const image = product.image_urls?.[0] || "img/logo1.jpg";
    const status = product.availability !== "available" ? `<span class="product-availability ${escapeHtml(product.availability)}">${statusLabel(product.availability)}</span>` : "";
    return `<article class="product-card" data-id="${product.id}"><div class="product-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy"><span class="product-label">${escapeHtml(categoryNames[product.category] || product.category || "PIEZA")}</span>${status}${Number(product.original_price) > Number(product.price) ? priceMarkup(product).match(/<span class="discount-badge">.*?<\/span>/)[0] : ""}</div><div class="product-info"><div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.size || "TALLA ÚNICA")} · ${escapeHtml(product.condition || "BUEN ESTADO")}</p></div><strong class="product-price">${priceMarkup(product).replace(/<span class="discount-badge">.*?<\/span>/, "")}</strong></div></article>`;
  }
  function render() {
    const visibleProducts = selectedCategory ? products.filter((product) => product.category === selectedCategory) : products;
    productGrid.innerHTML = visibleProducts.map(card).join("") || `<p class="empty-state">${selectedCategory ? `NO HAY PIEZAS EN ${escapeHtml(categoryNames[selectedCategory])} TODAVÍA.` : "NO HAY PIEZAS DISPONIBLES TODAVÍA."}</p>`;
    document.getElementById("catalogReset").hidden = !selectedCategory;
    document.querySelectorAll(".category-card").forEach((item) => item.classList.toggle("active", item.dataset.category === selectedCategory));
  }
  function selectCategory(category) {
    selectedCategory = category;
    render();
    document.getElementById("productGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileMenuToggle = document.getElementById("mobileMenuToggle");
  function closeMobileMenu() {
    if (!mobileMenu || !mobileMenuToggle) return;
    mobileMenu.classList.remove("is-open");
    mobileMenuToggle.setAttribute("aria-expanded", "false");
    mobileMenuToggle.setAttribute("aria-label", "Abrir menú");
  }
  if (mobileMenu && mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", () => {
      const isOpen = mobileMenu.classList.toggle("is-open");
      mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
      mobileMenuToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
    });
    mobileMenu.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      const category = link.dataset.menuCategory;
      if (category) {
        event.preventDefault();
        selectCategory(category);
      }
      closeMobileMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMobileMenu();
    });
  }
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

    document.getElementById("dialogCategory").textContent = categoryNames[product.category] || product.category || "PIEZA";
    document.getElementById("dialogName").textContent = product.name;
    document.getElementById("dialogPrice").innerHTML = priceMarkup(product).replace(/<span class="discount-badge">.*?<\/span>/, "");
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
  document.getElementById("categorySlider").addEventListener("click", (event) => { const category = event.target.closest(".category-card")?.dataset.category; if (category) selectCategory(category); });
  document.getElementById("catalogReset").addEventListener("click", () => { selectedCategory = null; render(); });
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

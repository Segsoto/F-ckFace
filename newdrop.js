(function () {
  const config = window.FUCK_FACE_CONFIG;
  const whatsapp = config?.whatsappNumber || "50689652370";
  const client = config?.url && config?.anonKey && window.supabase ? window.supabase.createClient(config.url, config.anonKey) : null;
  const grid = document.getElementById("exclusiveProductGrid");
  const form = document.getElementById("accessForm");
  const closed = document.getElementById("closedDrop");
  const dialog = document.getElementById("productDialog");
  const whatsappButton = document.getElementById("dialogWhatsapp");
  let products = [], dropTimer, activeDrop, selectedCategory = null, accessPassword = null;
  const categories = {
    jacket_damas: ["JACKET DAMAS", "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=80"],
    jacket_caballeros: ["JACKET CABALLEROS", "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=900&q=80"],
    pantalones: ["PANTALONES", "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=900&q=80"],
    chalecos: ["CHALECOS", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80"],
    tallas_plus: ["TALLAS PLUS", "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=80"],
    ropa_ninos: ["ROPA NIÑOS", "https://images.unsplash.com/photo-1519238359922-989348752efb?auto=format&fit=crop&w=900&q=80"],
    mochilas: ["MOCHILAS", "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80"]
  };
  const currency = (value) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(value || 0);
  const escapeHtml = (value = "") => { const el = document.createElement("div"); el.textContent = value; return el.innerHTML; };
  const statusLabel = (value) => ({ reserved: "APARTADA", payment_pending: "EN PROCESO" })[value] || "DISPONIBLE";
  const priceMarkup = (product) => { const discounted = Number(product.original_price) > Number(product.price); const percent = discounted ? Math.round((1 - Number(product.price) / Number(product.original_price)) * 100) : 0; return `${discounted ? `<span class="discount-badge">-${percent}%</span>` : ""}<span class="price-stack">${discounted ? `<s class="price-original">${currency(product.original_price)}</s>` : ""}<span class="price-current">${currency(product.price)}</span></span>`; };
  const passwordKey = (drop) => `ff-exclusive-drop-${drop.id}`;
  function normalizeImages(product) {
    const items = [];
    const add = (value) => {
      if (!value || typeof value !== "string") return;
      const clean = value.trim();
      if (!clean) return;
      if (clean.startsWith("[") && clean.endsWith("]")) {
        try {
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed)) {
            parsed.forEach(add);
            return;
          }
        } catch {
          // ignore and continue
        }
      }
      const parts = clean.includes("|") ? clean.split("|") : [clean];
      parts.forEach((part) => {
        const normalized = part.trim();
        if (normalized && !items.includes(normalized)) items.push(normalized);
      });
    };

    if (Array.isArray(product?.image_urls)) {
      product.image_urls.forEach(add);
    } else {
      add(product?.image_urls);
    }
    add(product?.image_url);

    return items.length ? items : ["img/logo1.jpg"];
  }
  document.querySelectorAll('[data-whatsapp="general"]').forEach((link) => {
    link.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, quiero consultar sobre el drop exclusivo de F-ck Face.")}`;
  });
  const whatsappLink = (product) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero consultar por la pieza: ${product.name} (${currency(product.price)}). ¿Aún está disponible?`)}`;
  function card(product) {
    const firstImage = normalizeImages(product)[0];
    const unavailable = product.availability !== "available" ? `<span class="product-availability ${escapeHtml(product.availability)}">${statusLabel(product.availability)}</span>` : "";
    return `<article class="product-card" data-id="${product.id}"><div class="product-image"><img src="${escapeHtml(firstImage)}" alt="${escapeHtml(product.name)}"><span class="product-label">${escapeHtml(categories[product.category]?.[0] || product.category || "PIEZA")}</span>${unavailable}${Number(product.original_price) > Number(product.price) ? priceMarkup(product).match(/<span class="discount-badge">.*?<\/span>/)[0] : ""}</div><div class="product-info"><div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.size || "TALLA ÚNICA")} · ${escapeHtml(product.condition || "BUEN ESTADO")}</p></div><strong class="product-price">${priceMarkup(product).replace(/<span class="discount-badge">.*?<\/span>/, "")}</strong></div></article>`;
  }
  function renderProducts() {
    const visible = selectedCategory ? products.filter((product) => product.category === selectedCategory) : products;
    grid.innerHTML = visible.map(card).join("") || `<p class="empty-state">${selectedCategory ? `NO HAY PIEZAS EN ${escapeHtml(categories[selectedCategory]?.[0])} TODAVÍA.` : "TODAVÍA NO HAY PIEZAS CARGADAS."}</p>`;
    document.querySelectorAll("#exclusiveCategorySlider .category-card").forEach((item) => item.classList.toggle("active", item.dataset.category === selectedCategory));
  }
  function renderCategories() {
    const section = document.getElementById("exclusiveCategories");
    const slider = document.getElementById("exclusiveCategorySlider");
    slider.innerHTML = Object.entries(categories).map(([key, [name, image]]) => `<button class="category-card" type="button" data-category="${key}"><img src="${image}" alt="${name}" /><span>${name.replace(" ", "<br />")}</span><small>VER PIEZAS →</small></button>`).join("");
    section.hidden = false;
  }
  async function unlock(password) {
    const { data, error } = await client.rpc("get_exclusive_products", { p_drop_id: activeDrop.id, p_password: password });
    if (error) { document.getElementById("accessMessage").textContent = "La contraseña no es válida o el acceso ya no está disponible."; return false; }
    accessPassword = password;
    localStorage.setItem(passwordKey(activeDrop), JSON.stringify({ password, expiresAt: activeDrop.public_at }));
    products = data || []; selectedCategory = null; renderCategories(); renderProducts();
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
      const exclusiveIsActive = now >= exclusive;
      state.textContent = exclusiveIsActive ? "ACCESO EXCLUSIVO ACTIVO" : "ACCESO EXCLUSIVO PRÓXIMAMENTE";
      if (exclusiveIsActive && form.hidden) {
        form.hidden = false;
        document.getElementById("exclusiveCategories").hidden = true;
      }
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
    if (!activeDrop || now >= new Date(activeDrop.public_at).getTime()) { closed.hidden = false; form.hidden = true; grid.innerHTML = ""; document.getElementById("exclusiveCategories").hidden = true; return; }
    closed.hidden = true;
    if (now < new Date(activeDrop.exclusive_at).getTime()) { form.hidden = true; grid.innerHTML = ""; document.getElementById("exclusiveCategories").hidden = true; return; }
    form.hidden = false;
    try {
      const saved = JSON.parse(localStorage.getItem(passwordKey(activeDrop)) || "null");
      if (saved?.password && new Date(saved.expiresAt).getTime() > now) await unlock(saved.password);
    } catch { localStorage.removeItem(passwordKey(activeDrop)); }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    const password = document.getElementById("accessPassword").value;
    if (!password || button.disabled) return;
    button.disabled = true;
    document.getElementById("accessMessage").textContent = "";
    try {
      await unlock(password);
    } finally {
      button.disabled = false;
    }
  });
  async function openProduct(product) {
    if (!product || !client || !activeDrop?.id || !accessPassword) return;
    try {
      const { data, error } = await client.rpc("get_exclusive_products", { p_drop_id: activeDrop.id, p_password: accessPassword });
      if (error) throw error;
      const freshProduct = data?.find((item) => item.id === product.id);
      if (!freshProduct) {
        alert("Esta prenda ya no está disponible.");
        return;
      }
      product = freshProduct;
    } catch (error) {
      console.error("No se pudo verificar la disponibilidad de la prenda:", error);
      alert("No se pudo verificar la disponibilidad. Intentá nuevamente.");
      return;
    }
    const gallery = document.getElementById("dialogGallery");
    const images = normalizeImages(product);
    const mainImage = document.getElementById("dialogImage");

    [ ["dialogCategory", categories[product.category]?.[0] || product.category || "PIEZA"], ["dialogName", product.name], ["dialogDescription", product.description || "Consultá por esta pieza para más detalles."], ["dialogSize", product.size || "—"], ["dialogCondition", product.condition || "—"], ["dialogLength", product.length_cm ? `${product.length_cm} cm` : "—"], ["dialogChestWidth", product.chest_width_cm ? `${product.chest_width_cm} cm` : "—"] ].forEach(([id, value]) => { document.getElementById(id).textContent = value; });
    document.getElementById("dialogPrice").innerHTML = priceMarkup(product).replace(/<span class="discount-badge">.*?<\/span>/, "");

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

    gallery.style.display = images.length > 1 ? "flex" : "none";
    const unavailable = product.availability !== "available", notice = document.getElementById("availabilityNotice"); notice.hidden = !unavailable; notice.textContent = unavailable ? `ESTA PRENDA ESTÁ ${statusLabel(product.availability)}. ESPERÁ A QUE SE LIBERE PARA PODER INTENTAR COMPRARLA.` : "";
    whatsappButton.href = whatsappLink(product); whatsappButton.dataset.availability = product.availability || "available"; dialog.showModal();
  }
  document.addEventListener("click", (event) => { const cardEl = event.target.closest(".product-card"); if (cardEl) openProduct(products.find((p) => p.id === cardEl.dataset.id)); });
  document.getElementById("exclusiveCategorySlider").addEventListener("click", (event) => { const category = event.target.closest(".category-card")?.dataset.category; if (!category) return; selectedCategory = category; renderProducts(); grid.scrollIntoView({ behavior: "smooth", block: "start" }); });
  whatsappButton.addEventListener("click", (event) => { if (whatsappButton.dataset.availability !== "available") { event.preventDefault(); alert("Esta prenda está apartada o en proceso de compra. Esperá a que se libere de nuevo para poder intentar comprarla."); } });
  document.querySelector(".dialog-close").addEventListener("click", () => dialog.close()); dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  load();
})();

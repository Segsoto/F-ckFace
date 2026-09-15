(function () {
  const config = window.FUCK_FACE_CONFIG;
  const whatsapp = config?.whatsappNumber || "50689168397";
  const client = config?.url && config?.anonKey && window.supabase ? window.supabase.createClient(config.url, config.anonKey) : null;
  const grid = document.getElementById("exclusiveProductGrid");
  const form = document.getElementById("accessForm");
  const closed = document.getElementById("closedDrop");
  const dialog = document.getElementById("productDialog");
  const whatsappButton = document.getElementById("dialogWhatsapp");
  const previewMode = new URLSearchParams(window.location?.search || "").get("preview") === "admin";
  let products = [], dropTimer, activeDrop, selectedCategory = null, accessPassword = null;
  const requestedId = new URLSearchParams(window.location?.search || "").get("prenda");
  let requestedProductHandled = false;
  async function openRequestedProduct() {
    if (!requestedId || requestedProductHandled) return;
    requestedProductHandled = true;
    const product = products.find((item) => item.id === requestedId);
    if (product) await openProduct(product);
    else alert("Esta prenda ya no está disponible en este drop.");
  }
  let searchQuery = "", selectedSize = "";
  const normalizeSearch = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
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
  const whatsappLink = (product) => {
    let message = `Hola, quiero consultar por la pieza: ${product.name} (${currency(product.price)}). ¿Aún está disponible?`;
    const url = new URL("newdrop.html", window.location.href);
    url.searchParams.set("prenda", product.id);
    message += `\n\nVer prenda: ${url.href}`;
    return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
  };
  function card(product) {
    const firstImage = normalizeImages(product)[0];
    const unavailable = product.availability !== "available" ? `<span class="product-availability ${escapeHtml(product.availability)}">${statusLabel(product.availability)}</span>` : "";
    return `<article class="product-card" data-id="${product.id}"><div class="product-image"><img src="${escapeHtml(firstImage)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"><span class="product-label">${escapeHtml(categories[product.category]?.[0] || product.category || "PIEZA")}</span>${unavailable}${Number(product.original_price) > Number(product.price) ? priceMarkup(product).match(/<span class="discount-badge">.*?<\/span>/)[0] : ""}</div><div class="product-info"><div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.size || "TALLA ÚNICA")} · ${escapeHtml(product.condition || "BUEN ESTADO")}</p></div><strong class="product-price">${priceMarkup(product).replace(/<span class="discount-badge">.*?<\/span>/, "")}</strong></div></article>`;
  }
  function renderProducts() {
    const terms = normalizeSearch(searchQuery).split(/\s+/).filter(Boolean);
    const visible = products.filter(product => {
      const text = normalizeSearch([product.name, product.description, product.size, product.category, categories[product.category]?.[0]].filter(Boolean).join(" "));
      return (!selectedCategory || (product.category || "sin_categoria") === selectedCategory)
        && (!selectedSize || normalizeSearch(product.size) === selectedSize)
        && terms.every(term => text.includes(term));
    });
    grid.innerHTML = visible.map(card).join("") || `<p class="empty-state">${products.length ? "NO HAY PRENDAS QUE COINCIDAN. PROBÁ OTRA BÚSQUEDA O LIMPIÁ LOS FILTROS." : "TODAVÍA NO HAY PIEZAS CARGADAS."}</p>`;
    window.ProductImages.prepare(grid);
    document.querySelectorAll("#exclusiveCategorySlider button").forEach((item) => {
      const active = item.dataset.category === (selectedCategory || "");
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    document.getElementById("exclusiveResultCount").textContent = `${visible.length} ${visible.length === 1 ? "PRENDA" : "PRENDAS"}`;
  }
  function renderCategories() {
    const sizeFilter = document.getElementById("dropSizeFilter");
    sizeFilter.replaceChildren();
    const sizes = [...new Set(products.map(product => normalizeSearch(product.size)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    if (!sizes.includes(selectedSize)) selectedSize = "";
    ["", ...sizes].forEach(size => {
      const option = document.createElement("option");
      option.value = size;
      option.textContent = size ? size.toLocaleUpperCase("es") : "TODAS LAS TALLAS";
      sizeFilter.append(option);
    });
    sizeFilter.value = selectedSize;
    const section = document.getElementById("exclusiveCategories");
    const slider = document.getElementById("exclusiveCategorySlider");
    slider.replaceChildren();
    const counts = new Map();
    products.forEach(product => {
      const key = product.category || "sin_categoria";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    [["", products.length], ...counts].forEach(([key, count]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "drop-category-filter";
      button.dataset.category = key;
      button.setAttribute("aria-controls", "exclusiveProductGrid");
      button.textContent = `${key ? (categories[key]?.[0] || (key === "sin_categoria" ? "SIN CATEGORÍA" : key)) : "TODAS"} (${count})`;
      slider.append(button);
    });
    section.hidden = false;
  }
  async function unlock(password) {
    const { data, error } = await client.rpc("get_exclusive_products", { p_drop_id: activeDrop.id, p_password: password });
    if (error) { document.getElementById("accessMessage").textContent = "La contraseña no es válida o el acceso ya no está disponible."; return false; }
    accessPassword = password;
    localStorage.setItem(passwordKey(activeDrop), JSON.stringify({ password, expiresAt: activeDrop.public_at }));
    products = data || []; selectedCategory = null; renderCategories(); renderProducts();
    form.hidden = true; document.getElementById("accessGranted").hidden = false;
    await openRequestedProduct();
    return true;
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
      if (exclusiveIsActive && form.hidden && !accessPassword) {
        form.hidden = false;
        document.getElementById("exclusiveCategories").hidden = true;
      }
    };
    tick(); dropTimer = setInterval(tick, 1000);
  }
  async function load() {
    accessPassword = null;
    products = [];
    selectedCategory = null;
    searchQuery = "";
    selectedSize = "";
    document.getElementById("dropSearch").value = "";
    document.getElementById("dropSizeFilter").value = "";
    document.getElementById("accessGranted").hidden = true;
    if (!client) { grid.innerHTML = '<p class="empty-state">CONFIGURÁ SUPABASE PARA CARGAR EL DROP.</p>'; return; }
    if (previewMode) {
      form.hidden = true;
      closed.hidden = true;
      document.getElementById("previewNotice").hidden = false;
      document.getElementById("countdownState").textContent = "VISTA PREVIA PRIVADA · ADMINISTRADOR";
      const preview = await window.DropPreview.load(client);
      activeDrop = preview.drop;
      products = preview.products;
      document.getElementById("newDropDescription").textContent = activeDrop?.description || "Revisión del próximo drop.";
      if (!activeDrop) {
        grid.innerHTML = '<p class="empty-state">NO HAY UN DROP ACTIVO PARA REVISAR.</p>';
        return;
      }
      renderCategories();
      renderProducts();
      await openRequestedProduct();
      return;
    }
    await client.rpc("release_due_drops");
    if (requestedId) {
      const { data: publicProducts, error } = await client.rpc("get_public_product", { p_product_id: requestedId });
      if (error) throw error;
      if (publicProducts?.length) {
        const url = new URL("index.html", window.location.href);
        url.searchParams.set("prenda", requestedId);
        window.location.replace(url.href);
        return;
      }
    }
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
    const button = form.querySelector('button[type="submit"]');
    const password = document.getElementById("accessPassword").value;
    if (!password || button.disabled) return;
    button.disabled = true;
    document.getElementById("accessMessage").textContent = "";
    window.StorePageLoader?.start();
    try {
      const granted = await unlock(password);
      if (granted) await window.StorePageLoader?.ready();
      else window.StorePageLoader?.finish();
    } catch (error) {
      console.error("No se pudo acceder al drop:", error);
      document.getElementById("accessMessage").textContent = "No se pudo conectar. Intentá nuevamente.";
    } finally {
      window.StorePageLoader?.finish();
      button.disabled = false;
    }
  });
  async function openProduct(product) {
    if (!product || !client || !activeDrop?.id || (!accessPassword && !previewMode)) return;
    try {
      const { data, error } = previewMode
        ? { data: await window.DropPreview.products(client, activeDrop.id) }
        : await client.rpc("get_exclusive_products", { p_drop_id: activeDrop.id, p_password: accessPassword });
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
    window.ProductMeasurements.display(product);
    document.getElementById("dialogPrice").innerHTML = priceMarkup(product).replace(/<span class="discount-badge">.*?<\/span>/, "");

    window.ProductImages.setSource(mainImage, images[0]);
    mainImage.alt = product.name;
    gallery.innerHTML = "";

    images.forEach((src, index) => {
      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = `dialog-gallery-item ${index === 0 ? "active" : ""}`;
      thumb.setAttribute("aria-label", `Ver imagen ${index + 1}`);
      thumb.innerHTML = `<img src="${src}" alt="${escapeHtml(product.name)} ${index + 1}" loading="lazy" decoding="async" />`;
      thumb.addEventListener("click", () => {
        window.ProductImages.setSource(mainImage, src);
        gallery.querySelectorAll(".dialog-gallery-item").forEach((item) => item.classList.toggle("active", item === thumb));
      });
      gallery.appendChild(thumb);
      window.ProductImages.prepare(gallery);
    });

    gallery.style.display = images.length > 1 ? "flex" : "none";
    const unavailable = product.availability !== "available", notice = document.getElementById("availabilityNotice"); notice.hidden = !unavailable; notice.textContent = unavailable ? `ESTA PRENDA ESTÁ ${statusLabel(product.availability)}. ESPERÁ A QUE SE LIBERE PARA PODER INTENTAR COMPRARLA.` : "";
    whatsappButton.href = whatsappLink(product); whatsappButton.dataset.availability = product.availability || "available"; dialog.showModal();
  }
  document.addEventListener("click", (event) => { const cardEl = event.target.closest(".product-card"); if (cardEl) openProduct(products.find((p) => p.id === cardEl.dataset.id)); });
  document.getElementById("exclusiveCategorySlider").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    selectedCategory = button.dataset.category || null;
    renderProducts();
  });
  document.getElementById("dropSearch").addEventListener("input", event => {
    searchQuery = event.target.value;
    renderProducts();
  });
  document.getElementById("dropSizeFilter").addEventListener("change", event => {
    selectedSize = event.target.value;
    renderProducts();
  });
  document.getElementById("clearDropFilters").addEventListener("click", () => {
    searchQuery = "";
    selectedSize = "";
    selectedCategory = null;
    document.getElementById("dropSearch").value = "";
    document.getElementById("dropSizeFilter").value = "";
    renderProducts();
  });
  whatsappButton.addEventListener("click", (event) => { if (whatsappButton.dataset.availability !== "available") { event.preventDefault(); alert("Esta prenda está apartada o en proceso de compra. Esperá a que se libere de nuevo para poder intentar comprarla."); } });
  document.querySelector(".dialog-close").addEventListener("click", () => dialog.close()); dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  load()
    .catch(error => {
      console.error("No se pudo cargar el drop:", error);
      grid.innerHTML = previewMode ? `<p class="empty-state">${escapeHtml(error.message)}</p>` : '<p class="empty-state">NO SE PUDO CARGAR EL DROP. INTENTÁ RECARGAR LA PÁGINA.</p>';
    })
    .finally(() => window.StorePageLoader?.ready());
})();

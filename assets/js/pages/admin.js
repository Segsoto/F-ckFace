(function () {
  const config = window.FUCK_FACE_CONFIG;
  const client =
    config?.url && config?.anonKey && window.supabase
      ? window.supabase.createClient(config.url, config.anonKey)
      : null;
  const loginView = document.getElementById("loginView"),
    adminView = document.getElementById("adminView"),
    message = document.getElementById("message"),
    loginMessage = document.getElementById("loginMessage"),
    inventory = document.getElementById("inventoryList"),
    salesList = document.getElementById("salesList");
  const measurements = window.ProductMeasurements;
  function bindMeasurements(formId, containerId, categorySelector) {
    const form = document.getElementById(formId);
    const container = document.getElementById(containerId);
    const category = form.querySelector(categorySelector);
    let draft = {};
    let original = {};
    category.addEventListener("change", () => {
      Object.assign(draft, measurements.values(container));
      measurements.editor(container, category.value, draft, original);
    });
    function reset(product = {}) {
      draft = { ...product };
      original = product;
      measurements.editor(container, category.value, draft, original);
    }
    reset();
    return reset;
  }
  const resetNewMeasurements = bindMeasurements("productForm", "productMeasurements", '[name="category"]');
  const resetEditMeasurements = bindMeasurements("editProductForm", "editMeasurements", '#editCategory');
  let activeDrop = null, products = [], deletionJobs = [], removeDiscountRequested = false, inventoryQuery = "";
  const inventoryFilters = { size: "", category: "", minPrice: "", maxPrice: "", discount: "" };
  function notice(text, type = "success", target = message) {
    if (!target) return;
    target.textContent = text;
    target.className = `message show ${type}`;
    setTimeout(() => (target.className = "message"), 5000);
  }
  function filename(name) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .toLowerCase();
  }
  function localDateTimeValue(value) {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }
  document.querySelectorAll("[data-module]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const selectedModule = tab.dataset.module;
      document.querySelectorAll("[data-admin-module]").forEach((module) => {
        module.hidden = module.dataset.adminModule !== selectedModule;
      });
      document.querySelectorAll("[data-module]").forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
    });
  });
  async function isAdmin() {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return false;
    const { data, error } = await client
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  async function setup() {
    if (!client) {
      notice("Falta configurar Supabase en config.js.", "error", loginMessage);
      return;
    }
    try {
      if (await isAdmin()) {
        loginView.hidden = true;
        adminView.hidden = false;
        await loadData();
      } else {
        loginView.hidden = false;
        adminView.hidden = true;
      }
    } catch (error) {
      console.error("No se pudo verificar la sesión de Supabase:", error);
      notice(
        error.message || "No se pudo conectar con Supabase.",
        "error",
        loginMessage,
      );
    }
  }
  document
    .getElementById("loginForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!client) {
        notice(
          "Falta configurar Supabase en config.js.",
          "error",
          loginMessage,
        );
        return;
      }
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = "INGRESANDO...";
      try {
        const { error } = await client.auth.signInWithPassword({
          email: document.getElementById("email").value.trim(),
          password: document.getElementById("password").value,
        });
        if (error) {
          console.error("Error iniciando sesión en Supabase:", error);
          notice(error.message, "error", loginMessage);
          return;
        }
        if (!(await isAdmin())) {
          await client.auth.signOut();
          notice(
            "Tu usuario no tiene permiso para este panel. Autorízalo en admin_profiles.",
            "error",
            loginMessage,
          );
          return;
        }
        await setup();
      } catch (error) {
        console.error("Error iniciando sesión en Supabase:", error);
        notice(
          error.message ||
            "No se pudo iniciar sesión. Revisa la conexión y la configuración de Supabase.",
          "error",
          loginMessage,
        );
      } finally {
        button.disabled = false;
        button.textContent = "INGRESAR ↗";
      }
    });
  document
    .getElementById("logoutButton")
    .addEventListener("click", async () => {
      await client.auth.signOut();
      document.querySelectorAll('.password-field input').forEach(input => { input.value = ''; input.dispatchEvent(new Event('hide-password')); });
      activeDrop = null;
      await setup();
    });
  document.getElementById("images").addEventListener("change", (event) => {
    const count = event.target.files.length;
    document.getElementById("fileCount").textContent = count
      ? `${count} archivo${count !== 1 ? "s" : ""} seleccionado${count !== 1 ? "s" : ""}`
      : "Seleccionar archivos";
  });
  async function uploadImages(files, onProgress) {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error("Iniciá sesión otra vez antes de subir fotos.");
    const prepared = await window.ImageCompression.prepare(files, (index, total) => onProgress(`COMPRIMIENDO ${index}/${total}...`));
    const originalBytes = Array.from(files).reduce((total, file) => total + file.size, 0);
    const optimizedBytes = prepared.reduce((total, file) => total + file.size, 0);
    const bucket = client.storage.from("product-images");
    const paths = prepared.map((file) => `${user.id}/${Date.now()}-${crypto.randomUUID()}-${filename(file.name)}`);
    const urls = paths.map((path) => bucket.getPublicUrl(path).data.publicUrl);
    // Registrar las rutas primero evita perder el rastro si la carga se interrumpe.
    const { data: job, error: queueError } = await client.from("deleted_product_images")
      .insert({ product_id: crypto.randomUUID(), urls, available_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).select("id,urls").single();
    if (queueError) throw queueError;
    try {
      for (const [index, preparedFile] of prepared.entries()) {
        onProgress(`SUBIENDO ${index + 1}/${prepared.length}...`);
        const { error } = await bucket.upload(paths[index], preparedFile, {
          upsert: false, contentType: preparedFile.type, cacheControl: "86400",
        });
        if (error) throw error;
      }
    } catch (error) {
      try { await window.SalePhotos.cleanupDeleted(client, job, config.url); }
      catch (cleanupError) { console.error("La limpieza de la carga quedó pendiente:", cleanupError); }
      throw error;
    }
    return { urls, originalBytes, optimizedBytes, cleanupJob: job };
  }
  function numberOrNull(value) {
    if (value === "" || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  document
    .getElementById("productForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button");
      button.disabled = true;
      button.textContent = "SUBIENDO...";
      let uploaded;
      let productSaved = false;
      try {
        const data = new FormData(form);
        const publicationTarget = data.get("publication_target");
        const isNewDrop = publicationTarget === "new_drop";
        if (isNewDrop && !activeDrop?.id)
          throw new Error("Primero configurá el drop antes de cargar prendas.");
        uploaded = await uploadImages(
          document.getElementById("images").files,
          text => { button.textContent = text; },
        );
        const { data: insertedProduct, error } = await client.from("products").insert({
          name: data.get("name").trim(),
          price: numberOrNull(data.get("price")),
          category: data.get("category"),
          size: data.get("size") || null,
          condition: data.get("condition") || null,
          description: data.get("description") || null,
          ...measurements.values(document.getElementById("productMeasurements")),
          image_urls: uploaded.urls,
          status: isNewDrop ? "new_drop" : "published",
          availability: "available",
          drop_id: isNewDrop ? activeDrop.id : null,
        }).select().single();
        if (error) throw error;
        productSaved = true;
        // Un reintento conservará las fotos si el producto ya las referencia.
        const { error: queueError } = await client.from("deleted_product_images")
          .delete().eq("id", uploaded.cleanupJob.id).select("id").single();
        if (queueError) console.warn("Quedó pendiente cerrar el registro de carga:", queueError);
        form.reset();
        resetNewMeasurements();
        document.getElementById("fileCount").textContent =
          "Seleccionar archivos";
        products.unshift(insertedProduct);
        renderInventory();
        const saved = Math.max(0, Math.round(100 * (1 - uploaded.optimizedBytes / uploaded.originalBytes)));
        const resultText = isNewDrop ? "Pieza agregada a New Drop." : "Pieza publicada en la tienda pública.";
        notice(`${resultText} Fotos: ${(uploaded.optimizedBytes / 1000000).toFixed(2)} MB${saved ? ` (${saved}% menos peso)` : ""}.`);
      } catch (error) {
        if (uploaded && !productSaved) {
          try { await window.SalePhotos.cleanupDeleted(client, uploaded.cleanupJob, config.url); }
          catch (cleanupError) { console.error("La limpieza de la carga quedó pendiente:", cleanupError); }
        }
        console.error(error);
        notice(error.message || "No se pudo agregar la pieza.", "error");
      } finally {
        button.disabled = false;
        button.textContent = "AGREGAR A NEW DROP";
      }
    });
  document
    .getElementById("dropForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const exclusiveAt = document.getElementById("exclusiveAt").value;
      const publicAt = document.getElementById("publicAt").value;
      if (!exclusiveAt || !publicAt || (!activeDrop && new Date(exclusiveAt) <= new Date())) {
        notice("Elegí una apertura exclusiva futura.", "error");
        return;
      }
      if (new Date(publicAt) <= new Date(exclusiveAt)) {
        notice("La apertura pública debe ser posterior a la exclusiva.", "error");
        return;
      }
      const button = document.getElementById('saveDropButton');
      button.disabled = true;
      document.getElementById('deactivateDropButton').disabled = true;
      try {
        const { error } = await client.rpc("save_managed_drop", {
          p_drop_id: activeDrop?.id || null,
          p_name: document.getElementById('dropName').value.trim(),
          p_exclusive_at: new Date(exclusiveAt).toISOString(),
          p_public_at: new Date(publicAt).toISOString(),
          p_password: document.getElementById("dropPassword").value,
          p_description: document.getElementById("dropText").value || null,
        });
        if (error) throw error;
        notice(activeDrop ? "Drop actualizado correctamente." : "Drop programado correctamente.");
        document.getElementById("dropPassword").value = "";
        document.getElementById("dropPassword").dispatchEvent(new Event('hide-password'));
        await loadData();
      } catch (error) {
        notice(error.message || 'No se pudo guardar el drop.', 'error');
      } finally {
        button.disabled = false;
        document.getElementById('deactivateDropButton').disabled = false;
      }
    });
  document.getElementById('deactivateDropButton').addEventListener('click', async (event) => {
    if (!activeDrop) return;
    const button = event.currentTarget;
    button.disabled = true;
    document.getElementById('saveDropButton').disabled = true;
    try {
      const { error } = await client.rpc('deactivate_drop', { p_drop_id: activeDrop.id });
      if (error) throw error;
      await loadData();
      notice('Drop desactivado. Sus prendas se conservan sin publicar.');
    } catch (error) { notice(error.message || 'No se pudo desactivar el drop.', 'error'); }
    finally { button.disabled = false; document.getElementById('saveDropButton').disabled = false; }
  });
  async function loadData() {
    const { error: releaseError } = await client.rpc("release_due_drops");
    if (releaseError) console.warn("No se pudieron publicar drops vencidos:", releaseError);
    const [
      { data: loadedProducts, error: productsError },
      { data: drops, error: dropsError },
    ] = await Promise.all([
      client
        .from("products")
        .select("*")
        .order("created_at", { ascending: false }),
      client
        .from("drops")
        .select("*")
        .eq("is_active", true)
        .order("release_at", { ascending: true })
        .limit(1),
    ]);
    if (productsError) throw productsError;
    if (dropsError) {
      console.warn("No se pudo actualizar la información del drop:", dropsError);
    }
    products = loadedProducts || [];
    const drop = dropsError ? activeDrop : drops?.[0] || null;
    activeDrop = drop;
    document.getElementById("previewDropLink").hidden = !drop;
    document.getElementById("activeDrop").textContent = drop
      ? `${drop.name || "DROP"} · EXCLUSIVO: ${new Date(drop.exclusive_at).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })} · PÚBLICO: ${new Date(drop.public_at || drop.release_at).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })}`
      : "SIN DROP PROGRAMADO";
    document.getElementById('saveDropButton').textContent = drop ? 'GUARDAR CAMBIOS' : 'PROGRAMAR DROP';
    document.getElementById('deactivateDropButton').hidden = !drop;
    document.getElementById('savedPasswordSection').hidden = !drop;
    const savedPassword = document.getElementById('savedDropPassword');
    savedPassword.value = '';
    savedPassword.dispatchEvent(new Event('hide-password'));
    document.getElementById('savedPasswordHelp').textContent = '';
    if (!drop) document.getElementById('dropForm').reset();
    if (drop) {
      document.getElementById('dropName').value = drop.name || 'New Drop';
      const { data: secret, error: secretError } = await client.from('drop_passwords').select('password').eq('drop_id', drop.id).maybeSingle();
      savedPassword.value = secret?.password || '';
      document.getElementById('savedPasswordHelp').textContent = secretError ? 'No se pudo consultar la contraseña guardada.' : secret ? 'Solo visible para administradores. Usá el ojo para consultarla.' : 'Contraseña antigua: volvé a ingresarla y guardá el drop para poder consultarla aquí.';
      document.getElementById("exclusiveAt").value = localDateTimeValue(drop.exclusive_at);
      document.getElementById("publicAt").value = localDateTimeValue(drop.public_at || drop.release_at);
      document.getElementById("dropText").value = drop.description || "";
    }
    renderInventory();
    await loadDeletionJobs();
  }
  async function loadDeletionJobs() {
    const { data, error } = await client.from("deleted_product_images").select("id,urls,created_at").lte("available_at", new Date().toISOString()).order("created_at", { ascending: true });
    if (error) { console.warn("No se pudieron consultar las fotos pendientes de eliminación:", error); return; }
    deletionJobs = data || [];
    const panel = document.getElementById("deletedPhotoCleanup");
    panel.hidden = !deletionJobs.length;
    document.getElementById("deletedPhotoCleanupHelp").textContent = deletionJobs.length ? `${deletionJobs.length} ${deletionJobs.length === 1 ? "limpieza de fotos pendiente" : "limpiezas de fotos pendientes"}.` : "";
  }
  async function cleanupDeletionJobs(jobs = deletionJobs) {
    let incomplete = 0;
    for (const job of jobs) {
      try { if (await window.SalePhotos.cleanupDeleted(client, job, config.url)) incomplete++; }
      catch (error) { console.error("No se pudo completar la limpieza de fotos:", error); incomplete++; }
    }
    await loadDeletionJobs();
    return incomplete;
  }
  document.getElementById("retryDeletedPhotos").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const incomplete = await cleanupDeletionJobs();
    notice(incomplete ? `${incomplete} limpiezas siguen pendientes. Reintentá más tarde.` : "Fotos pendientes eliminadas de Storage.", incomplete ? "error" : "success");
    button.disabled = false;
  });
  function renderInventory() {
    syncSizeFilterOptions();
    const activeProducts = products.filter((product) => product.status !== "sold");
    const query = inventoryQuery.trim().toLocaleLowerCase();
    const minPrice = Number(inventoryFilters.minPrice);
    const maxPrice = Number(inventoryFilters.maxPrice);
    const hasMinPrice = inventoryFilters.minPrice !== "" && Number.isFinite(minPrice);
    const hasMaxPrice = inventoryFilters.maxPrice !== "" && Number.isFinite(maxPrice);
    const visibleProducts = activeProducts.filter((product) => {
      const discounted = Number(product.original_price) > Number(product.price);
      const matchesQuery = !query || [product.name, product.category, product.size, product.status, product.condition, product.description]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
      const matchesSize = !inventoryFilters.size || (product.size || "").toLocaleLowerCase() === inventoryFilters.size;
      const matchesCategory = !inventoryFilters.category || product.category === inventoryFilters.category;
      const matchesMinPrice = !hasMinPrice || Number(product.price) >= minPrice;
      const matchesMaxPrice = !hasMaxPrice || Number(product.price) <= maxPrice;
      const matchesDiscount = !inventoryFilters.discount || (inventoryFilters.discount === "discounted" ? discounted : !discounted);
      return matchesQuery && matchesSize && matchesCategory && matchesMinPrice && matchesMaxPrice && matchesDiscount;
    });
    const hasFilters = query || Object.values(inventoryFilters).some(Boolean);
    document.getElementById("inventoryCount").textContent = query
      ? `${visibleProducts.length} DE ${activeProducts.length} PIEZAS`
      : hasFilters ? `${visibleProducts.length} DE ${activeProducts.length} PIEZAS`
      : `${activeProducts.length} PIEZAS`;
    inventory.innerHTML = visibleProducts.map((product) =>
      `<article class="inventory-row"><img src="${safe(product.image_urls?.[0] || "img/logo1.jpg")}" alt="" loading="lazy" decoding="async"><div><h3>${safe(product.name)}</h3><p>${safe(product.category)} · ${safe(product.size || "Sin talla")} · ₡${Number(product.price).toLocaleString("es-CR")}${product.original_price ? ` <s>₡${Number(product.original_price).toLocaleString("es-CR")}</s>` : ""}</p><span class="status ${safe(product.status)}">${product.status === "new_drop" ? "NEW DROP" : "PUBLICADA"}</span></div><select class="availability" data-availability="${safe(product.id)}" aria-label="Estado de ${safe(product.name)}"><option value="available" ${product.availability === "available" ? "selected" : ""}>DISPONIBLE</option><option value="reserved" ${product.availability === "reserved" ? "selected" : ""}>APARTADA</option><option value="payment_pending" ${product.availability === "payment_pending" ? "selected" : ""}>EN PROCESO</option></select><button class="edit" data-edit="${safe(product.id)}" type="button">EDITAR</button><button class="sold" data-sold="${safe(product.id)}" type="button">VENDIDA</button><button class="delete" data-delete="${safe(product.id)}" type="button">ELIMINAR</button></article>`
    ).join("") || "<p>NO HAY PIEZAS TODAVÍA.</p>";
    renderSales();
  }
  function renderSales() {
    const sold = products.filter((product) => product.status === "sold").sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at));
    const currency = (value) => `₡${Number(value).toLocaleString("es-CR")}`;
    const report = window.SalesReport.build(sold);
    document.getElementById("salesCount").textContent = sold.length.toLocaleString("es-CR");
    document.getElementById("salesTotal").textContent = currency(sold.reduce((total, product) => total + Number(product.sale_price || 0), 0));
    for (const [kind, suffix] of [["week", "Week"], ["fortnight", "Fortnight"], ["month", "Month"]]) {
      const current = report[kind].current;
      document.getElementById(`sales${suffix}Total`).textContent = currency(current.total);
      document.getElementById(`sales${suffix}Label`).textContent = current.label;
      document.getElementById(`sales${suffix}Count`).textContent = `${current.count} ${current.count === 1 ? "prenda" : "prendas"}`;
    }
    const selectedPeriod = document.getElementById("salesPeriodFilter").value;
    document.getElementById("salesPeriodList").innerHTML = report[selectedPeriod].history.map((period) => `<div class="sales-period-row"><span>${safe(period.label)}</span><span>${period.count} ${period.count === 1 ? "venta" : "ventas"}</span><strong>${currency(period.total)}</strong></div>`).join("");
    salesList.innerHTML = sold.map((product) => {
      const firstImage = product.image_urls?.[0] || "img/logo1.jpg";
      const cover = window.ProductThumbnails?.[product.id];
      const preview = cover?.source === firstImage ? cover.thumbnail : firstImage;
      return `<article class="sale-row"><img src="${safe(preview)}" alt="Vista previa de ${safe(product.name)}" loading="lazy" decoding="async"><div><h3>${safe(product.name)}</h3><p>${safe(product.category)} · ${safe(product.size || "Sin talla")}</p><button type="button" class="sale-detail-link" data-detail="${safe(product.id)}">VER FICHA ↗</button></div><div class="sale-row-amount"><strong>${currency(product.sale_price)}</strong><span>${product.sold_at ? new Date(product.sold_at).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "medium", timeStyle: "short" }) : "Sin fecha"}</span></div><button type="button" class="secondary sale-restore" data-restore="${safe(product.id)}">REVERTIR</button></article>`;
    }).join("") || "<p>NO HAY VENTAS REGISTRADAS TODAVÍA.</p>";
    const cleanup = sold.filter((product) => window.SalePhotos.plan(product).extra.length || product.image_cleanup_pending?.length);
    const cleanupButton = document.getElementById("cleanupSoldPhotos");
    cleanupButton.hidden = !cleanup.length;
    const cleanupHelp = document.getElementById("salePhotoCleanupHelp");
    cleanupHelp.hidden = !cleanup.length;
    cleanupHelp.textContent = cleanup.length ? `${cleanup.length} ${cleanup.length === 1 ? "venta tiene" : "ventas tienen"} fotos adicionales o una limpieza pendiente. Conservá solo la primera foto de cada una.` : "";
  }
  document.getElementById("salesPeriodFilter").addEventListener("change", renderSales);
  function syncSizeFilterOptions() {
    const sizeFilter = document.getElementById("inventorySizeFilter");
    const sizes = [...new Set(products.filter((product) => product.status !== "sold").map((product) => product.size?.trim()).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second, "es", { numeric: true }));
    const currentValue = inventoryFilters.size;
    sizeFilter.innerHTML = `<option value="">TODAS LAS TALLAS</option>${sizes.map((size) => `<option value="${safe(size.toLocaleLowerCase())}">${safe(size.toUpperCase())}</option>`).join("")}`;
    sizeFilter.value = sizes.some((size) => size.toLocaleLowerCase() === currentValue) ? currentValue : "";
  }
  document.getElementById("inventorySearch").addEventListener("input", (event) => {
    inventoryQuery = event.target.value;
    renderInventory();
  });
  document.querySelectorAll("#publishedModule .inventory-filters input, #publishedModule .inventory-filters select").forEach((control) => {
    control.addEventListener("input", updateInventoryFilter);
    control.addEventListener("change", updateInventoryFilter);
  });
  function updateInventoryFilter(event) {
    const filterName = {
      inventorySizeFilter: "size",
      inventoryCategoryFilter: "category",
      inventoryMinPrice: "minPrice",
      inventoryMaxPrice: "maxPrice",
      inventoryDiscountFilter: "discount",
    }[event.target.id];
    if (!filterName) return;
    inventoryFilters[filterName] = event.target.value.trim().toLocaleLowerCase();
    renderInventory();
  }
  document.getElementById("clearInventoryFilters").addEventListener("click", () => {
    inventoryQuery = "";
    Object.keys(inventoryFilters).forEach((key) => { inventoryFilters[key] = ""; });
    document.getElementById("inventorySearch").value = "";
    document.querySelectorAll("#publishedModule .inventory-filters input, #publishedModule .inventory-filters select").forEach((control) => { control.value = ""; });
    renderInventory();
  });
  function safe(text = "") {
    const node = document.createElement("span");
    node.textContent = text;
    return node.innerHTML;
  }
  inventory.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit]");
    if (editButton) { openEditProduct(products.find((product) => product.id === editButton.dataset.edit)); return; }
    const soldButton = event.target.closest("[data-sold]");
    if (soldButton) {
      const product = products.find((item) => item.id === soldButton.dataset.sold);
      if (!product) return;
      document.getElementById("saleProductId").value = product.id;
      document.getElementById("saleProductTitle").textContent = product.name;
      document.getElementById("salePrice").value = product.price;
      saleDialog.showModal();
      return;
    }
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    if (!confirm("¿Eliminar definitivamente esta pieza y todas sus fotos? No se registrará como venta.")) return;
    button.disabled = true;
    const { data: jobId, error } = await client.rpc("delete_product_for_admin", { p_product_id: button.dataset.delete });
    if (error) {
      notice(error.message, "error");
      button.disabled = false;
      return;
    }
    products = products.filter((product) => product.id !== button.dataset.delete);
    renderInventory();
    await loadDeletionJobs();
    const jobs = deletionJobs.filter((job) => job.id === jobId);
    const incomplete = jobs.length ? await cleanupDeletionJobs(jobs) : 1;
    notice(incomplete ? "Pieza eliminada. Algunas fotos siguen pendientes de borrar; reintentá desde el inventario." : "Pieza y fotos eliminadas.", incomplete ? "error" : "success");
  });
  const saleDialog = document.getElementById("saleDialog");
  document.getElementById("closeSaleDialog").addEventListener("click", () => saleDialog.close());
  saleDialog.addEventListener("click", (event) => { if (event.target === saleDialog) saleDialog.close(); });
  async function cleanupSalePhotos(product) {
    const result = await window.SalePhotos.cleanup(client, product, config.url);
    products = products.map((item) => item.id === product.id ? result.product : item);
    return result;
  }
  async function retainFirstSalePhoto(product) {
    const { kept, extra } = window.SalePhotos.plan(product);
    let current = product;
    if (extra.length) {
      const pending = [...new Set([...(product.image_cleanup_pending || []), ...extra])];
      const { data, error } = await client.from("products").update({ image_urls: kept, image_cleanup_pending: pending, updated_at: new Date().toISOString() }).eq("id", product.id).eq("status", "sold").eq("updated_at", product.updated_at).select().single();
      if (error) throw error;
      current = data;
      products = products.map((item) => item.id === product.id ? data : item);
    }
    return cleanupSalePhotos(current);
  }
  document.getElementById("saleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const product = products.find((item) => item.id === document.getElementById("saleProductId").value);
    const salePrice = Number(document.getElementById("salePrice").value);
    if (!product || !Number.isSafeInteger(salePrice) || salePrice < 0) { notice("Ingresá un monto de venta válido.", "error"); return; }
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const { kept, extra } = window.SalePhotos.plan(product);
      const { data, error } = await client.from("products").update({ status: "sold", sale_origin_status: product.status, sale_price: salePrice, sold_at: new Date().toISOString(), image_urls: kept, image_cleanup_pending: extra, updated_at: new Date().toISOString() }).eq("id", product.id).eq("status", product.status).eq("updated_at", product.updated_at).select().single();
      if (error) throw error;
      products = products.map((item) => item.id === product.id ? data : item);
      saleDialog.close(); renderInventory();
      try {
        const result = await cleanupSalePhotos(data);
        renderInventory();
        notice(result.remaining ? "Venta registrada con una foto. Quedaron archivos pendientes de borrar; reintentá desde el historial." : "Venta registrada. Se conservó únicamente la primera foto.", result.remaining ? "error" : "success");
      } catch (cleanupError) { notice("Venta registrada con una foto. No se pudieron borrar todas las demás; reintentá desde el historial.", "error"); }
    } catch (error) { notice(error.message || "No se pudo registrar la venta.", "error"); }
    finally { button.disabled = false; }
  });
  document.getElementById("cleanupSoldPhotos").addEventListener("click", async (event) => {
    const candidates = products.filter((product) => product.status === "sold" && (window.SalePhotos.plan(product).extra.length || product.image_cleanup_pending?.length));
    if (!candidates.length || !confirm(`¿Conservar solo la primera foto en ${candidates.length} ${candidates.length === 1 ? "venta" : "ventas"}? Las fotos adicionales se borrarán definitivamente.`)) return;
    const button = event.currentTarget;
    button.disabled = true;
    let incomplete = 0;
    for (const [index, product] of candidates.entries()) {
      button.textContent = `LIMPIANDO ${index + 1}/${candidates.length}...`;
      try { if ((await retainFirstSalePhoto(product)).remaining) incomplete++; }
      catch (error) { console.error("No se pudieron limpiar las fotos de una venta:", error); incomplete++; }
    }
    button.disabled = false;
    button.textContent = "CONSERVAR SOLO UNA FOTO EN VENTAS";
    renderInventory();
    notice(incomplete ? `${candidates.length - incomplete} ventas limpiadas; ${incomplete} pendientes. Reintentá más tarde.` : "Historial actualizado: una foto por prenda vendida.", incomplete ? "error" : "success");
  });
  salesList.addEventListener("click", async (event) => {
    const detailButton = event.target.closest("[data-detail]");
    if (detailButton) { openSaleDetail(products.find((item) => item.id === detailButton.dataset.detail)); return; }
    const button = event.target.closest("[data-restore]");
    if (!button) return;
    const product = products.find((item) => item.id === button.dataset.restore);
    if (!product || !confirm(`¿Revertir la venta de ${product.name}? Se descontará del total. Las fotos adicionales que ya se borraron no se podrán recuperar.`)) return;
    button.disabled = true;
    let currentProduct = product;
    if (product.image_cleanup_pending?.length) {
      try {
        const result = await cleanupSalePhotos(product);
        if (result.remaining) { notice("Primero completá la limpieza de fotos pendiente antes de revertir la venta.", "error"); renderInventory(); return; }
        currentProduct = result.product;
      } catch (error) { notice("No se pudo completar la limpieza de fotos pendiente.", "error"); button.disabled = false; return; }
    }
    const restoreStatus = currentProduct.sale_origin_status === "new_drop" && activeDrop?.id === currentProduct.drop_id && new Date(activeDrop.public_at || activeDrop.release_at) > new Date() ? "new_drop" : "published";
    const { data, error } = await client.from("products").update({ status: restoreStatus, sale_origin_status: null, sale_price: null, sold_at: null, image_cleanup_pending: [], availability: "available", updated_at: new Date().toISOString() }).eq("id", product.id).eq("status", "sold").eq("updated_at", currentProduct.updated_at).select().single();
    if (error) { notice(error.message || "No se pudo revertir la venta.", "error"); button.disabled = false; return; }
    products = products.map((item) => item.id === product.id ? data : item);
    renderInventory(); notice("Venta revertida.");
  });
  const saleDetailDialog = document.getElementById("saleDetailDialog");
  function openSaleDetail(product) {
    if (!product || product.status !== "sold") return;
    const currency = (value) => `₡${Number(value).toLocaleString("es-CR")}`;
    const facts = document.getElementById("saleDetailFacts");
    const measures = document.getElementById("saleDetailMeasurements");
    const addFact = (list, label, value) => {
      const row = document.createElement("div");
      const term = document.createElement("dt"), description = document.createElement("dd");
      term.textContent = label; description.textContent = value;
      row.append(term, description); list.append(row);
    };
    document.getElementById("saleDetailTitle").textContent = product.name;
    facts.replaceChildren(); measures.replaceChildren();
    addFact(facts, "MONTO VENDIDO", currency(product.sale_price));
    addFact(facts, "FECHA DE VENTA", new Date(product.sold_at).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "long", timeStyle: "short" }));
    addFact(facts, "PRECIO PUBLICADO", currency(product.price));
    if (product.original_price) addFact(facts, "PRECIO ANTERIOR", currency(product.original_price));
    addFact(facts, "CATEGORÍA", product.category || "—");
    addFact(facts, "TALLA", product.size || "—");
    addFact(facts, "ESTADO", product.condition || "—");
    addFact(facts, "PUBLICACIÓN ANTERIOR", product.sale_origin_status === "new_drop" ? "NEW DROP" : "TIENDA PÚBLICA");
    addFact(facts, "FECHA DE PUBLICACIÓN", product.created_at ? new Date(product.created_at).toLocaleString("es-CR", { timeZone: "America/Costa_Rica", dateStyle: "medium", timeStyle: "short" }) : "—");
    document.getElementById("saleDetailDescription").textContent = product.description || "Sin descripción registrada.";
    const knownMeasurements = new Map([["length_cm", "LARGO"], ["chest_width_cm", "ANCHO DE PECHO"], ["sleeve_width_cm", "ANCHO DE MANGA"], ["waist_width_cm", "ANCHO DE CINTURA"], ["inseam_cm", "ANCHO DE PIERNA"], ["height_cm", "ALTO"], ["width_cm", "ANCHO"], ["depth_cm", "FONDO"], ...measurements.fields(product.category)]);
    for (const [key, label] of knownMeasurements) if (product[key] != null) addFact(measures, label, `${product[key]} cm`);
    if (!measures.childElementCount) addFact(measures, "MEDIDAS", "Sin medidas registradas.");
    const images = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : [];
    const firstImage = images[0] || "img/logo1.jpg";
    const cover = window.ProductThumbnails?.[product.id];
    const fallback = cover?.source === firstImage ? cover.thumbnail : "img/logo1.jpg";
    const main = document.getElementById("saleDetailImage");
    main.onerror = () => { if (main.src !== new URL(fallback, window.location.href).href) main.src = fallback; };
    main.src = firstImage; main.alt = product.name;
    const gallery = document.getElementById("saleDetailGallery");
    gallery.replaceChildren();
    gallery.hidden = images.length <= 1;
    images.forEach((src, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = String(index + 1).padStart(2, "0");
      button.setAttribute("aria-label", `Ver foto ${index + 1} de ${product.name}`);
      button.classList.toggle("is-active", index === 0);
      button.addEventListener("click", () => {
        main.src = src;
        gallery.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
      });
      gallery.append(button);
    });
    saleDetailDialog.showModal();
  }
  document.getElementById("closeSaleDetail").addEventListener("click", () => saleDetailDialog.close());
  document.getElementById("backToSales").addEventListener("click", () => saleDetailDialog.close());
  saleDetailDialog.addEventListener("click", (event) => { if (event.target === saleDetailDialog) saleDetailDialog.close(); });
  const editDialog = document.getElementById("editProductDialog");
  function openEditProduct(product) {
    if (!product) return;
    removeDiscountRequested = false;
    document.getElementById("editProductId").value = product.id;
    document.getElementById("editProductTitle").textContent = product.name;
    document.getElementById("editName").value = product.name || "";
    document.getElementById("editPrice").value = product.price;
    document.getElementById("editCategory").value = product.category;
    document.getElementById("editSize").value = product.size || "";
    resetEditMeasurements(product);
    document.getElementById("editCondition").value = product.condition || "";
    document.getElementById("editDescription").value = product.description || "";
    document.getElementById("priceHelp").textContent = product.original_price ? `Precio anterior actual: ₡${Number(product.original_price).toLocaleString("es-CR")}. Si el precio vuelve a ser igual o mayor, la rebaja se quitará.` : "Al bajar el precio, se conservará automáticamente el precio anterior para mostrar la rebaja.";
    editDialog.showModal();
  }
  document.getElementById("closeEditProduct").addEventListener("click", () => editDialog.close());
  editDialog.addEventListener("click", (event) => { if (event.target === editDialog) editDialog.close(); });
  document.getElementById("removeDiscount").addEventListener("click", () => { removeDiscountRequested = true; document.getElementById("priceHelp").textContent = "La rebaja se eliminará al guardar."; });
  document.getElementById("editProductForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const product = products.find((item) => item.id === document.getElementById("editProductId").value);
    if (!product) return;
    const button = event.currentTarget.querySelector('[type="submit"]');
    const price = numberOrNull(document.getElementById("editPrice").value);
    if (price === null) {
      notice("Ingresá un precio válido.", "error");
      return;
    }
    let originalPrice = numberOrNull(product.original_price);
    if (removeDiscountRequested) originalPrice = null;
    else if (price < product.price) originalPrice = Math.max(product.original_price || 0, product.price);
    else if (originalPrice && price >= originalPrice) originalPrice = null;
    if (originalPrice !== null && originalPrice <= price) originalPrice = null;
    button.disabled = true; button.textContent = "GUARDANDO...";
    try {
      const { data: updatedProduct, error } = await client.from("products").update({
        name: document.getElementById("editName").value.trim(), price, original_price: originalPrice,
        category: document.getElementById("editCategory").value, size: document.getElementById("editSize").value.trim() || null,
        ...measurements.values(document.getElementById("editMeasurements")),
        condition: document.getElementById("editCondition").value.trim() || null, description: document.getElementById("editDescription").value.trim() || null,
        updated_at: new Date().toISOString()
      }).eq("id", product.id).select().single();
      if (error) { notice(error.message, "error"); return; }
      products = products.map((item) => item.id === product.id ? updatedProduct : item);
      renderInventory();
      editDialog.close(); notice("Prenda actualizada.");
    } catch (error) {
      console.error("Error actualizando la prenda:", error);
      notice(error.message || "No se pudo actualizar la prenda.", "error");
    } finally {
      button.disabled = false; button.textContent = "GUARDAR CAMBIOS";
    }
  });
  inventory.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-availability]");
    if (!select) return;
    const product = products.find((item) => item.id === select.dataset.availability);
    const previousValue = product?.availability || select.value;
    select.disabled = true;
    const { error } = await client
      .from("products")
      .update({ availability: select.value, updated_at: new Date().toISOString() })
      .eq("id", select.dataset.availability);
    if (error) notice(error.message, "error");
    else {
      if (product) product.availability = select.value;
      notice("Estado de la prenda actualizado.");
    }
    if (error) select.value = previousValue;
    select.disabled = false;
  });
  setup();
})();

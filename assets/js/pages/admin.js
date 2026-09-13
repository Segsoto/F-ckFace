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
    inventory = document.getElementById("inventoryList");
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
  let activeDrop = null, products = [], removeDiscountRequested = false, inventoryQuery = "";
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
  async function optimizeImage(file) {
    const maxDimension = 1800;
    const maxBytes = 1.5 * 1024 * 1024;
    if (file.size <= maxBytes) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo preparar una imagen.")), "image/jpeg", 0.82);
    });
    return new File([blob], `${filename(file.name)}.jpg`, { type: "image/jpeg" });
  }
  async function uploadImages(files) {
    const {
      data: { user },
    } = await client.auth.getUser();
    const selected = [...files].slice(0, 7);
    if (!selected.length) throw new Error("Seleccioná al menos una foto.");
    if (files.length > 7) throw new Error("Podés cargar un máximo de 7 fotos.");
    return Promise.all(selected.map(async (file) => {
      if (!file.type.startsWith("image/"))
        throw new Error("Solo podés cargar archivos de imagen.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Cada imagen debe pesar menos de 10 MB.");
      const preparedFile = await optimizeImage(file);
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${filename(file.name)}`;
      const { error } = await client.storage
        .from("product-images")
        .upload(path, preparedFile, { upsert: false });
      if (error) throw error;
      const { data } = client.storage.from("product-images").getPublicUrl(path);
      return data.publicUrl;
    }));
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
      try {
        const data = new FormData(form);
        const publicationTarget = data.get("publication_target");
        const isNewDrop = publicationTarget === "new_drop";
        if (isNewDrop && !activeDrop?.id)
          throw new Error("Primero configurá el drop antes de cargar prendas.");
        const image_urls = await uploadImages(
          document.getElementById("images").files,
        );
        const { data: insertedProduct, error } = await client.from("products").insert({
          name: data.get("name").trim(),
          price: numberOrNull(data.get("price")),
          category: data.get("category"),
          size: data.get("size") || null,
          condition: data.get("condition") || null,
          description: data.get("description") || null,
          ...measurements.values(document.getElementById("productMeasurements")),
          image_urls,
          status: isNewDrop ? "new_drop" : "published",
          availability: "available",
          drop_id: isNewDrop ? activeDrop.id : null,
        }).select().single();
        if (error) throw error;
        form.reset();
        resetNewMeasurements();
        document.getElementById("fileCount").textContent =
          "Seleccionar archivos";
        products.unshift(insertedProduct);
        renderInventory();
        notice(isNewDrop ? "Pieza agregada a New Drop." : "Pieza publicada en la tienda pública.");
      } catch (error) {
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
  }
  function renderInventory() {
    syncSizeFilterOptions();
    const query = inventoryQuery.trim().toLocaleLowerCase();
    const minPrice = Number(inventoryFilters.minPrice);
    const maxPrice = Number(inventoryFilters.maxPrice);
    const hasMinPrice = inventoryFilters.minPrice !== "" && Number.isFinite(minPrice);
    const hasMaxPrice = inventoryFilters.maxPrice !== "" && Number.isFinite(maxPrice);
    const visibleProducts = products.filter((product) => {
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
      ? `${visibleProducts.length} DE ${products.length} PIEZAS`
      : hasFilters ? `${visibleProducts.length} DE ${products.length} PIEZAS`
      : `${products.length} PIEZAS`;
    inventory.innerHTML = visibleProducts.map((product) =>
      `<article class="inventory-row"><img src="${safe(product.image_urls?.[0] || "img/logo1.jpg")}" alt="" loading="lazy" decoding="async"><div><h3>${safe(product.name)}</h3><p>${safe(product.category)} · ${safe(product.size || "Sin talla")} · ₡${Number(product.price).toLocaleString("es-CR")}${product.original_price ? ` <s>₡${Number(product.original_price).toLocaleString("es-CR")}</s>` : ""}</p><span class="status ${safe(product.status)}">${product.status === "new_drop" ? "NEW DROP" : "PUBLICADA"}</span></div><select class="availability" data-availability="${safe(product.id)}" aria-label="Estado de ${safe(product.name)}"><option value="available" ${product.availability === "available" ? "selected" : ""}>DISPONIBLE</option><option value="reserved" ${product.availability === "reserved" ? "selected" : ""}>APARTADA</option><option value="payment_pending" ${product.availability === "payment_pending" ? "selected" : ""}>EN PROCESO</option></select><button class="edit" data-edit="${safe(product.id)}">EDITAR</button><button class="delete" data-delete="${safe(product.id)}">VENDIDA / ELIMINAR</button></article>`
    ).join("") || "<p>NO HAY PIEZAS TODAVÍA.</p>";
  }
  function syncSizeFilterOptions() {
    const sizeFilter = document.getElementById("inventorySizeFilter");
    const sizes = [...new Set(products.map((product) => product.size?.trim()).filter(Boolean))]
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
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    if (!confirm("¿Eliminar esta pieza del inventario?")) return;
    const { error } = await client
      .from("products")
      .delete()
      .eq("id", button.dataset.delete);
    if (error) {
      notice(error.message, "error");
      return;
    }
    notice("Pieza eliminada.");
    products = products.filter((product) => product.id !== button.dataset.delete);
    renderInventory();
  });
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

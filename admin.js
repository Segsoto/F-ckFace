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
  let activeDrop = null, products = [], removeDiscountRequested = false;
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
  async function uploadImages(files) {
    const {
      data: { user },
    } = await client.auth.getUser();
    const selected = [...files].slice(0, 7);
    if (!selected.length) throw new Error("Seleccioná al menos una foto.");
    if (files.length > 7) throw new Error("Podés cargar un máximo de 7 fotos.");
    const urls = [];
    for (const file of selected) {
      if (!file.type.startsWith("image/"))
        throw new Error("Solo podés cargar archivos de imagen.");
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Cada imagen debe pesar menos de 10 MB.");
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${filename(file.name)}`;
      const { error } = await client.storage
        .from("product-images")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = client.storage.from("product-images").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
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
        if (!activeDrop?.id)
          throw new Error("Primero configurá el drop antes de cargar prendas.");
        const image_urls = await uploadImages(
          document.getElementById("images").files,
        );
        const { error } = await client.from("products").insert({
          name: data.get("name").trim(),
          price: numberOrNull(data.get("price")),
          category: data.get("category"),
          size: data.get("size") || null,
          condition: data.get("condition") || null,
          description: data.get("description") || null,
          length_cm: numberOrNull(data.get("length_cm")),
          chest_width_cm: numberOrNull(data.get("chest_width_cm")),
          image_urls,
          status: "new_drop",
          availability: "available",
          drop_id: activeDrop.id,
        });
        if (error) throw error;
        form.reset();
        document.getElementById("fileCount").textContent =
          "Seleccionar archivos";
        notice("Pieza agregada a New Drop.");
        try {
          await loadData();
        } catch (refreshError) {
          console.error("La pieza se guardó, pero no se pudo actualizar la lista:", refreshError);
          notice("La pieza se guardó. Actualizá la lista en unos segundos.", "error");
        }
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
    document.getElementById("inventoryCount").textContent =
      `${products.length} PIEZAS`;
    inventory.innerHTML =
      products
        .map(
          (product) =>
            `<article class="inventory-row"><img src="${safe(product.image_urls?.[0] || "img/logo1.jpg")}" alt=""><div><h3>${safe(product.name)}</h3><p>${safe(product.category)} · ${safe(product.size || "Sin talla")} · ₡${Number(product.price).toLocaleString("es-CR")}${product.original_price ? ` <s>₡${Number(product.original_price).toLocaleString("es-CR")}</s>` : ""}</p><span class="status ${safe(product.status)}">${product.status === "new_drop" ? "NEW DROP" : "PUBLICADA"}</span></div><select class="availability" data-availability="${safe(product.id)}" aria-label="Estado de ${safe(product.name)}"><option value="available" ${product.availability === "available" ? "selected" : ""}>DISPONIBLE</option><option value="reserved" ${product.availability === "reserved" ? "selected" : ""}>APARTADA</option><option value="payment_pending" ${product.availability === "payment_pending" ? "selected" : ""}>EN PROCESO</option></select><button class="edit" data-edit="${safe(product.id)}">EDITAR</button><button class="delete" data-delete="${safe(product.id)}">VENDIDA / ELIMINAR</button></article>`,
        )
        .join("") || "<p>NO HAY PIEZAS TODAVÍA.</p>";
  }
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
    await loadData();
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
    document.getElementById("editLength").value = product.length_cm || "";
    document.getElementById("editChestWidth").value = product.chest_width_cm || "";
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
      const { error } = await client.from("products").update({
        name: document.getElementById("editName").value.trim(), price, original_price: originalPrice,
        category: document.getElementById("editCategory").value, size: document.getElementById("editSize").value.trim() || null,
        length_cm: numberOrNull(document.getElementById("editLength").value), chest_width_cm: numberOrNull(document.getElementById("editChestWidth").value),
        condition: document.getElementById("editCondition").value.trim() || null, description: document.getElementById("editDescription").value.trim() || null,
        updated_at: new Date().toISOString()
      }).eq("id", product.id);
      if (error) { notice(error.message, "error"); return; }
      editDialog.close(); notice("Prenda actualizada.");
      await loadData();
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
    select.disabled = true;
    const { error } = await client
      .from("products")
      .update({ availability: select.value, updated_at: new Date().toISOString() })
      .eq("id", select.dataset.availability);
    if (error) notice(error.message, "error");
    else notice("Estado de la prenda actualizado.");
    await loadData();
  });
  setup();
})();

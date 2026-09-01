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
  let activeDrop = null;
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
    const { data } = await client
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
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
      const button = event.currentTarget.querySelector("button");
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
    const selected = [...files].slice(0, 4);
    if (!selected.length) throw new Error("Seleccioná al menos una foto.");
    if (files.length > 4) throw new Error("Podés cargar un máximo de 4 fotos.");
    const urls = [];
    for (const file of selected) {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Cada imagen debe pesar menos de 5 MB.");
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
  document
    .getElementById("productForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button");
      button.disabled = true;
      button.textContent = "SUBIENDO...";
      try {
        const data = new FormData(event.currentTarget);
        if (!activeDrop?.id)
          throw new Error("Primero configurá el drop antes de cargar prendas.");
        const image_urls = await uploadImages(
          document.getElementById("images").files,
        );
        const { error } = await client.from("products").insert({
          name: data.get("name"),
          price: Number(data.get("price")),
          category: data.get("category"),
          size: data.get("size") || null,
          condition: data.get("condition") || null,
          description: data.get("description") || null,
          length_cm: data.get("length_cm") || null,
          chest_width_cm: data.get("chest_width_cm") || null,
          image_urls,
          status: "new_drop",
          availability: "available",
          drop_id: activeDrop.id,
        });
        if (error) throw error;
        event.currentTarget.reset();
        document.getElementById("fileCount").textContent =
          "Seleccionar archivos";
        notice("Pieza agregada a New Drop.");
        await loadData();
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
      if (!exclusiveAt || !publicAt || new Date(exclusiveAt) <= new Date()) {
        notice("Elegí una apertura exclusiva futura.", "error");
        return;
      }
      if (new Date(publicAt) <= new Date(exclusiveAt)) {
        notice("La apertura pública debe ser posterior a la exclusiva.", "error");
        return;
      }
      const { error } = await client.rpc("save_active_drop", {
        p_exclusive_at: new Date(exclusiveAt).toISOString(),
        p_public_at: new Date(publicAt).toISOString(),
        p_password: document.getElementById("dropPassword").value,
        p_description: document.getElementById("dropText").value || null,
      });
      if (error) {
        notice(error.message, "error");
        return;
      }
      notice("Drop programado correctamente.");
      document.getElementById("dropPassword").value = "";
      await loadData();
    });
  async function loadData() {
    await client.rpc("release_due_drops");
    const [{ data: products, error }, { data: drops }] = await Promise.all([
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
    if (error) {
      notice(error.message, "error");
      return;
    }
    const drop = drops?.[0];
    activeDrop = drop || null;
    document.getElementById("activeDrop").textContent = drop
      ? `EXCLUSIVO: ${new Date(drop.exclusive_at).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })} · PÚBLICO: ${new Date(drop.public_at || drop.release_at).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })}`
      : "SIN DROP PROGRAMADO";
    if (drop) {
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
            `<article class="inventory-row"><img src="${product.image_urls?.[0] || "img/logo1.jpg"}" alt=""><div><h3>${safe(product.name)}</h3><p>${safe(product.category)} · ${safe(product.size || "Sin talla")} · ₡${Number(product.price).toLocaleString("es-CR")}</p><span class="status ${product.status}">${product.status === "new_drop" ? "NEW DROP" : "PUBLICADA"}</span></div><select class="availability" data-availability="${product.id}" aria-label="Estado de ${safe(product.name)}"><option value="available" ${product.availability === "available" ? "selected" : ""}>DISPONIBLE</option><option value="reserved" ${product.availability === "reserved" ? "selected" : ""}>APARTADA</option><option value="payment_pending" ${product.availability === "payment_pending" ? "selected" : ""}>EN PROCESO</option></select><button class="delete" data-delete="${product.id}">VENDIDA / ELIMINAR</button></article>`,
        )
        .join("") || "<p>NO HAY PIEZAS TODAVÍA.</p>";
  }
  function safe(text = "") {
    const node = document.createElement("span");
    node.textContent = text;
    return node.innerHTML;
  }
  inventory.addEventListener("click", async (event) => {
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

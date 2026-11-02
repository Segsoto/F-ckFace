(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReviewChatImages = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function validateFile(file) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Seleccioná una captura JPG, PNG o WebP.");
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("La captura debe pesar entre 1 byte y 10 MiB.");
  }
  function payload(values) {
    const customer_name = String(values.customer_name || "").trim() || "Compra por chat";
    const comment = String(values.comment || "").trim();
    const experience = values.experience;
    if (Array.from(customer_name).length > 60 || Array.from(comment).length > 1500) throw new Error("Usá hasta 60 caracteres para el nombre y 1500 para el contexto.");
    if (!["service", "delivery", "both"].includes(experience)) throw new Error("Elegí el tipo de experiencia.");
    if (!values.consent) throw new Error("Confirmá la autorización del cliente y que ocultaste sus datos personales.");
    return { customer_name, comment, experience, rating: null, source: "chat" };
  }
  async function save(client, values, file, { prepare, randomUUID, onProgress = () => {} }) {
    validateFile(file);
    const review = payload(values);
    const { data: session, error: sessionError } = await client.auth.getUser();
    if (sessionError || !session?.user) throw new Error("Iniciá sesión de nuevo antes de subir la captura.");
    onProgress("PREPARANDO CAPTURA...");
    const [image] = await prepare([file]);
    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[image?.type];
    if (!extension || image.size > 1500000) throw new Error("No se pudo preparar la captura dentro del tamaño permitido.");
    const image_path = `${session.user.id}/${randomUUID()}.${extension}`;
    const bucket = client.storage.from("review-chats");
    try {
      onProgress("SUBIENDO CAPTURA...");
      const { error: uploadError } = await bucket.upload(image_path, image, { upsert: false, contentType: image.type, cacheControl: "300" });
      if (uploadError) throw uploadError;
      onProgress("GUARDANDO TESTIMONIO...");
      const { data, error } = await client.from("customer_reviews").insert({ ...review, image_path }).select("id,status,image_path").single();
      if (error || !data) throw error || new Error("No se pudo confirmar el guardado.");
      return data;
    } catch (error) {
      // Una respuesta perdida puede ocurrir después de guardar. Nunca borrar una captura referenciada.
      try {
        const { data: saved, error: lookupError } = await client.from("customer_reviews").select("id,status,image_path").eq("image_path", image_path).maybeSingle();
        if (lookupError) throw lookupError;
        if (saved) return saved;
        const { error: cleanupError } = await bucket.remove([image_path]);
        if (cleanupError) console.warn("La captura privada quedó pendiente de limpieza:", cleanupError.message);
      } catch { /* Si no se puede comprobar la referencia, se conserva el objeto privado. */ }
      throw new Error("No se pudo confirmar el guardado de la captura. Actualizá las reseñas antes de reintentar.");
    }
  }
  return { validateFile, payload, save };
});

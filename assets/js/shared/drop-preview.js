(function () {
  // All reads use the administrator's session and existing database RLS.
  async function authorize(client) {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) throw new Error("Iniciá sesión en el panel de administración para ver la vista previa.");
    const profile = await client.from("admin_profiles").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (profile.error || !profile.data) throw new Error("Tu usuario no tiene permiso para ver la vista previa.");
  }
  async function products(client, dropId) {
    await authorize(client);
    const result = await client.from("products").select("*").eq("drop_id", dropId).eq("status", "new_drop").order("created_at", { ascending: false });
    if (result.error) throw new Error("No se pudieron cargar las prendas de la vista previa.");
    return result.data || [];
  }
  async function load(client) {
    await authorize(client);
    const result = await client.from("drops").select("id,name,description,exclusive_at,public_at").eq("is_active", true).order("release_at", { ascending: true }).limit(1);
    if (result.error) throw new Error("No se pudo consultar el drop programado.");
    const drop = result.data?.[0];
    return { drop, products: drop ? await products(client, drop.id) : [] };
  }
  window.DropPreview = { load, products };
})();

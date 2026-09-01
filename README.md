# F-ck Face — tienda streetwear con drops

Sitio estático para el negocio **F-ck Face**. Funciona como catálogo: no hay carrito ni pagos en la página. Cada consulta de una pieza abre WhatsApp con el producto y el precio incluidos en el mensaje.

La tienda está pensada para vender mediante *drops*:

1. El equipo crea un único drop activo con apertura exclusiva, contraseña y apertura pública.
2. Carga sus piezas, que quedan vinculadas a ese drop y en estado `new_drop`.
3. En el período exclusivo, la comunidad abre `NewDrop.html` con la contraseña.
4. Al cumplirse la apertura pública, las piezas pasan automáticamente a `published` y aparecen en `index.html`.
5. Las piezas apartadas o en proceso continúan visibles con su aviso; las vendidas se eliminan desde el panel.

## Tecnologías

- HTML, CSS y JavaScript sin framework ni proceso de compilación.
- [Supabase](https://supabase.com/) para autenticación, PostgreSQL, reglas de acceso y almacenamiento de fotos.
- Supabase JS cargado desde CDN.
- WhatsApp para cerrar la venta.

## Estructura del proyecto

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Tienda pública y modal de detalles de producto. |
| `NewDrop.html` | Acceso exclusivo con contador y contraseña para la comunidad. |
| `styles.css` | Diseño streetwear de la tienda. |
| `app.js` | Lectura del catálogo público, modal, WhatsApp y contador de apertura pública. |
| `newdrop.js` | Validación segura del acceso exclusivo, contador y catálogo del drop. |
| `admin.html` | Panel de administración. |
| `admin.css` | Estilos del panel. |
| `admin.js` | Inicio de sesión, carga de imágenes, alta/eliminación de piezas y programación de drops. |
| `config.js` | URL de Supabase, clave pública y número de WhatsApp. |
| `supabase-schema.sql` | Tablas, función automática, bucket de fotos y políticas RLS. |
| `img/logo1.jpg` | Recurso visual actual de la marca. |

La carpeta `Camisadel10/` es una referencia histórica de otro proyecto. No forma parte del funcionamiento actual de F-ck Face.

## Configuración inicial

### 1. Configurar Supabase

En el proyecto de Supabase, abrir **SQL Editor** y ejecutar completo [`supabase-schema.sql`](supabase-schema.sql). El script crea:

- `products`: las prendas del catálogo.
- `drops`: la fecha, nota y estado del próximo drop.
- `admin_profiles`: lista de usuarios autorizados para el panel.
- Bucket público `product-images`: fotos de las prendas.
- Políticas RLS para que visitantes consulten y solo administradores modifiquen contenido.

### 2. Configurar la conexión del frontend

En `config.js` se definen estas variables:

```js
window.FUCK_FACE_CONFIG = {
  url: 'https://<project-ref>.supabase.co',
  anonKey: 'sb_publishable_...',
  whatsappNumber: '50689652370'
};
```

La clave *publishable* puede estar en el frontend; Supabase la protege con las políticas RLS. **Nunca** agregar una `service_role` o una clave secreta en este archivo ni en ningún JavaScript publicado.

### 3. Crear administradores

Los accesos no se crean desde el panel web. Se administran en Supabase:

1. Ir a **Authentication → Users** y crear o invitar al usuario con email y contraseña.
2. En SQL Editor, autorizarlo en `admin_profiles`:

```sql
insert into public.admin_profiles (user_id)
select id from auth.users where email = 'admin@ejemplo.com'
on conflict do nothing;
```

3. Ese usuario podrá entrar en `admin.html` con sus credenciales.

Un usuario de Auth que no esté en `admin_profiles` puede autenticarse, pero el panel le negará acceso. Esto es intencional.

## Uso diario del panel

Abrir `admin.html` en el sitio publicado.

### Programar un drop

1. En **Próximo Drop**, elegir la apertura exclusiva y la apertura pública.
2. Crear la contraseña y escribir una nota opcional.
3. Presionar **Programar Drop**.

Solo hay un drop activo. Una vez que se abre al público, se puede crear el siguiente.

### Añadir una prenda

1. Completar nombre, precio, categoría, talla, largo y ancho de pecho cuando apliquen.
2. Seleccionar de una a cuatro fotos, de máximo 5 MB por archivo.
3. Presionar **Agregar a New Drop**.

La pieza se sube a Supabase Storage y se registra con estado `new_drop`. No aparece aún en el catálogo general; solo se revela mediante `NewDrop.html` durante la ventana exclusiva.

### El lanzamiento automático

La función PostgreSQL `release_due_drops()` revisa si la fecha pública del drop activo ya pasó. Si pasó:

- Cambia solo las prendas vinculadas a ese drop de `new_drop` a `published`.
- Desactiva ese drop.
- El frontend vuelve a leer los datos y el catálogo muestra las prendas dentro de su categoría.

La función se invoca al cargar la tienda, al cargar el panel y cuando el contador visible llega a cero. En condiciones normales, con la tienda abierta, el cambio es inmediato. Si no hay ningún visitante ni administrador conectado exactamente al momento de lanzamiento, se ejecutará en la siguiente visita/carga de la página.

### Para ejecución estricta sin visitas

Si el negocio necesita que el movimiento ocurra aun cuando nadie abra el sitio, el siguiente programador debe añadir una tarea programada de Supabase (Cron / Edge Function) que ejecute `public.release_due_drops()` cada minuto. La base actual no depende de esa tarea para funcionar, pero esa mejora elimina la dependencia de una visita web.

## Modelo de datos

### `products`

| Campo | Uso |
| --- | --- |
| `id` | Identificador UUID. |
| `name` | Nombre de la prenda. |
| `price` | Precio en colones costarricenses. |
| `category` | `camisas`, `pantalones`, `abrigos`, `buzos`, `accesorios` u `otros`. |
| `size` | Talla opcional. |
| `condition` | Estado opcional. |
| `description` | Detalles opcionales. |
| `image_urls` | Arreglo de URLs públicas de Supabase Storage. |
| `drop_id` | Drop al que pertenece la prenda. |
| `length_cm`, `chest_width_cm` | Largo y ancho de pecho, en centímetros. |
| `availability` | `available`, `reserved` o `payment_pending`. |
| `status` | `new_drop` o `published`. |
| `created_at`, `updated_at` | Fechas de control. |

### `drops`

| Campo | Uso |
| --- | --- |
| `exclusive_at` | Fecha/hora UTC de apertura para la comunidad. |
| `public_at` | Fecha/hora UTC de apertura para toda la tienda. |
| `access_password_hash` | Hash de contraseña; nunca la contraseña en texto plano. |
| `description` | Texto de apoyo para la sección New Drop. |
| `is_active` | Indica cuál es el próximo drop. |

## Flujo de WhatsApp

El número está centralizado en `config.js`, sin el símbolo `+`:

```js
whatsappNumber: '50689652370'
```

En el modal de producto se genera una URL `wa.me` con un mensaje como:

> Hola, quiero consultar por la pieza: [nombre] ([precio]). ¿Aún está disponible?

Cambiar el número en `config.js` actualiza el botón principal, el de contacto y el de cada producto.

## Publicación y pruebas locales

No hay dependencias de Node ni comando de build. Es un sitio estático: se puede publicar en Netlify, Vercel, GitHub Pages, Cloudflare Pages o cualquier hosting de archivos estáticos.

Para desarrollo, servir la carpeta con cualquier servidor estático y abrir:

- `/index.html` para la tienda.
- `/admin.html` para el panel.

Antes de publicar cambios, comprobar que:

- `config.js` apunte al proyecto Supabase correcto.
- El SQL se haya ejecutado en ese mismo proyecto.
- Exista al menos un administrador en `admin_profiles`.
- El bucket `product-images` esté creado y público.
- El número de WhatsApp sea el correcto.

## Consideraciones de seguridad y mantenimiento

- Mantener RLS activado. No crear políticas públicas de escritura para `products`, `drops` ni Storage.
- No exponer claves secretas de Supabase en repositorios o frontend.
- Las fotos eliminadas desde el inventario actualmente eliminan el registro de la prenda, pero no borran automáticamente sus archivos del bucket. Es una mejora pendiente para evitar fotos sin uso.
- Actualmente el panel permite eliminar piezas, pero no editar sus datos una vez creadas. Si se requiere edición, agregar un modal/formulario que haga `update` sobre `products`; las políticas ya lo permiten para administradores.
- Si se agregan categorías, cambiar las opciones del `<select>` en `admin.html`, el arreglo `categories` en `app.js` y la restricción `check` de `products.category` en la base de datos mediante una migración.

## Diagnóstico rápido

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| Error `401` al cargar o iniciar sesión | URL o clave pública incorrecta / antigua. | Revisar `config.js` y copiar la Publishable key desde Supabase. |
| La tienda muestra “No se pudo cargar el catálogo” | SQL no ejecutado, políticas incorrectas o conexión equivocada. | Ejecutar `supabase-schema.sql` y comprobar el proyecto configurado. |
| Un usuario inicia sesión pero no entra al panel | No figura en `admin_profiles`. | Autorizarlo con el SQL de la sección “Crear administradores”. |
| Error subiendo fotos | Bucket o políticas de Storage faltantes. | Ejecutar el bloque Storage de `supabase-schema.sql`. |
| `function gen_salt(unknown) does not exist` o `404` en `/rpc/save_active_drop` | La versión anterior del RPC no encuentra `pgcrypto` o PostgREST conserva su caché. | Ejecutar nuevamente, completo, `supabase-schema.sql` en el SQL Editor del proyecto configurado. El script actualiza la función y recarga el caché. |
| Las piezas no pasan a Shop All | La fecha aún no llegó o nadie cargó la web tras el lanzamiento. | Abrir la tienda/panel o configurar Supabase Cron para ejecución cada minuto. |

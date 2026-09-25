# F-ck Face — tienda streetwear con drops

Sitio estático para el negocio **F-ck Face**. Funciona como catálogo: no hay carrito ni pagos en la página. Cada consulta de una pieza abre WhatsApp con el producto y el precio incluidos en el mensaje.

La tienda está pensada para vender mediante *drops*:

1. El equipo crea un único drop activo con apertura exclusiva, contraseña y apertura pública.
2. Carga sus piezas, que quedan vinculadas a ese drop y en estado `new_drop`.
3. En el período exclusivo, la comunidad abre `NewDrop.html` con la contraseña.
4. Al cumplirse la apertura pública, las piezas pasan automáticamente a `published` y aparecen en `NewDrop.html`. Durante la conexión temporal, `index.html` sigue mostrando el catálogo del proyecto anterior.
5. Las piezas apartadas o en proceso continúan visibles con su aviso; las vendidas se eliminan desde el panel.

## Tecnologías

- HTML, CSS y JavaScript sin framework ni proceso de compilación.
- [Supabase](https://supabase.com/) para autenticación, PostgreSQL, reglas de acceso y almacenamiento de fotos.
- Supabase JS cargado desde CDN.
- WhatsApp para cerrar la venta.

## Estructura del proyecto

El JavaScript se separa en `assets/js/pages/` y `assets/js/shared/`; los estilos están en `assets/css/`. Las páginas conservan sus rutas de acceso. Las pautas de mantenimiento y verificación están en [docs/calidad.md](docs/calidad.md). Ejecutar `npm test` con Node.js 22 o superior para revisar rutas y regresiones de New Drop, sin instalar dependencias.

En New Drop, al ingresar con la contraseña, los filtros muestran las categorías que tienen prendas y su cantidad. **Todas** recupera el catálogo completo. El contador mantiene abierto el catálogo durante el acceso autorizado.

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Tienda pública y modal de detalles de producto. |
| `NewDrop.html` | Acceso exclusivo con contador y contraseña para la comunidad. |
| `assets/css/styles.css` | Diseño streetwear de la tienda. |
| `assets/js/pages/app.js` | Lectura del catálogo público, modal, WhatsApp y contador de apertura pública. |
| `assets/js/pages/newdrop.js` | Validación segura del acceso exclusivo, contador y catálogo del drop. |
| `admin.html` | Panel de administración. |
| `assets/css/admin.css` | Estilos del panel. |
| `assets/js/pages/admin.js` | Inicio de sesión, carga de imágenes, alta/eliminación de piezas y programación de drops. |
| `config.js` | Conexión anterior de `index.html` y número de WhatsApp. |
| `drop-config.js` | Conexión nueva de `admin.html` y `NewDrop.html`. |
| `supabase-schema.sql` | Tablas, función automática, bucket de fotos y políticas RLS. |
| `404.html` / `assets/css/404.css` | Página personalizada para rutas inexistentes. |
| `robots.txt` | Permite rastrear la tienda y bloquea archivos internos. |
| `img/logo1.jpg` | Recurso visual actual de la marca. |

## Configuración inicial

### Seguridad antes de publicar

- Ejecutar nuevamente [`supabase-schema.sql`](supabase-schema.sql) completo en el proyecto que usa `config.js`.
- En Supabase Auth, desactivar los registros públicos y exigir confirmación de email.
- Crear el usuario administrador desde **Authentication → Users** y autorizarlo únicamente en `admin_profiles`.
- Activar MFA para cada cuenta administradora y usar una contraseña única, larga y no reutilizada.
- Configurar en el hosting una regla de headers para `admin.html` con `Cache-Control: no-store` y mantener `404.html` como página de error.
- Reemplazar las URLs relativas de `canonical`, Open Graph y JSON-LD por la URL absoluta del dominio publicado.
- Crear `sitemap.xml` con esa misma URL absoluta y añadirla como `Sitemap:` en `robots.txt`.

La URL de `admin.html` no necesita ocultarse: una URL estática puede descubrirse. El acceso se protege en el servidor mediante Supabase Auth, RLS y la pertenencia a `admin_profiles`; nunca mediante una contraseña JavaScript.

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
  whatsappNumber: '50689168397'
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

### Editar un drop y consultar su contraseña

### Revisar antes de la apertura

Iniciá sesión con tu correo y contraseña de administrador en `admin.html` y elegí **VISTA PREVIA DEL DROP**. Se abre `NewDrop.html?preview=admin` en otra pestaña del mismo navegador y dominio. Permite revisar categorías, fotos, precios y detalles antes de la apertura exclusiva. Si no hay sesión autorizada, pide entrar al panel.

La vista previa consulta únicamente las prendas `new_drop` del drop activo, con los permisos de administrador existentes. No ejecuta la publicación automática ni cambia productos o fechas. La apertura habitual del sitio y del panel conserva su comportamiento programado. No requiere migración SQL.

### Cambiar datos del drop

El drop activo se carga automáticamente en el formulario. Podés cambiar su nombre,
fechas y horas de apertura, contraseña y nota con **Guardar cambios**. Dejá la
contraseña vacía para conservarla. Los ojos permiten mostrar u ocultar las contraseñas
del inicio de sesión, del formulario y del acceso de la comunidad.

**Contraseña guardada** permite consultarla nuevamente, solo con una sesión de
administrador. Se almacena en `drop_passwords`, protegida por RLS y sin acceso público;
la validación del acceso sigue usando el hash. Las contraseñas anteriores a esta
actualización deben introducirse otra vez para disponer de esta consulta.

**Desactivar drop** cierra su acceso e impide la publicación automática. Conserva las
prendas vinculadas sin publicar; no las transfiere al siguiente drop.

Para actualizar una instalación existente, ejecutar `drop-management.sql` antes de
publicar los archivos web. Las instalaciones nuevas usan `supabase-schema.sql` completo.

### Añadir una prenda

1. Completar nombre, precio, categoría, talla, largo y ancho de pecho cuando apliquen.
2. Seleccionar de una a siete fotos JPG, PNG o WebP, de máximo 10 MB por archivo.
3. Presionar **Agregar a New Drop**.

La pieza se sube a Supabase Storage y se registra con estado `new_drop`. No aparece aún en el catálogo general; solo se revela mediante `NewDrop.html` durante la ventana exclusiva.

El panel comprime las fotos en el navegador **antes de subirlas**: máximo 300 KB por foto y 1600 píxeles en el lado mayor, sin recortar ni ampliar. Prefiere WebP y usa JPEG si el navegador no puede generar WebP. Las fotos que ya son pequeñas se conservan sin recompresión. Procesa una foto a la vez, muestra el progreso y al terminar informa el peso almacenado y el ahorro. Si no puede leer o comprimir una foto, detiene la preparación; no sube el original pesado. Los archivos HEIC deben exportarse a JPG.

Este cambio afecta las cargas nuevas realizadas desde este panel; no impone un límite en el servidor ni modifica fotos existentes. Publicar `admin.html`, `assets/js/pages/admin.js` y `assets/js/shared/image-compression.js` juntos. Las fotos históricas requieren una migración aparte: respaldo, compresión, carga bajo rutas nuevas, verificación de las imágenes y actualización de las referencias antes de borrar originales. No iniciar esa migración mientras Supabase bloquee Storage con HTTP 402. La limpieza de huérfanas y la reducción de tráfico histórico son temas diferentes.

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
| `original_price` | Precio anterior opcional. Si es mayor que `price`, se muestra la rebaja y su porcentaje. |
| `category` | `jacket_damas`, `jacket_caballeros`, `pantalones`, `chalecos`, `tallas_plus`, `ropa_ninos` o `mochilas`. Las categorías antiguas se conservan en base de datos para el inventario existente. |
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
whatsappNumber: '50689168397'
```

En el modal de producto se genera una URL `wa.me` con un mensaje como:

> Hola, quiero consultar por la pieza: [nombre] ([precio]). ¿Aún está disponible?
>
> Ver prenda: [URL de la tienda con ?prenda=ID]

El catálogo público y New Drop incluyen un enlace al detalle de la prenda, con sus fotos y medidas. En New Drop se requiere el acceso exclusivo antes de abrir el detalle; si la prenda ya es pública, el enlace la abre en la vista pública de New Drop, que consulta su propio proyecto. No se incluyen contraseñas ni parámetros de vista previa administrativa. Las consultas generales no incluyen enlace de producto. Los enlaces `wa.me` precargan texto, no archivos adjuntos; este cambio no genera una miniatura específica de la prenda en WhatsApp.

Durante la conexión temporal, cambiar el número en `config.js` actualiza la tienda anterior; para Admin y New Drop también hay que actualizar `drop-config.js`.

## Publicación y pruebas locales

No hay dependencias de Node ni comando de build. Es un sitio estático: se puede publicar en Netlify, Vercel, GitHub Pages, Cloudflare Pages o cualquier hosting de archivos estáticos. Para probarlo localmente, ejecutar `npm run dev` y abrir `http://127.0.0.1:4173`.

Para desarrollo, servir la carpeta con cualquier servidor estático y abrir:

- `/index.html` para la tienda.
- `/admin.html` para el panel.

Antes de publicar cambios, comprobar que:

- `config.js` apunte al proyecto anterior para la tienda y `drop-config.js` al proyecto nuevo para Admin y New Drop.
- El SQL se haya ejecutado en el proyecto nuevo.
- Exista al menos un administrador en `admin_profiles`.
- El bucket `product-images` esté creado y público.
- El número de WhatsApp sea el correcto.
- El dominio real ya esté configurado en canonical, Open Graph, JSON-LD y sitemap.

## Consideraciones de seguridad y mantenimiento

- Mantener RLS activado. No crear políticas públicas de escritura para `products`, `drops` ni Storage.
- No exponer claves secretas de Supabase en repositorios o frontend.
- La clave `publishable`/anon de Supabase no es un secreto; la seguridad depende de RLS. Revocar y rotar cualquier `service_role` si alguna vez fue publicada.
- Las funciones públicas solo devuelven datos filtrados; el acceso de administración requiere sesión autenticada y una fila propia en `admin_profiles`.
- Las cargas de Storage deben conservar una ruta que empiece con el UUID del usuario administrador. No relajar esa política a `bucket_id` solamente.
- Configurar límites de intentos y MFA en **Authentication → Settings**. La contraseña del New Drop no sustituye la autenticación del panel.
- Las fotos eliminadas desde el inventario actualmente eliminan el registro de la prenda, pero no borran automáticamente sus archivos del bucket. Es una mejora pendiente para evitar fotos sin uso.
- El botón **Editar** del inventario permite corregir los datos de cualquier pieza publicada o de New Drop. Al reducir el precio, guarda el importe anterior y calcula automáticamente la rebaja; **Quitar descuento** vuelve a mostrar un único precio.
- Si se agregan categorías, cambiar las opciones del `<select>` en `admin.html`, las tarjetas y el objeto `categoryNames` en `assets/js/pages/app.js`/`index.html`, y la restricción `check` de `products.category` en la base de datos mediante una migración.

## Diagnóstico rápido

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| Error `401` al cargar o iniciar sesión | URL o clave pública incorrecta / antigua. | Revisar `config.js` y copiar la Publishable key desde Supabase. |
| La tienda muestra “No se pudo cargar el catálogo” | SQL no ejecutado, políticas incorrectas o conexión equivocada. | Ejecutar `supabase-schema.sql` y comprobar el proyecto configurado. |
| Un usuario inicia sesión pero no entra al panel | No figura en `admin_profiles`. | Autorizarlo con el SQL de la sección “Crear administradores”. |
| Error subiendo fotos | Bucket o políticas de Storage faltantes. | Ejecutar el bloque Storage de `supabase-schema.sql`. |
| `function gen_salt(unknown) does not exist` o `404` en `/rpc/save_active_drop` | La versión anterior del RPC no encuentra `pgcrypto` o PostgREST conserva su caché. | Ejecutar nuevamente, completo, `supabase-schema.sql` en el SQL Editor del proyecto configurado. El script actualiza la función y recarga el caché. |
| Las piezas no pasan a Shop All | La fecha aún no llegó o nadie cargó la web tras el lanzamiento. | Abrir la tienda/panel o configurar Supabase Cron para ejecución cada minuto. |

## Medidas por categoría

El alta y la edición usan `assets/js/shared/measurements.js`: pantalones tienen largo total, ancho de cintura en plano y entrepierna; bolsos/mochilas tienen alto, ancho y fondo; las demás categorías conservan largo y ancho de pecho. Todas las medidas son opcionales y se expresan en centímetros. Bolsos conserva el identificador `mochilas` para mantener los filtros y productos existentes.

Para otra instalación existente, ejecutar `supabase/migrations/20260912033744_category_measurements.sql` antes de publicar el frontend. Solo añade columnas; no actualiza ni elimina piezas. Las medidas históricas conservan su significado y siguen disponibles al editar y consultar la pieza. No se convierten medidas de pecho en cintura automáticamente.

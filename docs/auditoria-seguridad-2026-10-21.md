# Auditoría de sesiones e inyección

Fecha: 2026-10-21, America/Costa_Rica. Sitio: https://www.fuck-face.com/. Base local: `d944fbf`, con Git limpio al iniciar. Solicitud: evaluar secuestro de sesión e inyección en el acceso administrativo mediante la skill auditor-web-profesional. Este informe es interno: excluir `docs/` del hosting antes de futuras publicaciones.

## Conclusión y cobertura

Se confirmó **ejecución de JavaScript mediante atributos HTML de prendas en una prueba local**, utilizando funciones de renderizado extraídas del código existente. También se confirmó que el SDK utilizado guarda la sesión en almacenamiento accesible a JavaScript. La combinación permitiría leer una sesión administrativa si contenido malicioso llegara a guardarse y lo abriera un administrador en el mismo origen. **No se demostró una escritura desde una cuenta ajena al equipo, un robo de tokens reales ni un acceso no autorizado en producción.**

En el login revisado no se encontró concatenación de consultas SQL ni evaluación de correo/contraseña como código. El formulario llama a `signInWithPassword` y muestra mensajes con `textContent`. Esto no certifica el backend de Auth ni sustituye una prueba con cuentas controladas.

Evaluación incompleta para autorización y ciclo de sesión en producción: no hubo credenciales de prueba ni acceso de gestión al proyecto Supabase actual. El conector disponible solo enumeró otros proyectos. No se hicieron intentos de acceso con contraseñas, registros de usuarios, escrituras, borrados, fuerza bruta ni inyecciones contra el servicio real.

Muestra y herramientas:

- HTTP GET de `/`, `/admin.html`, `/NewDrop.html` y los tres scripts de página: coincidencia textual con los archivos locales, normalizando saltos de línea y espacios extremos. Esto no acredita la versión de SQL desplegada.
- GET de `/docs/manual-uso.txt` y `/docs/documentacion-proyecto.txt`: HTTP 200 y coincidencia con los documentos locales anteriores a esta auditoría; no se imprimieron credenciales.
- GET público de ajustes Auth: `disable_signup=false`.
- Lecturas anónimas realizadas en la revisión inmediatamente anterior: cinco tablas administrativas respondieron HTTP 401/42501 y `is_admin` devolvió `false`. Solo comprueban el rol anónimo y las rutas consultadas.
- Edge headless, perfil temporal sin sesión: login público observado a 1440×1000 y 390×844; formulario presente y panel oculto en el DOM. No se envió el formulario. Esta muestra no constituye auditoría visual o de accesibilidad integral.
- Prueba local aislada con CSP que bloquea conexiones y admite los scripts de prueba: funciones de catálogo, New Drop e inventario, datos sintéticos y marcador de almacenamiento ficticio. Eventos `error` y `pointerover` despachados localmente; no se guardaron productos.
- SDK obtenido desde la URL utilizada por el sitio: versión resuelta **2.118.0**, SHA-256 `bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af`. Otra prueba local con ese SDK verificó `persistSession=true`, `autoRefreshToken=true` y almacenamiento legible desde el script de página. No se creó una sesión real.

Las evidencias locales de esta conversación son `audit-http-results.json`, `security-local-results.json`, `sdk-session-results.json`, los HTML de prueba y las capturas `admin-desktop.png` y `admin-mobile.png`; están fuera del árbol publicable del proyecto. El registro HTTP principal tiene hora 2026-10-22T02:01:24.088Z, equivalente a 2026-10-21 20:01:24 en Costa Rica. No se ejecutó `npm test`: solo se añadieron documentos, y la evidencia nueva corresponde a pruebas aisladas de auditoría.

SEO, diseño, rendimiento y accesibilidad integral quedan fuera de este encargo.

## Fortalezas a conservar

- Login mediante Supabase Auth, con comprobación adicional de `admin_profiles`; no basta con ocultar botones.
- SQL versionado con RLS y comprobaciones `is_admin()` en operaciones administrativas. Aún debe contrastarse contra el esquema real y roles autenticados.
- Los mensajes del login y numerosos detalles de producto utilizan `textContent`.
- HTTPS y HSTS observados; no se detectó acceso anónimo a las cinco tablas consultadas.

## Hallazgos y órdenes para programación

### WEB-001 — XSS en atributos de prendas y posible acceso a sesiones

**P1; defecto comprobado localmente; confianza alta en el renderizado, acceso externo inicial sin verificar.** Ubicación: `assets/js/pages/admin.js:411`, `:434`, `:449`, `:479`; `assets/js/pages/app.js:15`, `:33`; `assets/js/pages/newdrop.js:33`, `:85`.

`safe`/`escapeHtml` asignan texto a un nodo y recuperan `innerHTML`. Esto protege el contexto de texto, pero conserva las comillas que luego se insertan dentro de atributos de una plantilla HTML. Nombres e imágenes pueden introducir atributos de evento. No todo `innerHTML` del proyecto es vulnerable: el hallazgo corresponde a este recorrido de datos concreto.

Reproducción local: extraer las funciones existentes, darles una prenda sintética con comillas y un evento que solo lee un marcador ficticio, insertar el resultado y despachar el evento. Resultado: `catalogNameExecuted`, `dropNameExecuted`, `adminImageExecuted` y `adminNameExecuted` fueron `true`. La lectura del marcador también fue exitosa. Los filtros por talla e historial comparten el patrón por análisis estático; no se simularon completos.

Precondición: lograr que esos datos existan en una prenda que lea la víctima. El flujo normal de alta/edición exige administrador; no se probó que un visitante pueda escribirlos. Un enlace con texto malicioso en el parámetro `prenda` no fue identificado como entrada a este recorrido: ese parámetro se usa como identificador.

Impacto: JavaScript en el origen del sitio podría actuar con la sesión existente o leer almacenamiento. Tienda, New Drop y admin comparten origen y cliente Auth, por lo que el riesgo no queda limitado a `/admin.html`. La lectura de un token auténtico y su reutilización son una inferencia sustentada por las dos pruebas locales, no una explotación realizada. MFA no evita por sí sola el uso de un token de una sesión ya autenticada.

**Orden:** reemplazar interpolaciones de datos en atributos por nodos DOM, `textContent`, propiedades y atributos de nombre fijo; validar por separado protocolos/orígenes de URLs de imágenes según los recursos legítimos. Si quedan plantillas, usar codificación adecuada al contexto. Revisar inventario, ventas, tallas y ambos catálogos. No considerar `sessionStorage` una solución al XSS: también es legible por JavaScript.

**Aceptar cuando:** nombres con comillas, apóstrofes, signos HTML y URLs adversas se representen como datos sin crear atributos ejecutables; cero ejecución en las cuatro pruebas equivalentes; fotos, filtros y galerías legítimos sigan funcionando. Añadir regresiones de seguridad y ejecutar las comprobaciones del proyecto. Evaluar aislamiento del admin en otro origen o una arquitectura de sesión con backend y cookies HttpOnly; esta última reduce extracción de tokens pero no elimina acciones mediante XSS.

Fundamento: [OWASP, contextos de salida y atributos](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [OWASP, almacenamiento local](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

### WEB-002 — Rotación de una contraseña histórica sin evidencia de cierre

**P1 para verificar y contener; antecedente documentado, vigencia de credencial sin verificar. Confianza alta en el antecedente.** Ubicación: sección 17 y entrada DOC-002 del registro central, antes de esta auditoría.

La documentación indica que una contraseña se retiró del manual y que su rotación quedó pendiente. No se recuperó ni probó su valor. No se acreditó si fue rotada después ni si el historial del repositorio es público. Los documentos actuales consultados coinciden con las versiones que ya registran su retirada; esto no significa que hoy publiquen la contraseña.

**Orden:** confirmar por el propietario la rotación posterior a la exposición; si no hay constancia, cambiar la contraseña desde Auth, revocar sesiones y revisar accesos. Gestionar copias e historial sin volver a escribir la credencial. Prioridad preventiva por el impacto de una cuenta administrativa, no por prueba de compromiso vigente.

**Aceptar cuando:** haya evidencia administrativa sin secretos de rotación/revocación y revisión de accesos. Un cierre de sesión no invalida instantáneamente un access token ya emitido: esperar su expiración o aplicar un control adicional de sesión para las operaciones sensibles. [Supabase, signOut](https://supabase.com/docs/reference/javascript/auth-signout).

### WEB-003 — Falta de MFA en el flujo versionado y registros habilitados

**P2; controles de endurecimiento, con configuración parcialmente verificada; confianza alta en código y ajuste observado.** Ubicación: `assets/js/pages/admin.js:119`, `supabase-schema.sql:92` y políticas administrativas; endpoint de ajustes Auth del proyecto configurado.

No hay desafío MFA en el panel ni requisito `aal2` en la autorización SQL revisada. Los ajustes públicos de producción permiten registro. Crear una cuenta no debería otorgar `admin_profiles`; no se creó ninguna para comprobarlo. No se conoce la configuración real de límites, CAPTCHA, expiración, sesiones concurrentes o factores inscritos. No afirmar que no existen límites porque el frontend no los muestre.

**Orden:** deshabilitar registro público si el negocio solo admite cuentas de equipo; implementar alta/recuperación MFA y su exigencia en servidor/RLS/RPC/Storage, con recuperación administrativa preparada. Revisar vigencia, inactividad, revocación y eventos de sesión. Preservar la autorización por `admin_profiles`.

**Aceptar cuando:** cuentas de prueba anónimas, autenticadas sin perfil, administrativas con primer factor y administrativas con MFA tengan resultados coherentes en UI y API directa; el primer factor solo no permita operaciones protegidas. Revisar límites de intentos desde la configuración, sin fuerza bruta en producción. [Supabase, MFA](https://supabase.com/docs/guides/auth/auth-mfa), [sesiones](https://supabase.com/docs/guides/auth/sessions).

### WEB-004 — Sin CSP ni defensa de enmarcado observadas

**P2; endurecimiento comprobado por HTTP; confianza alta.** Ubicación: respuestas de `/`, `/admin.html`, `/NewDrop.html`; no se encontró CSP en sus HTML.

No se observaron `Content-Security-Policy` ni `X-Frame-Options`. Esto quita defensas frente a scripts inyectados y enmarcado, pero por sí solo no demuestra clickjacking ni robo de sesión. HTTPS/HSTS sí están presentes.

**Orden:** añadir una CSP compatible con los recursos reales y sin permitir eventos inline, inicialmente contrastada con reportes; bloquear el enmarcado del admin mediante `frame-ancestors` en cabecera. No sustituye la corrección WEB-001.

**Aceptar cuando:** cabeceras verificadas en el hosting real; login, SDK, galería y recursos legítimos funcionan; los manejadores de la prueba aislada quedan bloqueados con la política prevista y el admin no puede enmarcarse desde un origen ajeno.

### WEB-005 — SDK remoto con versión móvil y sin integridad

**P2; endurecimiento de dependencias, no vulnerabilidad conocida demostrada; confianza alta.** Ubicación: `admin.html:251` y scripts equivalentes de las otras entradas.

Se carga `@supabase/supabase-js@2` sin versión exacta ni atributo de integridad. En esta fecha resolvió a 2.118.0. El recurso ejecuta código con acceso al origen y almacenamiento de sesión; no se identificó un aviso de seguridad aplicable ni se afirma que la versión descargada esté comprometida.

**Orden:** fijar una versión exacta y usar una copia controlada o SRI con CORS apropiado; establecer actualización revisada y repetir pruebas de Auth. Coordinar con WEB-004.

**Aceptar cuando:** la URL/artefacto sea reproducible, la integridad se compruebe cuando proceda y una nueva versión no llegue sin revisión; inicio/cierre de sesión y cliente público funcionen después del cambio.

### WEB-006 — Documentación operativa públicamente descargable

**P2; exposición comprobada; confianza alta.** Ubicación: `/docs/manual-uso.txt` y `/docs/documentacion-proyecto.txt`, HTTP 200.

Expone arquitectura, operación y pendientes internos. No se encontró una contraseña vigente por estas respuestas ni se descargó el historial Git desde el sitio. Facilita reconocimiento y hace especialmente importante no publicar este informe ni futuros documentos internos.

**Orden:** desplegar solo los archivos públicos necesarios y excluir documentación, auditorías, herramientas y SQL. Mantener la bitácora central en el repositorio de trabajo. Añadir reglas preventivas de exclusión de `.env*` si se introducen secretos locales; actualmente no existe un `.env` ni un `.gitignore` en la aplicación principal.

**Aceptar cuando:** los dos documentos y este informe devuelvan 403/404 en producción, sin romper rutas públicas. `.env`, `.env.local` y `.env.production` ya respondieron 404 en la revisión anterior; verificar de nuevo tras cambios de hosting.

## Orden de ejecución y revalidación

Responsable: **programación**, con el propietario de Supabase/hosting para credenciales y configuración. No se requiere rediseño ni se ha delegado a otros agentes.

1. Confirmar/contener WEB-002 y corregir WEB-001 antes de la siguiente publicación de cambios funcionales.
2. Resolver WEB-006 antes de publicar documentación nueva. Coordinar WEB-004 y WEB-005 sin bloquear dependencias legítimas.
3. Implementar WEB-003 con cuentas de prueba y recuperación preparada; no bloquear al equipo durante el alta de factores.
4. Contrastar políticas, permisos de funciones y Storage reales. Probar de forma controlada rol autenticado sin perfil, administrador autorizado, retiro de perfil y expiración/revocación de sesión. No usar inventario real como datos de prueba.
5. Repetir las pruebas aisladas y `npm test` después de implementar código; comprobar las cabeceras y archivos efectivamente publicados. Registrar cada ID como resuelto solo con nueva evidencia.

No se cambió código funcional, Auth, RLS, credenciales, hosting, inventario o Storage. No se realizó publicación. Los hallazgos quedan abiertos y no hay evidencia de un secuestro de sesión en curso.

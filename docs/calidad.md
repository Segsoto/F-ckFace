# Mantenimiento y control de calidad

La referencia central y el registro de modificaciones están en [documentacion-proyecto.txt](documentacion-proyecto.txt). Leerlo antes de modificar el proyecto y seguir [../AGENTS.md](../AGENTS.md). Actualizar las secciones afectadas y añadir una entrada de bitácora en cada cambio, con pasos, archivos, resultado, verificaciones, pendientes y estado real de publicación. Actualizar [manual-uso.txt](manual-uso.txt) cuando cambie un procedimiento del panel.

## Responsabilidades

- `assets/js/pages/`: comportamiento de tienda, New Drop y administración.
- `assets/js/shared/`: medidas, imágenes, contraseñas y carga de página.
- `assets/css/`: presentación visual.
- `docs/`: instrucciones de uso y calidad.
- `tests/`: regresiones automatizadas sin dependencias externas.
- `supabase/migrations/`: cambios incrementales de base de datos.

Las páginas HTML y `config.js` conservan sus rutas públicas. `img/` conserva las rutas de imágenes existentes. `Camisadel10/` es una aplicación separada y se mantiene intacta.

## Antes de aceptar un cambio

1. Definir el comportamiento esperado y las pantallas afectadas.
2. Hacer cambios pequeños por responsabilidad, conservando los datos existentes.
3. Ejecutar `npm test` para cambios de código: cubre recursos, acceso/filtros, galerías, compresión, cargas, ventas y limpieza simulada. Si cambia el generador de miniaturas, ejecutar también `python tests/product-thumbnails.test.py` con Pillow.
4. Revisar las pantallas afectadas en móvil y escritorio. Para acceso exclusivo: contraseña correcta/incorrecta, categorías, Todas, catálogo vacío, detalle y paso a apertura pública. Para imágenes: miniaturas, selección de foto grande y fallback.
5. Para cambios del panel, comprobar el flujo afectado: alta en sus dos destinos, edición/medidas, disponibilidad, venta, historial, limpieza pendiente o reversión. Usar datos de prueba; no ejecutar borrados históricos reales como verificación.
6. Revisar el diff y la documentación antes de publicar. Publicar HTML y assets juntos para que las rutas permanezcan sincronizadas. Anotar una publicación solo cuando se haya realizado y comprobado.

Para cambios exclusivamente documentales, comprobar rutas, exactitud frente al código, cobertura y ausencia de credenciales. No es necesario crear pruebas nuevas del comportamiento de la aplicación.

Las pruebas automatizadas usan respuestas simuladas y no validan servicios ni credenciales reales. La verificación manual con un drop de prueba completa esa cobertura.

Para reseñas, comprobar envío con estrellas/consentimiento, validaciones y error que
conserve el comentario; un envío pendiente debe permanecer oculto en la web. Probar
aceptar, rechazar/retirar, filtros, paginación, actualización y cerrar sesión. Verificar
con roles de prueba que un visitante o usuario sin perfil no pueda moderar ni leer
pendientes/rechazadas. La migración adicional debe aplicarse antes de publicar el
frontend; `npm test` valida simulaciones y no acredita RLS remoto. En Apartado y
vendido, comprobar conteos, filtros y cambios de disponibilidad/venta/reversión sin
duplicar ventas que conserven availability=reserved ni incluir payment_pending.

Para capturas de chats, usar imágenes sintéticas sin datos personales: selección y
vista previa, validación de formato/tamaño, confirmación requerida, carga pendiente,
aprobación visible y rechazo oculto. Comprobar Storage privado: anónimos y usuarios
sin perfil no deben cargar ni leer/firmar pendientes; un administrador no debe borrar
un objeto referenciado. Probar respuesta perdida tras guardado y fallo de consulta
sin eliminar la imagen. Rechazar debe impedir firmas nuevas; las emitidas duran hasta
cinco minutos. Esta segunda migración es requisito del frontend con capturas.

Para eliminar reseñas: cancelar no debe enviar peticiones; confirmar debe eliminar
pendientes/publicadas/rechazadas con control de estado y fecha de revisión. Probar
capturas con fallo de Storage, persistencia tras recarga y reintento. La reseña debe
permanecer eliminada si falla la limpieza, y la tarea solo desaparecer cuando el
objeto ya no exista. Verificar permisos anon, usuario sin perfil y administrador;
si el trigger no puede registrar la tarea, el borrado completo debe revertirse.

Antes de publicar en Vercel, ejecutar `npm run build` y servir únicamente `dist/`.
La prueba `site-build.test.cjs` comprueba las rutas públicas y que no se incluyan
documentos, SQL, herramientas ni Camisadel10. Tras publicar, contrastar HTML/JS/CSS
con la versión local y comprobar que las rutas internas devuelvan 404. Revisar el
estado READY del commit esperado y el dominio; no asumir éxito por haber hecho push.

El campo histórico `inseam_cm` se conserva en la base de datos y se rotula ANCHO DE PIERNA en el módulo actual de medidas. El cambio de etiqueta no convierte los valores históricos de entrepierna; corregir el significado de medidas guardadas requiere una decisión explícita sobre esos datos.

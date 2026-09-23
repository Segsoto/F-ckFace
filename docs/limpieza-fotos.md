# Limpieza de las fotos huérfanas auditadas

Este script es específico del proyecto `zfyotvnrvfbegfrmjygo` y de la auditoría del 22 de septiembre de 2026. No elimina prendas. De las 562 fotos sin referencia originales, 172 ya se eliminaron; la última consulta confirmó 390 pendientes (1,764 GB). Las 247 fotos asociadas a 44 prendas ocupan 1,171 GB.

Requiere Node.js 22 o superior y los archivos `storage-cleanup-audit-20260922.json` y `storage-cleanup-baseline-20260922.json` en la raíz de este proyecto. Usa la API oficial de Storage, no elimina filas con SQL. Si el inventario cambió desde la auditoría, se detiene: no quités esa comprobación; hace falta una auditoría nueva.

Desde PowerShell en la carpeta del proyecto:

```powershell
# Solo revisar cantidades y espacio recuperable:
.\tools\cleanup-orphan-images.ps1

# Revisar otra vez y pedir confirmación antes de borrar:
.\tools\cleanup-orphan-images.ps1 -Execute
```

El script pide la clave administrativa existente con entrada oculta. Usá la clave `service_role` de este mismo proyecto. No uses la clave pública de `config.js`, no pegues la clave en el código ni en el chat. Se conserva únicamente en la variable de entorno del proceso durante la ejecución y luego se restaura su valor anterior.

Antes de ejecutar, evitá cargas y ediciones simultáneas. Las consultas y el borrado de archivos son operaciones separadas y no forman una transacción. El script comprueba dos veces el inventario completo y los archivos; si cambia una asociación, una identidad, un tamaño o una fecha de modificación detectada, se detiene. Tras borrar, comprueba que las fotos protegidas siguen intactas.

La lista se limita a los archivos auditados y excluye cargas recientes. Los archivos nuevos posteriores a la auditoría no se consideran candidatos. Se guarda la lista pendiente antes de enviar el borrado y un resultado verificado al terminar. Un error de red puede ocurrir después de un borrado parcial: ejecutá primero el modo de revisión; no asumas que no se borró nada ni reintentes a ciegas.

## Restricción de Supabase

El panel de uso mostró `Cached Egress Exceeded` y `Storage Size Exceeded`, con servicios restringidos y respuestas HTTP 402. La conexión administrativa SQL seguía funcionando. El script no evita ese bloqueo: si la API de Storage devuelve 402, se detiene.

Borrar las fotos pendientes libera aproximadamente el 60 % del almacenamiento físico actual, no el 90 %. No reduce los 20,06 GB de tráfico desde caché ya consumidos durante el ciclo. El panel indicó el siguiente inicio de ciclo el 16 de octubre de 2026; debe revisarse allí la fecha vigente. Aun limpiando todo lo auditado, los 1,171 GB de fotos vigentes superan 1 GB, por lo que también hace falta optimizar esas fotos para mantenerse dentro del plan gratuito.

Referencia: https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy

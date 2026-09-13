# Mantenimiento y control de calidad

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
3. Ejecutar `npm test`: comprueba recursos locales y la regresión del contador y los filtros de New Drop.
4. Revisar manualmente en móvil y escritorio: acceso con contraseña correcta e incorrecta, categorías, Todas, catálogo vacío, detalle de producto y paso a apertura pública.
5. En administración, comprobar alta y edición de pantalones con el texto ANCHO DE PIERNA y verificar el guardado.
6. Revisar el diff antes de publicar. Publicar HTML y assets juntos para que las rutas permanezcan sincronizadas.

Las pruebas automatizadas usan respuestas simuladas y no validan servicios ni credenciales reales. La verificación manual con un drop de prueba completa esa cobertura.

El cambio solicitado de ANCHO DE PIERNA se aplica a la etiqueta del editor. Se conserva la columna histórica `inseam_cm` y su presentación anterior en el catálogo; corregir el significado de medidas guardadas requiere una decisión explícita sobre los datos históricos.

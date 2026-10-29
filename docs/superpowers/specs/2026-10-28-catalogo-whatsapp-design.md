# Catálogo virtual Electronorte con consultas por WhatsApp

Fecha: 2026-10-28

## Objetivo

Convertir el e-commerce actual en un catálogo virtual: el cliente navega los artículos, ve precios y cuotas, y consulta por WhatsApp. No hay compra online. Se mantienen la estética y la paleta de colores del proyecto original, y la base técnica (Next.js 15, React 19, MongoDB + Mongoose, Zod) para poder crecer a futuro.

## Restricciones

- El proyecto original (`eccomerce (1)/eccomerce`) no se modifica. El nuevo proyecto vive en `/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte`.
- Debe soportar unos 3.000 artículos con navegación fluida.
- Las imágenes se cargan una por una desde la ficha del artículo en el admin (hoy están en Canva). La importación masiva no toca imágenes.

## Enfoque

Copiar el proyecto original a la carpeta nueva y recortarlo. Lo que no se usa se deshabilita sin borrar el código, para poder reactivarlo a futuro.

## Diseño

### 1. Modelo de producto

- `sku`: string, único, es la clave de importación y actualización.
- `name`, `description`, `category`, `subCategory`, `brand`, `features`, `images`, `active`: se mantienen.
- `cashPrice` (precio en efectivo) y `listPrice` (precio de contado): dos valores cargados a mano, ambos numéricos y no negativos. Reemplazan al `price` actual.
- `available`: booleano. Reemplaza a `stock` como indicador de disponibilidad; `stock` pasa a ser opcional.

### 2. Cuotas calculadas por día

Se calculan con la fecha actual, en la zona horaria de Argentina:

- Miércoles y sábados: 3 cuotas sin interés, todas las tarjetas.
- Miércoles: además, 6 cuotas con Hipotecario.
- Días BBVA: fechas cargadas desde el admin (una o varias por mes). Ese día se muestran 6 cuotas con BBVA.
- Otros días: se informa cuál es la próxima promo.

Valor de la cuota = `listPrice / cantidad de cuotas`. Esta fórmula se asume y queda pendiente de confirmar con el negocio.

La lógica vive en un módulo puro (`lib/installments.ts`) que recibe una fecha y las fechas BBVA, y devuelve las promos vigentes. Es testeable sin base de datos.

### 3. WhatsApp

- Botón "Consultar" en la tarjeta y en la ficha del artículo.
- Abre `https://wa.me/<número>?text=...` con nombre, SKU y link al artículo.
- El número y la plantilla del mensaje se configuran en el admin, en una colección de ajustes. No quedan fijos en el código.

### 4. Carga masiva

- Pantalla "Importar" en el admin que acepta CSV y Excel.
- Clave de coincidencia: `sku`. Existe, actualiza; no existe, crea.
- Flujo en dos pasos: previsualización (cuántos crea, cuántos modifica, filas con error y su motivo) y confirmación.
- Validación de cada fila con Zod. Las filas con error no se aplican y se informan; las válidas sí.
- Botón "Exportar" que descarga el catálogo en el mismo formato de importación.
- Las escrituras usan `bulkWrite` en lotes, para no hacer una consulta por artículo.

### 5. Filtros inteligentes (estilo Mercado Libre)

- Barra lateral de filtros en el listado (en celular, un panel desplegable) que se arma a partir de los resultados actuales.
- Facetas: categoría y subcategoría (en árbol), marca, rango de precio (mínimo y máximo, más tramos sugeridos) y disponibilidad.
- Cada opción muestra la cantidad de artículos que tiene. Las opciones con 0 resultados se ocultan o se atenúan.
- Los conteos se recalculan al aplicar otros filtros. Se obtienen con una sola agregación de Mongo (`$facet`), no con una consulta por filtro.
- Filtros aplicados visibles como chips arriba de los resultados, cada uno con una "x" para quitarlo, y un "Limpiar todo".
- Ordenamiento: más relevantes (por texto cuando hay búsqueda), menor precio, mayor precio, más nuevos.
- El estado completo (búsqueda, filtros, orden, página) vive en la URL como query params. Se puede compartir un link filtrado y los botones atrás y adelante funcionan.
- Búsqueda con texto sobre nombre, marca, categoría y SKU, tolerante a mayúsculas y tildes.
- Atributos técnicos específicos por categoría (por ejemplo voltaje o capacidad) quedan fuera de esta versión. Hoy `features` es texto libre y no se puede filtrar de forma confiable; se puede sumar después con atributos estructurados.

### 6. Rendimiento

- El listado público usa paginación en el servidor y los índices de Mongo para búsqueda y facetas (`category`, `subCategory`, `brand`, `listPrice`, `available`, `active` y el índice de texto).
- La home no carga el catálogo completo.
- El panel de admin pagina y busca en servidor.

### 7. Qué se deshabilita

- Carrito, checkout, rutas de pedidos y login de clientes quedan fuera de la navegación y sus rutas devuelven 404.
- Se elimina el seed de productos de ejemplo.
- La página de promos bancarias y las promociones de la home se mantienen.

## Prueba

- Tests unitarios de `installments.ts` (cada día de la semana, días BBVA, zona horaria) y del parseo y validación de filas de importación.
- Tests de la construcción de la consulta de filtros y de los conteos de facetas, y del paso de filtros a query params y de vuelta.
- Verificación manual: importar un archivo de prueba de varios cientos de filas, reimportarlo modificado y confirmar que actualiza sin duplicar; cargar una imagen desde la ficha; abrir un mensaje de WhatsApp.
- `npm run typecheck` limpio.

## Supuestos pendientes de confirmar

- El precio en efectivo y el de contado son dos valores independientes cargados a mano.
- La cuota se calcula sobre el precio de contado.
- El nombre de la carpeta es `catalogo-electronorte`.

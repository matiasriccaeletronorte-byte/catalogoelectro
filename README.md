# Catálogo Electronorte

Catálogo virtual con consultas por WhatsApp. Cada artículo muestra precio en efectivo y de contado, las cuotas vigentes del día y un botón que abre WhatsApp con el mensaje armado. Construido con **Next.js + React** y **MongoDB + Mongoose**.

## Levantarlo (Linux)

1. MongoDB: `docker start electronorte-mongo` (o `docker run -d --name electronorte-mongo -p 27017:27017 mongo:8`).
2. Copiá `.env.example` a `.env.local` y definí `ADMIN_PASSWORD`.
3. `npm install`
4. `npm run dev` y abrí http://localhost:3000. El panel está en `/admin`.

Variables: `MONGODB_URI` (base `catalogo_electronorte`), `ADMIN_PASSWORD`, `UPLOAD_DIR` (carpeta de imágenes subidas, `./uploads` por defecto).

## Panel de administración

- **Productos:** alta, edición y desactivación de a uno. Las imágenes se suben desde la ficha del artículo (JPG, PNG o WebP, hasta 5 MB).
- **Importar / Exportar:** carga y modificación masiva desde Excel (.xlsx) o CSV, con vista previa antes de aplicar.
- **WhatsApp y promos:** número de WhatsApp, plantilla del mensaje (`{nombre}`, `{sku}`, `{link}`) y fechas de 6 cuotas con BBVA.
- **Home** y **Categorías:** igual que en el proyecto original.

### Formato del archivo de importación

Primera fila con encabezados (no importan mayúsculas ni tildes): `SKU`, `Nombre`, `Descripción`, `Categoría`, `Subcategoría`, `Marca`, `Precio efectivo`, `Precio contado`, `Disponible`, `Características` (separadas por `|`), `Outlet`, `Activo`.

- El **SKU** es la clave: si existe se actualiza, si no se crea. Un artículo nuevo necesita Nombre, Categoría y los dos precios.
- Una **celda vacía no borra** el dato existente, y una **columna ausente no se toca**.
- Sí/no se escribe `sí`/`no`, `1`/`0` o `true`/`false`. Los precios aceptan `1234`, `1.234,50` o `$ 1.234`.
- Un SKU repetido dentro del archivo se informa como error en la segunda fila.
- Las imágenes no se importan: se cargan desde cada artículo.
- "Descargar catálogo actual" exporta con las mismas columnas, para editar en Excel y volver a subir.

## Cuotas

Se calculan por día (hora de Argentina): miércoles y sábados 3 cuotas sin interés; miércoles además 6 cuotas con Hipotecario; el día cargado en el panel, 6 cuotas con BBVA. La cuota es el precio de contado dividido por la cantidad de cuotas.

## Tienda online apagada

Carrito, checkout, pedidos, login de clientes y Contabilium están en `src/_disabled/` (fuera de las rutas y del typecheck). Para reactivarlos hay que moverlos de vuelta a `src/app`, `src/components`, `src/models` y `src/lib`, y adaptarlos al nuevo modelo de producto (`cashPrice` y `listPrice` en lugar de `price`).

## Verificación

```bash
npm run typecheck
npm test
npm run build
```

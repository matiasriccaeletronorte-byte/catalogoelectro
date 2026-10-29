# Electronorte Outlet

E-commerce con catálogo, carrito persistente, pedidos para aprobación manual, administración de productos y sincronización opcional con Contabilium. Está construido con **Next.js + React** y **MongoDB + Mongoose**.

## Primeros pasos

1. Instalá Node.js LTS y Docker Desktop.
2. Creá `.env.local` con `MONGODB_URI`, las variables de administrador y las credenciales de Google si vas a usar inicio de sesión.
3. Iniciá MongoDB: `docker compose up -d mongo`.
4. Instalá dependencias: `npm.cmd install`.
5. Iniciá el sitio: `npm.cmd run dev` y abrí `http://localhost:3000`.

La primera visita a `/api/products` carga cuatro productos de ejemplo cuando la base está vacía. Modificá o eliminá `src/lib/seed.ts` antes de usar una base de producción vacía.

## Flujo de pedidos

Cliente → catálogo → carrito → datos → `POST /api/orders` → estado `pending_review`.

El administrador revisa stock, condición y envío; luego cambia el pedido a `approved` y comparte el medio de pago. No se procesan pagos automáticos en esta versión.

El descuento local de stock se controla con `INVENTORY_DEDUCTION_ENABLED` en `.env.local`. Por defecto se deja en `false`.

## Validación

Antes de publicar cambios ejecutá:

```powershell
npm.cmd run typecheck
```

# Catálogo Electronorte con WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el e-commerce de Electronorte en un catálogo virtual con consulta por WhatsApp, precios en efectivo y contado, cuotas por día, filtros estilo Mercado Libre y carga/modificación masiva de ~3.000 artículos.

**Architecture:** Se copia el proyecto original a `catalogo-electronorte` y se recorta: carrito, checkout, pedidos, login de clientes y Contabilium pasan a `src/_disabled/` (fuera de las rutas y excluidos del typecheck). Lógica pura y testeable en `src/lib/` (cuotas, WhatsApp, filtros, importación); las rutas API y los componentes son capas finas sobre ella. Base de datos nueva y separada (`catalogo_electronorte`) para no tocar la del proyecto original.

**Tech Stack:** Next.js 15, React 19, MongoDB + Mongoose 8, Zod 3, TypeScript 5, Vitest (tests), ExcelJS (leer y escribir xlsx/csv).

**Spec:** `docs/superpowers/specs/2026-10-28-catalogo-whatsapp-design.md`

## Global Constraints

- El proyecto original `/home/mati/Escritorio/Proyectos electronorte/eccomerce (1)/eccomerce` NO se modifica. Solo se lee y se copia.
- Carpeta del nuevo proyecto: `/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte` (todas las rutas de este plan son relativas a ella).
- Se mantienen la estética y la paleta del original (`--brand:#E52627`, fuente Manrope, clases CSS existentes). No se redefine el CSS global; el CSS nuevo usa las variables existentes.
- SKU único: clave de importación y actualización.
- Zona horaria de las cuotas: `America/Argentina/Buenos_Aires`.
- Cuota = `listPrice / cantidad de cuotas` (supuesto del spec, pendiente de confirmar con el negocio).
- Las imágenes se cargan una por una desde la ficha del artículo en el admin; la importación masiva no las toca.
- Textos de la interfaz en español rioplatense, como el original.
- No commitear secretos: `.env.local` va en `.gitignore`.
- Comandos de Node: `npm` (el README original usa `npm.cmd` por Windows; acá se usa Linux).

## Review Focus

- **SKU repetido dentro del mismo archivo de importación:** la segunda fila se informa como error, no pisa a la primera (Task 10).
- **Celda vacía en una reimportación:** no borra el dato existente; solo se aplican las celdas con valor (Task 10).
- **Columna ausente en el archivo:** no se toca ese campo en los artículos existentes (Task 10).
- **Archivo con encabezados en mayúsculas, con tildes o con espacios** (`Precio Efectivo`, `DESCRIPCIÓN`): se reconocen igual (Task 10).
- **Precios con formato argentino** (`1.234,50`, `$ 1.234`): se interpretan bien o se informan como error, nunca como un número equivocado (Task 10).
- **Búsqueda con tildes, mayúsculas o una parte de la palabra** (`lavar`, `HELADERA`, `cafe` por `café`): encuentra el artículo (Task 4).
- **Caracteres especiales de regex en la búsqueda** (`(`, `*`, `+`): no rompen la consulta (Task 4).
- **Link filtrado con valores inválidos** (`?page=-3&minPrice=abc&sort=xyz`): se normaliza a valores por defecto, no da error 500 (Task 4).
- **Fecha cercana a la medianoche** (23:30 en Argentina es 02:30 UTC del día siguiente): las cuotas siguen siendo las del día argentino (Task 1).
- **Intento de leer un archivo fuera de la carpeta de uploads** (`../`): responde 404 (Task 8).

---

### Task 0: Crear el proyecto base

**Files:**
- Create: toda la copia del proyecto en `catalogo-electronorte/` (excepto `node_modules`, `.next`, `.git`, `.env.local`, `.env.example`)
- Create: `.gitignore`, `.env.example`, `.env.local`, `vitest.config.ts`
- Modify: `package.json` (scripts y dependencias), `tsconfig.json` (excluir `_disabled`)

**Interfaces:**
- Produces: proyecto instalable con `npm test` (Vitest) y `npm run typecheck`; alias `@/` apuntando a `src/`.

- [ ] **Step 1: Copiar el proyecto original sin dependencias ni secretos**

```bash
SRC="/home/mati/Escritorio/Proyectos electronorte/eccomerce (1)/eccomerce"
DST="/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte"
cd "$SRC" && tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=.env.local --exclude=.env.example -cf - . | (cd "$DST" && tar -xf -)
cd "$DST" && ls
```

Expected: aparecen `src`, `public`, `package.json`, `Dockerfile`, `docker-compose.yml`, `docs`, y no aparece `node_modules`.

- [ ] **Step 2: Crear `.gitignore`, `.env.example` y `.env.local`**

`.gitignore`:

```
node_modules/
.next/
.env
.env.local
*.log
coverage/
uploads/
```

`.env.example`:

```
MONGODB_URI=mongodb://localhost:27017/catalogo_electronorte
NEXT_PUBLIC_STORE_NAME=Electronorte
ADMIN_PASSWORD=cambiar-esta-clave
UPLOAD_DIR=./uploads
```

Crear `.env.local` con el mismo contenido que `.env.example`, poniendo una `ADMIN_PASSWORD` real distinta. No copiar el `.env.local` del proyecto original.

- [ ] **Step 3: Ajustar `package.json`**

Cambiar el nombre y los scripts, y agregar dependencias:

```json
{
  "name": "catalogo-electronorte",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit --incremental false",
    "test": "vitest run"
  }
}
```

```bash
cd "/home/mati/Escritorio/Proyectos electronorte/catalogo-electronorte"
npm install exceljs@^4.4.0
npm install -D vitest@^2.1.9
```

- [ ] **Step 4: Configurar Vitest y excluir `_disabled` del typecheck**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts"] }
});
```

En `tsconfig.json` cambiar `"exclude": ["node_modules"]` por:

```json
"exclude": ["node_modules", "src/_disabled"]
```

- [ ] **Step 5: Verificar que arranca y commitear**

```bash
npm run typecheck
git init && git add -A && git commit -m "chore: copia base del proyecto Electronorte"
```

Expected: typecheck sin errores. Si falla por permisos de `node_modules/.bin`, ejecutar `chmod +x node_modules/.bin/*`.

---

### Task 1: Cuotas por día (`installments.ts`)

**Files:**
- Create: `src/lib/installments.ts`
- Test: `src/lib/installments.test.ts`

**Interfaces:**
- Produces:
  - `type Promo = { id: "cuotas3" | "hipotecario6" | "bbva6"; installments: number; label: string }`
  - `type NextPromo = { label: string; daysAhead: number }`
  - `argentinaYmd(date: Date): string` → `"YYYY-MM-DD"` según hora argentina
  - `activePromos(date: Date, bbvaDates: string[]): Promo[]`
  - `nextPromo(date: Date, bbvaDates: string[]): NextPromo | null`
  - `installmentValue(listPrice: number, installments: number): number` (redondeado a entero)

- [ ] **Step 1: Escribir los tests que fallan**

`src/lib/installments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activePromos, argentinaYmd, installmentValue, nextPromo } from "./installments";

// 15:00 UTC = 12:00 en Argentina
const at = (ymd: string) => new Date(`${ymd}T15:00:00Z`);
const ids = (date: Date, bbva: string[] = []) => activePromos(date, bbva).map((p) => p.id);

describe("activePromos", () => {
  it("miércoles: 3 cuotas y 6 con Hipotecario", () => {
    expect(ids(at("2026-10-28"))).toEqual(["cuotas3", "hipotecario6"]);
  });
  it("sábado: solo 3 cuotas", () => {
    expect(ids(at("2026-10-31"))).toEqual(["cuotas3"]);
  });
  it("jueves: sin promos", () => {
    expect(ids(at("2026-10-29"))).toEqual([]);
  });
  it("día BBVA cargado: 6 cuotas con BBVA", () => {
    expect(ids(at("2026-11-12"), ["2026-11-12"])).toEqual(["bbva6"]);
  });
  it("día BBVA que cae miércoles suma las tres promos", () => {
    expect(ids(at("2026-10-28"), ["2026-10-28"])).toEqual(["cuotas3", "hipotecario6", "bbva6"]);
  });
  it("usa el día argentino aunque en UTC ya sea el día siguiente", () => {
    // 02:30 UTC del jueves = miércoles 23:30 en Argentina
    expect(ids(new Date("2026-10-29T02:30:00Z"))).toEqual(["cuotas3", "hipotecario6"]);
  });
});

describe("argentinaYmd", () => {
  it("devuelve la fecha argentina", () => {
    expect(argentinaYmd(new Date("2026-10-29T02:30:00Z"))).toBe("2026-10-28");
  });
});

describe("nextPromo", () => {
  it("un jueves, la próxima es el sábado", () => {
    expect(nextPromo(at("2026-10-29"), [])).toEqual({ label: "sábado", daysAhead: 2 });
  });
  it("considera el día BBVA si llega antes", () => {
    expect(nextPromo(at("2026-10-29"), ["2026-10-30"])).toEqual({ label: "viernes", daysAhead: 1 });
  });
  it("hoy hay promo: devuelve null", () => {
    expect(nextPromo(at("2026-10-28"), [])).toBeNull();
  });
});

describe("installmentValue", () => {
  it("divide y redondea", () => {
    expect(installmentValue(100000, 3)).toBe(33333);
    expect(installmentValue(100000, 6)).toBe(16667);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/installments.test.ts`
Expected: FAIL (`Cannot find module './installments'`).

- [ ] **Step 3: Implementar**

`src/lib/installments.ts`:

```ts
export type Promo = { id: "cuotas3" | "hipotecario6" | "bbva6"; installments: number; label: string };
export type NextPromo = { label: string; daysAhead: number };

const TZ = "America/Argentina/Buenos_Aires";
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function argentinaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function argentinaWeekday(date: Date): number {
  return WEEKDAY_INDEX[new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(date)];
}

export function activePromos(date: Date, bbvaDates: string[]): Promo[] {
  const weekday = argentinaWeekday(date);
  const promos: Promo[] = [];
  if (weekday === 3 || weekday === 6) promos.push({ id: "cuotas3", installments: 3, label: "3 cuotas sin interés" });
  if (weekday === 3) promos.push({ id: "hipotecario6", installments: 6, label: "6 cuotas con Hipotecario" });
  if (bbvaDates.includes(argentinaYmd(date))) promos.push({ id: "bbva6", installments: 6, label: "6 cuotas con BBVA" });
  return promos;
}

export function nextPromo(date: Date, bbvaDates: string[]): NextPromo | null {
  if (activePromos(date, bbvaDates).length > 0) return null;
  for (let daysAhead = 1; daysAhead <= 35; daysAhead++) {
    const candidate = new Date(date.getTime() + daysAhead * 86_400_000);
    if (activePromos(candidate, bbvaDates).length > 0) return { label: WEEKDAYS[argentinaWeekday(candidate)], daysAhead };
  }
  return null;
}

export function installmentValue(listPrice: number, installments: number): number {
  return Math.round(listPrice / installments);
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run src/lib/installments.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/installments.ts src/lib/installments.test.ts
git commit -m "feat: cálculo de cuotas por día de la semana y días BBVA"
```

---

### Task 2: Mensaje de WhatsApp y ajustes del sitio

**Files:**
- Create: `src/lib/whatsapp.ts`, `src/lib/whatsapp.test.ts`
- Create: `src/models/SiteSettings.ts`
- Create: `src/lib/site-settings.ts`
- Create: `src/app/api/settings/route.ts`, `src/app/api/admin/settings/route.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_TEMPLATE: string`
  - `buildWhatsappUrl(phone: string, template: string, vars: { name: string; sku?: string; link: string }): string`
  - `type SiteSettings = { whatsappPhone: string; whatsappTemplate: string; bbvaDates: string[] }`
  - `getSiteSettings(): Promise<SiteSettings>` (conecta a la base y crea los valores por defecto)
  - `GET /api/settings` (público) → `SiteSettings`; `GET/PUT /api/admin/settings` (solo admin)

- [ ] **Step 1: Test que falla**

`src/lib/whatsapp.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildWhatsappUrl, DEFAULT_TEMPLATE } from "./whatsapp";

describe("buildWhatsappUrl", () => {
  it("arma el link con nombre, código y link, codificados", () => {
    const url = buildWhatsappUrl("+54 9 11 5456-0043", DEFAULT_TEMPLATE, { name: "Heladera 340L", sku: "HEL-340", link: "https://x.com/productos/1" });
    expect(url.startsWith("https://wa.me/5491154560043?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]);
    expect(text).toBe("Hola, quiero consultar por Heladera 340L (código HEL-340) – https://x.com/productos/1");
  });
  it("sin SKU omite el paréntesis", () => {
    const text = decodeURIComponent(buildWhatsappUrl("5491100000000", DEFAULT_TEMPLATE, { name: "Lámpara", link: "https://x.com/p" }).split("?text=")[1]);
    expect(text).toBe("Hola, quiero consultar por Lámpara – https://x.com/p");
  });
  it("sin teléfono devuelve cadena vacía", () => {
    expect(buildWhatsappUrl("", DEFAULT_TEMPLATE, { name: "A", link: "b" })).toBe("");
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run src/lib/whatsapp.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar `whatsapp.ts`**

```ts
export const DEFAULT_TEMPLATE = "Hola, quiero consultar por {nombre} (código {sku}) – {link}";

export function buildWhatsappUrl(phone: string, template: string, vars: { name: string; sku?: string; link: string }): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  let text = template || DEFAULT_TEMPLATE;
  if (!vars.sku) text = text.replace(/\s*\(código \{sku\}\)/, "").replace("{sku}", "");
  text = text.replace("{nombre}", vars.name).replace("{sku}", vars.sku ?? "").replace("{link}", vars.link);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run src/lib/whatsapp.test.ts` → PASS (3 tests).

- [ ] **Step 5: Modelo y acceso a ajustes**

`src/models/SiteSettings.ts`:

```ts
import { model, models, Schema } from "mongoose";

const siteSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  whatsappPhone: { type: String, default: "" },
  whatsappTemplate: { type: String, default: "" },
  bbvaDates: { type: [String], default: [] }
}, { timestamps: true });

export const SiteSettingsModel = models.SiteSettings || model("SiteSettings", siteSettingsSchema);
```

`src/lib/site-settings.ts`:

```ts
import { connectDb } from "@/lib/db";
import { DEFAULT_TEMPLATE } from "@/lib/whatsapp";
import { SiteSettingsModel } from "@/models/SiteSettings";

export type SiteSettings = { whatsappPhone: string; whatsappTemplate: string; bbvaDates: string[] };

export async function getSiteSettings(): Promise<SiteSettings> {
  await connectDb();
  const doc = await SiteSettingsModel.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, new: true }).lean();
  return {
    whatsappPhone: doc?.whatsappPhone ?? "",
    whatsappTemplate: doc?.whatsappTemplate || DEFAULT_TEMPLATE,
    bbvaDates: [...(doc?.bbvaDates ?? [])].sort()
  };
}
```

- [ ] **Step 6: Rutas API**

`src/app/api/settings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";

export async function GET() {
  const response = NextResponse.json(await getSiteSettings());
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response;
}
```

`src/app/api/admin/settings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSettingsModel } from "@/models/SiteSettings";

const schema = z.object({
  whatsappPhone: z.string().trim().max(30),
  whatsappTemplate: z.string().trim().max(500),
  bbvaDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60)
});

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  return NextResponse.json(await getSiteSettings());
}

export async function PUT(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = schema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await connectDb();
  await SiteSettingsModel.updateOne({ key: "main" }, { $set: { ...data.data, bbvaDates: [...new Set(data.data.bbvaDates)].sort() } }, { upsert: true });
  return NextResponse.json(await getSiteSettings());
}
```

- [ ] **Step 7: Commit**

```bash
npm run typecheck && git add -A && git commit -m "feat: ajustes del sitio y mensaje de WhatsApp"
```

---

### Task 3: Apagar tienda online y actualizar el modelo de producto

**Files:**
- Move to `src/_disabled/`: `src/app/checkout`, `src/app/account`, `src/app/api/orders`, `src/app/api/customer`, `src/app/api/auth`, `src/app/api/integrations`, `src/components/cart-provider.tsx`, `src/components/checkout-form.tsx`, `src/models/Order.ts`, `src/models/Customer.ts`, `src/app/account.css`, `src/lib/customer-auth.ts`, `src/lib/seed.ts`
- Modify: `src/models/Product.ts`, `src/lib/types.ts`, `src/app/layout.tsx`
- Create: `src/lib/text.ts`, `src/lib/text.test.ts`, `src/lib/product-schema.ts`

**Interfaces:**
- Produces:
  - `normalizeText(value: string): string` (minúsculas, sin tildes, espacios colapsados)
  - `Product` (tipo público): `{ id, sku?, name, description, cashPrice, listPrice, available, category, subCategory?, brand?, features?, outlet, image, images? }`
  - `productInputSchema` (Zod) y `type ProductInput`; `withSearchText<T>(doc: T): T & { searchText: string }`
  - Modelo `ProductModel` con campos `cashPrice`, `listPrice`, `available`, `searchText`.

- [ ] **Step 1: Test de `normalizeText`**

`src/lib/text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeText } from "./text";

describe("normalizeText", () => {
  it("pasa a minúsculas y quita tildes", () => {
    expect(normalizeText("  CAFÉ   Ñandú ")).toBe("cafe nandu");
  });
  it("cadena vacía", () => {
    expect(normalizeText("")).toBe("");
  });
});
```

Run: `npx vitest run src/lib/text.test.ts` → FAIL.

- [ ] **Step 2: Implementar**

`src/lib/text.ts`:

```ts
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
```

Run: `npx vitest run src/lib/text.test.ts` → PASS.

- [ ] **Step 3: Mover lo que se apaga**

```bash
mkdir -p src/_disabled/app/api src/_disabled/components src/_disabled/models src/_disabled/lib
git mv src/app/checkout src/_disabled/app/checkout
git mv src/app/account src/_disabled/app/account
git mv src/app/account.css src/_disabled/app/account.css
git mv src/app/api/orders src/_disabled/app/api/orders
git mv src/app/api/customer src/_disabled/app/api/customer
git mv src/app/api/auth src/_disabled/app/api/auth
git mv src/app/api/integrations src/_disabled/app/api/integrations
git mv src/components/cart-provider.tsx src/_disabled/components/
git mv src/components/checkout-form.tsx src/_disabled/components/
git mv src/models/Order.ts src/_disabled/models/
git mv src/models/Customer.ts src/_disabled/models/
git mv src/lib/customer-auth.ts src/_disabled/lib/
git mv src/lib/seed.ts src/_disabled/lib/
```

Las carpetas `services/integrations` y `src/lib/login-attempts.ts` / `models/LoginAttempt.ts` se dejan: el login de admin usa `login-attempts`. Verificar con `grep -rn "login-attempts" src --include=*.ts` antes de mover algo más.

- [ ] **Step 4: Nuevo modelo de producto**

Reemplazar `src/models/Product.ts`:

```ts
import { InferSchemaType, model, models, Schema } from "mongoose";

const productSchema = new Schema({
  sku: { type: String, trim: true, unique: true, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  cashPrice: { type: Number, required: true, min: 0 },
  listPrice: { type: Number, required: true, min: 0 },
  available: { type: Boolean, default: true },
  stock: { type: Number, min: 0 },
  active: { type: Boolean, default: true },
  category: { type: String, required: true, trim: true },
  subCategory: { type: String, default: "", trim: true },
  brand: { type: String, default: "", trim: true },
  features: { type: [String], default: [] },
  outlet: { type: Boolean, default: false },
  image: { type: String, default: "" },
  images: { type: [String], default: [] },
  searchText: { type: String, default: "" }
}, { timestamps: true });

productSchema.index({ active: 1, category: 1, subCategory: 1, brand: 1, listPrice: 1 });
productSchema.index({ active: 1, createdAt: -1 });
productSchema.index({ active: 1, listPrice: 1 });

export type ProductDocument = InferSchemaType<typeof productSchema>;
export const ProductModel = models.Product || model("Product", productSchema);
```

Nota: un `ProductModel` ya registrado en caliente por HMR conserva el esquema viejo; si en desarrollo falla, reiniciar `npm run dev`.

- [ ] **Step 5: Esquema Zod compartido**

`src/lib/product-schema.ts`:

```ts
import { z } from "zod";
import { normalizeText } from "@/lib/text";

export const productInputSchema = z.object({
  sku: z.string().trim().min(1, "Falta el SKU"),
  name: z.string().trim().min(2),
  description: z.string().default(""),
  cashPrice: z.coerce.number().min(0),
  listPrice: z.coerce.number().min(0),
  available: z.boolean().default(true),
  category: z.string().trim().min(2),
  subCategory: z.string().trim().default(""),
  brand: z.string().trim().default(""),
  features: z.array(z.string().trim().min(1).max(50)).max(8).default([]),
  outlet: z.boolean().default(false),
  active: z.boolean().default(true)
});

export type ProductInput = z.infer<typeof productInputSchema>;

export function searchTextOf(doc: { sku?: string; name?: string; brand?: string; category?: string; subCategory?: string }): string {
  return normalizeText([doc.sku, doc.name, doc.brand, doc.category, doc.subCategory].filter(Boolean).join(" "));
}

export function withSearchText<T extends { sku?: string; name?: string; brand?: string; category?: string; subCategory?: string }>(doc: T): T & { searchText: string } {
  return { ...doc, searchText: searchTextOf(doc) };
}
```

- [ ] **Step 6: Tipos públicos y layout**

`src/lib/types.ts`:

```ts
export type Product = {
  id: string;
  sku?: string;
  name: string;
  description: string;
  cashPrice: number;
  listPrice: number;
  available: boolean;
  category: string;
  subCategory?: string;
  brand?: string;
  features?: string[];
  outlet: boolean;
  image: string;
  images?: string[];
};
```

En `src/app/layout.tsx`: quitar `import "./account.css"`, el import y el uso de `CartProvider`, y cambiar el `<footer>` a `Electronorte · Consultanos por WhatsApp`. El botón flotante de WhatsApp (`whatsapp-fab`) se conserva pero se hace en Task 5 dependiente de los ajustes; por ahora dejar su `href` actual.

- [ ] **Step 7: Commit (el typecheck fallará hasta las tasks siguientes; es esperado)**

```bash
git add -A && git commit -m "refactor: apaga carrito/pedidos/clientes y nuevo modelo de producto"
```

---

### Task 4: Filtros del catálogo (parseo, consulta y facetas)

**Files:**
- Create: `src/lib/catalog-filters.ts`, `src/lib/catalog-filters.test.ts`
- Create: `src/lib/catalog-query.ts`
- Modify (rewrite): `src/app/api/products/route.ts`

**Interfaces:**
- Consumes: `normalizeText` (Task 3), `ProductModel` (Task 3).
- Produces:
  - `type CatalogFilters = { q: string; category: string; subCategory: string; brands: string[]; minPrice?: number; maxPrice?: number; availableOnly: boolean; sort: SortKey; page: number }`
  - `type SortKey = "relevance" | "price_asc" | "price_desc" | "newest"`
  - `PAGE_SIZE = 24`
  - `parseFilters(params: URLSearchParams): CatalogFilters`
  - `serializeFilters(filters: CatalogFilters): URLSearchParams` (omite valores por defecto)
  - `buildMatch(filters: CatalogFilters, omit?: "category" | "brand" | "price"): Record<string, unknown>`
  - `type CatalogResult = { items: Product[]; total: number; page: number; pageSize: number; facets: { categories: FacetCount[]; subCategories: FacetCount[]; brands: FacetCount[]; price: { min: number; max: number } } }` con `FacetCount = { value: string; count: number }`
  - `runCatalogQuery(filters: CatalogFilters): Promise<CatalogResult>`
  - `GET /api/products?...` (acepta además `ids=` para la home)

- [ ] **Step 1: Tests que fallan**

`src/lib/catalog-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMatch, parseFilters, serializeFilters } from "./catalog-filters";

const parse = (qs: string) => parseFilters(new URLSearchParams(qs));

describe("parseFilters", () => {
  it("valores por defecto", () => {
    expect(parse("")).toEqual({ q: "", category: "", subCategory: "", brands: [], minPrice: undefined, maxPrice: undefined, availableOnly: false, sort: "relevance", page: 1 });
  });
  it("normaliza valores inválidos", () => {
    const f = parse("page=-3&minPrice=abc&maxPrice=-5&sort=xyz");
    expect(f.page).toBe(1);
    expect(f.minPrice).toBeUndefined();
    expect(f.maxPrice).toBeUndefined();
    expect(f.sort).toBe("relevance");
  });
  it("lee marcas múltiples y rango", () => {
    const f = parse("brand=Samsung&brand=LG&minPrice=1000&maxPrice=5000&available=1&sort=price_asc&page=3");
    expect(f.brands).toEqual(["Samsung", "LG"]);
    expect([f.minPrice, f.maxPrice, f.availableOnly, f.sort, f.page]).toEqual([1000, 5000, true, "price_asc", 3]);
  });
});

describe("serializeFilters", () => {
  it("ida y vuelta", () => {
    const qs = "q=heladera&category=Heladeras&brand=LG&brand=Samsung&minPrice=100&sort=price_desc&page=2";
    expect(serializeFilters(parse(qs)).toString()).toBe(new URLSearchParams(qs).toString());
  });
  it("omite los valores por defecto", () => {
    expect(serializeFilters(parse("")).toString()).toBe("");
  });
});

describe("buildMatch", () => {
  it("siempre filtra activos", () => {
    expect(buildMatch(parse(""))).toEqual({ active: { $ne: false } });
  });
  it("categoría, marcas y precio", () => {
    const m = buildMatch(parse("category=Heladeras&brand=LG&brand=Samsung&minPrice=10&maxPrice=20&available=1"));
    expect(m).toEqual({ active: { $ne: false }, available: true, category: "Heladeras", brand: { $in: ["LG", "Samsung"] }, listPrice: { $gte: 10, $lte: 20 } });
  });
  it("omit quita la propia faceta", () => {
    const m = buildMatch(parse("category=Heladeras&brand=LG&minPrice=10"), "brand");
    expect(m).toEqual({ active: { $ne: false }, category: "Heladeras", listPrice: { $gte: 10 } });
  });
  it("búsqueda: una regex por palabra, sin tildes, escapando caracteres especiales", () => {
    const m = buildMatch(parse("q=Café (2+"));
    expect(m.$and).toEqual([{ searchText: { $regex: "cafe" } }, { searchText: { $regex: "\\(2\\+" } }]);
  });
});
```

Run: `npx vitest run src/lib/catalog-filters.test.ts` → FAIL.

- [ ] **Step 2: Implementar `catalog-filters.ts`**

```ts
import { normalizeText } from "@/lib/text";

export type SortKey = "relevance" | "price_asc" | "price_desc" | "newest";
export type CatalogFilters = {
  q: string; category: string; subCategory: string; brands: string[];
  minPrice?: number; maxPrice?: number; availableOnly: boolean; sort: SortKey; page: number;
};

export const PAGE_SIZE = 24;
const SORTS: SortKey[] = ["relevance", "price_asc", "price_desc", "newest"];

function positiveNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get("sort") as SortKey;
  const page = Math.floor(Number(params.get("page") ?? "1"));
  return {
    q: (params.get("q") ?? "").trim(),
    category: (params.get("category") ?? "").trim(),
    subCategory: (params.get("subCategory") ?? "").trim(),
    brands: params.getAll("brand").map((b) => b.trim()).filter(Boolean),
    minPrice: positiveNumber(params.get("minPrice")),
    maxPrice: positiveNumber(params.get("maxPrice")),
    availableOnly: params.get("available") === "1",
    sort: SORTS.includes(sort) ? sort : "relevance",
    page: Number.isFinite(page) && page >= 1 ? page : 1
  };
}

export function serializeFilters(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.subCategory) p.set("subCategory", f.subCategory);
  f.brands.forEach((b) => p.append("brand", b));
  if (f.minPrice !== undefined) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== undefined) p.set("maxPrice", String(f.maxPrice));
  if (f.availableOnly) p.set("available", "1");
  if (f.sort !== "relevance") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildMatch(f: CatalogFilters, omit?: "category" | "brand" | "price"): Record<string, unknown> {
  const match: Record<string, unknown> = { active: { $ne: false } };
  if (f.availableOnly) match.available = true;
  if (omit !== "category") {
    if (f.category) match.category = f.category;
    if (f.subCategory) match.subCategory = f.subCategory;
  }
  if (omit !== "brand" && f.brands.length > 0) match.brand = { $in: f.brands };
  if (omit !== "price" && (f.minPrice !== undefined || f.maxPrice !== undefined)) {
    const range: Record<string, number> = {};
    if (f.minPrice !== undefined) range.$gte = f.minPrice;
    if (f.maxPrice !== undefined) range.$lte = f.maxPrice;
    match.listPrice = range;
  }
  const words = normalizeText(f.q).split(" ").filter(Boolean);
  if (words.length > 0) match.$and = words.map((w) => ({ searchText: { $regex: escapeRegex(w) } }));
  return match;
}
```

- [ ] **Step 3: Verificar que pasa**

Run: `npx vitest run src/lib/catalog-filters.test.ts` → PASS.

- [ ] **Step 4: Consulta con facetas**

`src/lib/catalog-query.ts`:

```ts
import { connectDb } from "@/lib/db";
import { buildMatch, CatalogFilters, PAGE_SIZE } from "@/lib/catalog-filters";
import { Product } from "@/lib/types";
import { ProductModel } from "@/models/Product";

export type FacetCount = { value: string; count: number };
export type CatalogResult = {
  items: Product[]; total: number; page: number; pageSize: number;
  facets: { categories: FacetCount[]; subCategories: FacetCount[]; brands: FacetCount[]; price: { min: number; max: number } };
};

const SORTS = {
  relevance: { name: 1 },
  newest: { createdAt: -1 },
  price_asc: { listPrice: 1 },
  price_desc: { listPrice: -1 }
} as const;

const countBy = (field: string) => [{ $match: { [field]: { $nin: ["", null] } } }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 100 }];
const toCounts = (rows: { _id: string; count: number }[]): FacetCount[] => rows.map((r) => ({ value: r._id, count: r.count }));

export function toPublicProduct(row: Record<string, unknown>): Product {
  const { _id, searchText, stock, active, createdAt, updatedAt, __v, ...rest } = row as Record<string, unknown>;
  return { ...(rest as Omit<Product, "id">), id: String(_id) };
}

export async function runCatalogQuery(f: CatalogFilters): Promise<CatalogResult> {
  await connectDb();
  const sort = f.q && f.sort === "relevance" ? { name: 1 } : SORTS[f.sort];
  const [rows, [facets]] = await Promise.all([
    ProductModel.find(buildMatch(f)).sort({ ...sort, _id: 1 }).skip((f.page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    ProductModel.aggregate([{
      $facet: {
        total: [{ $match: buildMatch(f) }, { $count: "n" }],
        categories: [{ $match: buildMatch(f, "category") }, ...countBy("category")],
        subCategories: [{ $match: buildMatch(f) }, ...countBy("subCategory")],
        brands: [{ $match: buildMatch(f, "brand") }, ...countBy("brand")],
        price: [{ $match: buildMatch(f, "price") }, { $group: { _id: null, min: { $min: "$listPrice" }, max: { $max: "$listPrice" } } }]
      }
    }])
  ]);
  return {
    items: rows.map((row) => toPublicProduct(row as unknown as Record<string, unknown>)),
    total: facets.total[0]?.n ?? 0,
    page: f.page,
    pageSize: PAGE_SIZE,
    facets: {
      categories: toCounts(facets.categories),
      subCategories: f.category ? toCounts(facets.subCategories) : [],
      brands: toCounts(facets.brands),
      price: { min: facets.price[0]?.min ?? 0, max: facets.price[0]?.max ?? 0 }
    }
  };
}
```

Nota: `$match` dentro de `$facet` no usa índice de texto (no se usa `$text`), pero sí los índices de `category`/`brand`/`listPrice`; con ~3.000 documentos el recorrido es de milisegundos.

- [ ] **Step 5: Reescribir `GET /api/products`**

`src/app/api/products/route.ts`:

```ts
import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { parseFilters } from "@/lib/catalog-filters";
import { runCatalogQuery, toPublicProduct } from "@/lib/catalog-query";
import { ProductModel } from "@/models/Product";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 12);
  let body: unknown;
  if (ids.length > 0) {
    await connectDb();
    let rows: Record<string, unknown>[] = [];
    try {
      rows = await ProductModel.find({ _id: { $in: ids }, active: { $ne: false } }).lean() as unknown as Record<string, unknown>[];
    } catch {
      rows = [];
    }
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    body = { items: ids.map((id) => byId.get(id)).filter(Boolean).map((row) => toPublicProduct(row!)) };
  } else {
    body = await runCatalogQuery(parseFilters(searchParams));
  }
  const response = NextResponse.json(body);
  response.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  return response;
}
```

- [ ] **Step 6: Verificación con datos reales**

Crear algunos productos de prueba directamente (se reemplaza luego con la importación de Task 10). Con el servidor andando (`npm run dev`) y la base `catalogo_electronorte` en Mongo:

```bash
curl -s "localhost:3000/api/products?category=Heladeras&sort=price_asc" | head -c 600
curl -s "localhost:3000/api/products?page=-3&minPrice=abc&sort=xyz" | head -c 200
```

Expected: JSON con `items`, `total` y `facets`; el segundo no da error 500.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: filtros con facetas y búsqueda tolerante a tildes"
```

---

### Task 5: Tarjeta, ficha y botón de WhatsApp

**Files:**
- Create: `src/components/price-block.tsx`, `src/components/whatsapp-button.tsx`, `src/components/site-settings-provider.tsx`
- Modify (rewrite): `src/components/product-card.tsx`, `src/components/product-detail.tsx`
- Modify: `src/app/layout.tsx`, `src/app/productos/[id]/page.tsx`

**Interfaces:**
- Consumes: `Product` (Task 3), `activePromos`/`nextPromo`/`installmentValue` (Task 1), `buildWhatsappUrl` (Task 2), `GET /api/settings`.
- Produces:
  - `<SiteSettingsProvider initial={SiteSettings}>` y hook `useSiteSettings(): SiteSettings`
  - `<PriceBlock product={Product} />` (precios + cuotas vigentes)
  - `<WhatsappButton product={Product} className?: string />`

- [ ] **Step 1: Provider de ajustes (se hidrata desde el servidor)**

`src/components/site-settings-provider.tsx`:

```tsx
"use client";

import { createContext, useContext } from "react";
import type { SiteSettings } from "@/lib/site-settings";

const SiteSettingsContext = createContext<SiteSettings>({ whatsappPhone: "", whatsappTemplate: "", bbvaDates: [] });

export function SiteSettingsProvider({ initial, children }: { initial: SiteSettings; children: React.ReactNode }) {
  return <SiteSettingsContext.Provider value={initial}>{children}</SiteSettingsContext.Provider>;
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
```

En `src/app/layout.tsx`: volver `RootLayout` `async`, hacer `const settings = await getSiteSettings();` (importar de `@/lib/site-settings`), envolver `<Header />`, `{children}` y el botón flotante con `<SiteSettingsProvider initial={settings}>`, y ponerle al `whatsapp-fab` el `href` `https://wa.me/${settings.whatsappPhone.replace(/\D/g, "")}` (si no hay teléfono, no renderizar el botón flotante). Agregar `export const dynamic = "force-dynamic";` en el layout.

- [ ] **Step 2: `WhatsappButton`**

`src/components/whatsapp-button.tsx`:

```tsx
"use client";

import { buildWhatsappUrl, DEFAULT_TEMPLATE } from "@/lib/whatsapp";
import type { Product } from "@/lib/types";
import { useSiteSettings } from "./site-settings-provider";

export function WhatsappButton({ product, className = "whatsapp-button" }: { product: Product; className?: string }) {
  const { whatsappPhone, whatsappTemplate } = useSiteSettings();
  const link = typeof window === "undefined" ? `/productos/${product.id}` : `${window.location.origin}/productos/${product.id}`;
  const href = buildWhatsappUrl(whatsappPhone, whatsappTemplate || DEFAULT_TEMPLATE, { name: product.name, sku: product.sku, link });
  if (!href) return null;
  return <a className={className} href={href} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>;
}
```

- [ ] **Step 3: `PriceBlock`**

`src/components/price-block.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { activePromos, installmentValue, nextPromo } from "@/lib/installments";
import type { Product } from "@/lib/types";
import { useSiteSettings } from "./site-settings-provider";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function PriceBlock({ product }: { product: Product }) {
  const { bbvaDates } = useSiteSettings();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const promos = now ? activePromos(now, bbvaDates) : [];
  const next = now ? nextPromo(now, bbvaDates) : null;
  return <div className="price-block">
    <strong className="price-cash">{pesos.format(product.cashPrice)}<small> efectivo</small></strong>
    <span className="price-list">{pesos.format(product.listPrice)} contado</span>
    {promos.map((promo) => <span className="price-promo" key={promo.id}>{promo.label} de {pesos.format(installmentValue(product.listPrice, promo.installments))}</span>)}
    {now && promos.length === 0 && next ? <span className="price-next">Próxima promo de cuotas: {next.label}</span> : null}
  </div>;
}
```

Se calcula en el cliente (`useEffect`) para evitar diferencias de hidratación entre servidor y navegador.

- [ ] **Step 4: Reescribir tarjeta y ficha**

En `product-card.tsx`: eliminar `useCart`, el estado `added`, la función `addToCart`, los usos de `stock`/`outOfStock`, y el `pesos.format(product.price)`. Mantener carrusel de imágenes, badges y timer de oferta. Reemplazar el bloque `<strong>…</strong>` y `.card-footer` por:

```tsx
<PriceBlock product={product} />
<div className="card-footer">
  <span>{product.available ? "Disponible" : "Consultar disponibilidad"}</span>
  <WhatsappButton product={product} className="whatsapp-button small" />
</div>
```

En `product-detail.tsx`: eliminar `useCart`, `added`, `addToCart`, `outOfStock`; reemplazar `.product-price`, el párrafo de stock y el botón de agregar por `<PriceBlock product={product} />`, el texto `product.available ? "Disponible" : "Consultar disponibilidad"` y `<WhatsappButton product={product} className="whatsapp-button large" />`. Cambiar el bloque `.product-service` a `<b>Atención personalizada</b><span>Consultanos por WhatsApp y te asesoramos.</span>`. El breadcrumb pasa a `<Link href={`/catalogo?category=${encodeURIComponent(product.category)}`}>`.

En `src/app/productos/[id]/page.tsx`: reemplazar el `findOne` por `{ _id: id, active: { $ne: false } }` (ya no se filtra por stock) y devolver con `toPublicProduct` de `@/lib/catalog-query`.

- [ ] **Step 5: CSS nuevo (usa las variables existentes)**

Agregar al final de `src/app/interaction.css`:

```css
.price-block{display:grid;gap:4px;margin:8px 0 14px}
.price-cash{font-size:22px;letter-spacing:-.5px;color:var(--text)}
.price-cash small{font-size:12px;font-weight:700;color:var(--muted)}
.price-list{font-size:13px;color:var(--muted)}
.price-promo{display:inline-block;font-size:12px;font-weight:800;color:var(--brand);background:var(--brand-soft);border-radius:var(--radius-sm);padding:4px 8px;width:fit-content}
.price-next{font-size:12px;color:var(--muted)}
.whatsapp-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#1fa855;color:#fff;font-weight:800;text-decoration:none;border-radius:var(--radius-md);padding:10px 14px;font-size:14px}
.whatsapp-button.small{padding:8px 10px;font-size:12px}
.whatsapp-button.large{padding:14px 18px;font-size:16px;width:100%}
.whatsapp-button:hover{background:#188f48}
```

- [ ] **Step 6: Typecheck parcial y commit**

```bash
npx tsc --noEmit --incremental false 2>&1 | grep -E "product-card|product-detail|price-block|whatsapp-button|site-settings|productos/" || echo "sin errores en estos archivos"
git add -A && git commit -m "feat: tarjeta y ficha con precios, cuotas y botón de WhatsApp"
```

Expected: "sin errores en estos archivos" (puede haber errores en `home-page`, `header` y `admin-panel`, que se corrigen en Tasks 6–9).

---

### Task 6: Página `/catalogo` con filtros estilo Mercado Libre

**Files:**
- Create: `src/app/catalogo/page.tsx`
- Create: `src/components/catalog.tsx`, `src/components/catalog-filters-panel.tsx`
- Modify: `src/app/interaction.css`

**Interfaces:**
- Consumes: `parseFilters`/`serializeFilters`/`CatalogFilters`/`PAGE_SIZE` (Task 4), `CatalogResult` (Task 4), `ProductCard` (Task 5), `GET /api/products`.
- Produces: ruta `/catalogo?...` cuyo estado completo vive en la URL.

- [ ] **Step 1: Página servidor**

`src/app/catalogo/page.tsx`:

```tsx
import { Catalog } from "@/components/catalog";

export const metadata = { title: "Catálogo | Electronorte" };

export default function CatalogPage() {
  return <Catalog />;
}
```

- [ ] **Step 2: Componente cliente del catálogo**

`src/components/catalog.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CatalogFilters, PAGE_SIZE, parseFilters, serializeFilters, SortKey } from "@/lib/catalog-filters";
import type { CatalogResult } from "@/lib/catalog-query";
import { CatalogFiltersPanel } from "./catalog-filters-panel";
import { ProductCard } from "./product-card";

const SORT_LABELS: Record<SortKey, string> = { relevance: "Más relevantes", price_asc: "Menor precio", price_desc: "Mayor precio", newest: "Más nuevos" };
const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function Catalog() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFilters(new URLSearchParams(searchParams.toString()));
  const queryString = serializeFilters(filters).toString();
  const [result, setResult] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/products?${queryString}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No se pudo cargar el catálogo."))))
      .then((data: CatalogResult) => { setResult(data); setError(""); })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [queryString]);

  function update(patch: Partial<CatalogFilters>) {
    const next = { ...filters, page: 1, ...patch };
    const qs = serializeFilters(next).toString();
    router.push(qs ? `/catalogo?${qs}` : "/catalogo", { scroll: false });
  }

  const chips: { label: string; remove: () => void }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, remove: () => update({ q: "" }) });
  if (filters.category) chips.push({ label: filters.category, remove: () => update({ category: "", subCategory: "" }) });
  if (filters.subCategory) chips.push({ label: filters.subCategory, remove: () => update({ subCategory: "" }) });
  filters.brands.forEach((brand) => chips.push({ label: brand, remove: () => update({ brands: filters.brands.filter((b) => b !== brand) }) }));
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const label = `${filters.minPrice !== undefined ? pesos.format(filters.minPrice) : "Desde $0"} – ${filters.maxPrice !== undefined ? pesos.format(filters.maxPrice) : "sin tope"}`;
    chips.push({ label, remove: () => update({ minPrice: undefined, maxPrice: undefined }) });
  }
  if (filters.availableOnly) chips.push({ label: "Solo disponibles", remove: () => update({ availableOnly: false }) });

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return <main className="catalog catalog-page">
    <div className="catalog-mobile-bar">
      <button type="button" onClick={() => setPanelOpen(true)}>Filtros{chips.length ? ` (${chips.length})` : ""}</button>
    </div>
    <CatalogFiltersPanel filters={filters} facets={result?.facets} open={panelOpen} onClose={() => setPanelOpen(false)} onChange={update} />
    <div className="catalog-content">
      <div className="catalog-toolbar">
        <div className="section-head">
          <p>Catálogo</p>
          <h1>{filters.category || "Todos los productos"}</h1>
          <div className="catalog-summary">{result ? <span><strong>{result.total}</strong> producto{result.total === 1 ? "" : "s"}</span> : null}</div>
        </div>
        <label className="catalog-sort">Ordenar por
          <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => <option key={key} value={key}>{SORT_LABELS[key]}</option>)}
          </select>
        </label>
      </div>
      {chips.length > 0 ? <div className="filter-chips">
        {chips.map((chip) => <button type="button" key={chip.label} onClick={chip.remove}>{chip.label} <span aria-hidden>×</span></button>)}
        <button type="button" className="chips-clear" onClick={() => router.push("/catalogo", { scroll: false })}>Limpiar todo</button>
      </div> : null}
      {error ? <p className="error">{error}</p>
        : loading && !result ? <p>Cargando catálogo…</p>
        : result && result.items.length === 0 ? <div className="empty-state">No encontramos productos con esos filtros. Probá quitar alguno.</div>
        : <div className={`product-grid${loading ? " is-loading" : ""}`}>{result?.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {result && result.total > PAGE_SIZE ? <div className="catalog-pagination">
        <button type="button" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>Anterior</button>
        <span>Página {filters.page} de {totalPages}</span>
        <button type="button" disabled={filters.page >= totalPages} onClick={() => update({ page: filters.page + 1 })}>Siguiente</button>
      </div> : null}
    </div>
  </main>;
}
```

`useSearchParams` exige un `Suspense` en el build de producción: envolver `<Catalog />` en `src/app/catalogo/page.tsx` con `<Suspense fallback={<p>Cargando…</p>}>` (importar `Suspense` de `react`).

- [ ] **Step 3: Panel de filtros**

`src/components/catalog-filters-panel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { CatalogFilters } from "@/lib/catalog-filters";
import type { CatalogResult } from "@/lib/catalog-query";

type Props = {
  filters: CatalogFilters;
  facets?: CatalogResult["facets"];
  open: boolean;
  onClose: () => void;
  onChange: (patch: Partial<CatalogFilters>) => void;
};

export function CatalogFiltersPanel({ filters, facets, open, onClose, onChange }: Props) {
  const [min, setMin] = useState(filters.minPrice?.toString() ?? "");
  const [max, setMax] = useState(filters.maxPrice?.toString() ?? "");
  useEffect(() => { setMin(filters.minPrice?.toString() ?? ""); setMax(filters.maxPrice?.toString() ?? ""); }, [filters.minPrice, filters.maxPrice]);

  function applyPrice(event: React.FormEvent) {
    event.preventDefault();
    const toNumber = (v: string) => (v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);
    onChange({ minPrice: toNumber(min), maxPrice: toNumber(max) });
  }

  function toggleBrand(brand: string) {
    onChange({ brands: filters.brands.includes(brand) ? filters.brands.filter((b) => b !== brand) : [...filters.brands, brand] });
  }

  return <aside className={`categories filters-panel${open ? " open" : ""}`} aria-label="Filtros">
    <button type="button" className="filters-close" onClick={onClose}>Cerrar ✕</button>

    <p>Categorías</p>
    {filters.category ? <button type="button" className="facet-back" onClick={() => onChange({ category: "", subCategory: "" })}>← Todas las categorías</button> : null}
    {facets?.categories.filter((c) => !filters.category || c.value === filters.category).map((c) => (
      <button type="button" key={c.value} className={filters.category === c.value ? "selected" : ""} onClick={() => onChange({ category: c.value, subCategory: "" })}>
        {c.value}<span>{c.count}</span>
      </button>
    ))}
    {filters.category ? facets?.subCategories.map((s) => (
      <button type="button" key={s.value} className={`facet-sub${filters.subCategory === s.value ? " selected" : ""}`} onClick={() => onChange({ subCategory: filters.subCategory === s.value ? "" : s.value })}>
        {s.value}<span>{s.count}</span>
      </button>
    )) : null}

    {facets && facets.brands.length > 0 ? <>
      <p>Marca</p>
      {facets.brands.map((b) => (
        <label className="facet-check" key={b.value}>
          <input type="checkbox" checked={filters.brands.includes(b.value)} onChange={() => toggleBrand(b.value)} />
          {b.value}<span>{b.count}</span>
        </label>
      ))}
    </> : null}

    <p>Precio</p>
    <form className="facet-price" onSubmit={applyPrice}>
      <input inputMode="numeric" placeholder={facets ? String(facets.price.min) : "Mínimo"} value={min} onChange={(e) => setMin(e.target.value)} aria-label="Precio mínimo" />
      <input inputMode="numeric" placeholder={facets ? String(facets.price.max) : "Máximo"} value={max} onChange={(e) => setMax(e.target.value)} aria-label="Precio máximo" />
      <button type="submit">Aplicar</button>
    </form>

    <p>Disponibilidad</p>
    <label className="facet-check">
      <input type="checkbox" checked={filters.availableOnly} onChange={(e) => onChange({ availableOnly: e.target.checked })} />
      Solo disponibles
    </label>
  </aside>;
}
```

- [ ] **Step 4: CSS de filtros (agregar a `src/app/interaction.css`)**

```css
.catalog-page{align-items:start}
.filters-panel .facet-sub{padding-left:22px;font-size:13px}
.filters-panel .facet-back{color:var(--brand);font-weight:800;font-size:13px}
.facet-check{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px;cursor:pointer}
.facet-check span,.filters-panel button span{margin-left:auto;color:var(--muted);font-size:12px}
.facet-price{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.facet-price input{width:100%;padding:8px;border:1px solid var(--line);border-radius:var(--radius-sm)}
.facet-price button{grid-column:1/-1;padding:8px;border:0;border-radius:var(--radius-sm);background:var(--brand);color:#fff;font-weight:800;cursor:pointer}
.filter-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.filter-chips button{padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface);cursor:pointer;font-size:13px}
.filter-chips .chips-clear{border-color:transparent;color:var(--brand);font-weight:800;background:none}
.catalog-sort{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.catalog-sort select{padding:8px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface)}
.product-grid.is-loading{opacity:.55;transition:opacity .15s}
.catalog-mobile-bar,.filters-close{display:none}
@media (max-width:860px){
  .catalog-page{grid-template-columns:1fr}
  .catalog-mobile-bar{display:block;margin-bottom:12px}
  .catalog-mobile-bar button{padding:10px 14px;border:1px solid var(--line);border-radius:var(--radius-md);background:var(--surface);font-weight:800}
  .filters-panel{display:none;position:fixed;inset:0;z-index:50;overflow:auto;background:var(--surface);padding:20px}
  .filters-panel.open{display:block}
  .filters-close{display:block;margin-left:auto}
}
```

- [ ] **Step 5: Probar en el navegador**

Con el servidor en marcha y productos cargados: abrir `/catalogo`, elegir una categoría, marcar dos marcas, poner un rango de precio, cambiar el orden y recargar la página (F5). Expected: los filtros se conservan en la URL y tras recargar; los chips muestran cada filtro y la "×" lo quita; "Limpiar todo" vuelve a `/catalogo`; los conteos de marca no desaparecen al marcar una marca.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: página de catálogo con filtros y facetas estilo Mercado Libre"
```

---

### Task 7: Header y home sin carrito

**Files:**
- Modify: `src/components/header.tsx`, `src/components/home-page.tsx`, `src/app/page.tsx`
- Modify: `src/app/promos-bancarias/page.tsx` (solo los links)

**Interfaces:**
- Consumes: `/catalogo` (Task 6), `ProductCard` (Task 5).
- Produces: navegación sin carrito ni login; el buscador del header lleva a `/catalogo?q=`.

- [ ] **Step 1: Header**

En `src/components/header.tsx`: eliminar `useCart`, el tipo `Customer`, el estado `customer` y su `useEffect` (el `fetch("/api/auth/customer/me")`), y reemplazar `submitSearch` y la `<nav>` pública por:

```tsx
const submitSearch = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const value = search.trim();
  router.push(value ? `/catalogo?q=${encodeURIComponent(value)}` : "/catalogo");
};
```

```tsx
<nav>
  <Link href="/catalogo">Productos</Link>
  <Link href="/promos-bancarias">Promos bancarias</Link>
</nav>
```

- [ ] **Step 2: Home**

En `src/components/home-page.tsx`: eliminar el estado y el `useEffect` del catálogo (`products`, `categories`, `catalogTotal`, `catalogPage`, `catalogLoading`, `category`, `query`, `goToCatalog` y el `fetch("/api/products?${params}")`) y la `<section id="catalogo" className="catalog">…</section>` completa; en su lugar poner:

```tsx
<section className="offers">
  <div className="section-head"><p>Catálogo</p><h2>Explorá todos los productos</h2></div>
  <Link href="/catalogo" className="primary-link">Ver catálogo completo</Link>
</section>
```

Cambiar todos los `href="#catalogo"` y `href="/#catalogo"` por `/catalogo`. Los accesos rápidos (`retail-nav`) que llamaban a `goToCatalog(categoria)` pasan a `<Link href={`/catalogo?category=${encodeURIComponent(categoria)}`}>`. Mantener `featuredProducts`, más vendidos y ofertas (siguen usando `/api/products?ids=`).

`src/app/page.tsx` queda: `export default function Page() { return <HomePage />; }` y `HomePage` deja de recibir `initialQuery`.

En `src/app/promos-bancarias/page.tsx` cambiar `href="/#catalogo"` por `href="/catalogo"`.

- [ ] **Step 3: Typecheck y commit**

```bash
npm run typecheck
```

Expected: todavía puede fallar `admin-panel.tsx` (Tasks 8–9). Los archivos de este task no deben tener errores.

```bash
git add -A && git commit -m "feat: header y home sin carrito, navegación hacia /catalogo"
```

---

### Task 8: Admin — productos con dos precios e imagen subida

**Files:**
- Create: `src/lib/uploads.ts`, `src/lib/uploads.test.ts`
- Create: `src/app/api/uploads/[name]/route.ts`
- Create: `src/app/api/admin/products/[id]/images/route.ts`
- Modify (rewrite): `src/app/api/admin/products/route.ts`, `src/app/api/admin/products/[id]/route.ts`
- Create: `src/components/admin/products-tab.tsx`
- Modify: `src/components/admin-panel.tsx`

**Interfaces:**
- Consumes: `productInputSchema`, `withSearchText` (Task 3).
- Produces:
  - `isSafeUploadName(name: string): boolean`; `uploadDir(): string`; `extensionFor(mime: string): string | null`
  - `GET /api/uploads/<name>` (público), `POST /api/admin/products/<id>/images` (multipart, campo `file`), `DELETE /api/admin/products/<id>/images?url=...`
  - `GET /api/admin/products?q=&page=&pageSize=` → `{ items, total, page, pageSize }`; `POST`/`PATCH` con `productInputSchema`.

- [ ] **Step 1: Tests de seguridad de nombres de archivo**

`src/lib/uploads.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extensionFor, isSafeUploadName } from "./uploads";

describe("isSafeUploadName", () => {
  it("acepta nombres generados", () => {
    expect(isSafeUploadName("65f0c2a1b2c3d4e5f6a7b8c9-1730000000000.jpg")).toBe(true);
  });
  it("rechaza recorridos de carpeta", () => {
    expect(isSafeUploadName("../.env.local")).toBe(false);
    expect(isSafeUploadName("..%2F.env")).toBe(false);
    expect(isSafeUploadName("a/b.jpg")).toBe(false);
  });
  it("rechaza extensiones no permitidas", () => {
    expect(isSafeUploadName("x-1.html")).toBe(false);
  });
});

describe("extensionFor", () => {
  it("solo imágenes comunes", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("text/html")).toBeNull();
  });
});
```

Run: `npx vitest run src/lib/uploads.test.ts` → FAIL.

- [ ] **Step 2: Implementar `uploads.ts`**

```ts
import path from "path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const extensionFor = (mime: string): string | null => EXT[mime] ?? null;
export const isSafeUploadName = (name: string): boolean => /^[a-f0-9]{24}-\d{10,16}\.(jpg|png|webp)$/.test(name);
export const uploadDir = (): string => path.resolve(process.env.UPLOAD_DIR || "./uploads");
```

Run: `npx vitest run src/lib/uploads.test.ts` → PASS.

- [ ] **Step 3: Servir imágenes subidas**

`src/app/api/uploads/[name]/route.ts`:

```ts
import { readFile } from "fs/promises";
import path from "path";
import { isSafeUploadName, uploadDir } from "@/lib/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!isSafeUploadName(name)) return new Response("No encontrado", { status: 404 });
  try {
    const file = await readFile(path.join(uploadDir(), name));
    return new Response(file, { headers: { "Content-Type": TYPES[name.split(".").pop()!], "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
```

- [ ] **Step 4: Subir y quitar imágenes**

`src/app/api/admin/products/[id]/images/route.ts`:

```ts
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { extensionFor, isSafeUploadName, MAX_UPLOAD_BYTES, uploadDir } from "@/lib/uploads";
import { ProductModel } from "@/models/Product";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  const ext = extensionFor(file.type);
  if (!ext) return NextResponse.json({ error: "Formato no permitido. Usá JPG, PNG o WebP." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "La imagen supera los 5 MB." }, { status: 400 });
  await connectDb();
  const product = await ProductModel.findById(id);
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  const name = `${id}-${Date.now()}.${ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), Buffer.from(await file.arrayBuffer()));
  const url = `/api/uploads/${name}`;
  product.images = [...(product.images ?? []), url];
  product.image = product.images[0];
  await product.save();
  return NextResponse.json({ url, images: product.images }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const { id } = await params;
  const url = new URL(request.url).searchParams.get("url") ?? "";
  await connectDb();
  const product = await ProductModel.findById(id);
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  product.images = (product.images ?? []).filter((item: string) => item !== url);
  product.image = product.images[0] ?? "";
  await product.save();
  const name = url.replace("/api/uploads/", "");
  if (url.startsWith("/api/uploads/") && isSafeUploadName(name)) await unlink(path.join(uploadDir(), name)).catch(() => undefined);
  return NextResponse.json({ images: product.images });
}
```

- [ ] **Step 5: Rutas admin de productos (listar paginado, crear, editar, desactivar)**

`src/app/api/admin/products/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { buildMatch, parseFilters } from "@/lib/catalog-filters";
import { toPublicProduct } from "@/lib/catalog-query";
import { connectDb } from "@/lib/db";
import { productInputSchema, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";

const ADMIN_PAGE_SIZE = 25;

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);
  const match = buildMatch({ ...filters, category: "", subCategory: "", brands: [], minPrice: undefined, maxPrice: undefined, availableOnly: false });
  const limit = Math.min(30, Math.max(1, Number(searchParams.get("limit")) || ADMIN_PAGE_SIZE));
  const [rows, total] = await Promise.all([
    ProductModel.find(match).sort({ createdAt: -1, _id: 1 }).skip((filters.page - 1) * limit).limit(limit).lean(),
    ProductModel.countDocuments(match)
  ]);
  return NextResponse.json({ items: rows.map((r) => ({ ...toPublicProduct(r as unknown as Record<string, unknown>), active: r.active })), total, page: filters.page, pageSize: limit });
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = productInputSchema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: data.error.issues[0]?.message ?? "Datos de producto inválidos" }, { status: 400 });
  await connectDb();
  try {
    const product = await ProductModel.create(withSearchText(data.data));
    return NextResponse.json({ id: String(product._id) }, { status: 201 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Ya existe un artículo con ese SKU" }, { status: 409 });
    throw error;
  }
}
```

`src/app/api/admin/products/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { productInputSchema, withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  const data = productInputSchema.safeParse(await request.json());
  if (!data.success) return NextResponse.json({ error: data.error.issues[0]?.message ?? "Datos de producto inválidos" }, { status: 400 });
  await connectDb();
  const { id } = await params;
  try {
    const product = await ProductModel.findByIdAndUpdate(id, withSearchText(data.data), { new: true });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Ya existe un artículo con ese SKU" }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ id });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const { id } = await params;
  await ProductModel.findByIdAndUpdate(id, { active: false });
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 6: Pestaña "Productos" del admin**

Crear `src/components/admin/products-tab.tsx` con: buscador (`q`) y paginación contra `GET /api/admin/products`; tabla con SKU, nombre, categoría, precio efectivo, precio contado, disponible; botón "Editar" que abre el formulario (campos `sku`, `name`, `description`, `category`, `subCategory`, `brand`, `cashPrice`, `listPrice`, `available`, `outlet`, `features` separadas por coma), y dentro del formulario de un artículo ya guardado, una sección "Imágenes" con las miniaturas (`images`), un botón "×" por imagen que llama a `DELETE /api/admin/products/<id>/images?url=...` y un `<input type="file" accept="image/jpeg,image/png,image/webp">` que sube con `fetch(`/api/admin/products/${id}/images`, { method: "POST", body: formData })`. Guardar usa `POST /api/admin/products` (nuevo) o `PATCH /api/admin/products/<id>` (edición); "Desactivar" usa `DELETE`. Reutilizar las clases CSS de `admin.css` del formulario actual (`admin-form`, `admin-table`, etc.: revisar las que usa hoy la pestaña "products" en `admin-panel.tsx:535-612`).

En `src/components/admin-panel.tsx`: reemplazar el bloque `{tab === "products" && (…)}` por `{tab === "products" && <ProductsTab />}`; eliminar `orders`, `updateOrder`, la pestaña "orders" y "summary", el filtro de pedidos, `syncContabilium` y su botón, y el `fetch("/api/orders")` de la carga inicial; dejar `home`, `categories`, `products` y la nueva `settings` (Task 9). El tipo `Tab` pasa a `"products" | "import" | "settings" | "home" | "categories"` y la pestaña inicial a `"products"`.

- [ ] **Step 7: Verificar a mano y commit**

Entrar a `/admin`, crear un artículo con dos precios, subir una imagen, verla en `/catalogo`, quitarla, desactivar el artículo. Expected: cada paso funciona y las imágenes se guardan en `./uploads/`.

```bash
npm run typecheck && npm test
git add -A && git commit -m "feat: admin de productos con dos precios y carga de imágenes"
```

---

### Task 9: Admin — WhatsApp y fechas BBVA

**Files:**
- Create: `src/components/admin/settings-tab.tsx`
- Modify: `src/components/admin-panel.tsx`

**Interfaces:**
- Consumes: `GET`/`PUT /api/admin/settings` (Task 2).

- [ ] **Step 1: Pestaña de ajustes**

`src/components/admin/settings-tab.tsx`:

```tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import { DEFAULT_TEMPLATE } from "@/lib/whatsapp";

export function SettingsTab() {
  const [phone, setPhone] = useState("");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [dates, setDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : null)).then((s) => {
      if (!s) return;
      setPhone(s.whatsappPhone); setTemplate(s.whatsappTemplate || DEFAULT_TEMPLATE); setDates(s.bbvaDates);
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappPhone: phone, whatsappTemplate: template, bbvaDates: dates })
    });
    setMessage(response.ok ? "Guardado." : "No se pudo guardar. Revisá los datos.");
  }

  function addDate() {
    if (newDate && !dates.includes(newDate)) setDates([...dates, newDate].sort());
    setNewDate("");
  }

  return <form className="admin-form" onSubmit={save}>
    <h2>WhatsApp</h2>
    <label>Número (con código de país, ej. 5491154560043)
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5491154560043" />
    </label>
    <label>Mensaje (usá {"{nombre}"}, {"{sku}"} y {"{link}"})
      <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={3} />
    </label>

    <h2>Días de 6 cuotas con BBVA</h2>
    <p className="form-message">Cargá la fecha cada mes. Ese día se muestra la promo en todo el catálogo.</p>
    <div>
      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
      <button type="button" onClick={addDate}>Agregar fecha</button>
    </div>
    <ul>
      {dates.map((d) => <li key={d}>{d} <button type="button" onClick={() => setDates(dates.filter((x) => x !== d))}>Quitar</button></li>)}
    </ul>

    <button type="submit">Guardar</button>
    {message ? <p className="form-message">{message}</p> : null}
  </form>;
}
```

- [ ] **Step 2: Conectar en el panel**

En `admin-panel.tsx`: importar `SettingsTab` y agregar `{tab === "settings" && <SettingsTab />}`; en la lista de pestañas agregar `"settings"` con la etiqueta "WhatsApp y promos".

- [ ] **Step 3: Verificar a mano y commit**

En `/admin` → "WhatsApp y promos": guardar un número y una fecha BBVA que sea hoy. Expected: en `/catalogo` aparece "6 cuotas con BBVA de $…" en las tarjetas y el botón de WhatsApp abre `wa.me/<número>` con el mensaje armado.

```bash
git add -A && git commit -m "feat: ajustes de WhatsApp y fechas BBVA en el admin"
```

---

### Task 10: Importación masiva (parseo, validación y plan)

**Files:**
- Create: `src/lib/import/columns.ts`, `src/lib/import/parse-rows.ts`, `src/lib/import/parse-rows.test.ts`, `src/lib/import/read-file.ts`
- Create: `src/lib/import/plan.ts`, `src/lib/import/plan.test.ts`

**Interfaces:**
- Consumes: `normalizeText` (Task 3).
- Produces:
  - `HEADER_ALIASES: Record<string, ColumnKey>`; `type ColumnKey = "sku" | "name" | "description" | "category" | "subCategory" | "brand" | "cashPrice" | "listPrice" | "available" | "features" | "outlet" | "active"`
  - `parsePrice(value: unknown): number | null`
  - `type RawRow = { rowNumber: number; cells: Partial<Record<ColumnKey, unknown>> }`
  - `readImportFile(buffer: Buffer, filename: string): Promise<{ rows: RawRow[]; columns: ColumnKey[] }>`
  - `type ImportRow = { rowNumber: number; sku: string; data: Partial<ProductFields> }`, `type RowError = { rowNumber: number; message: string }`
  - `parseRows(rows: RawRow[]): { valid: ImportRow[]; errors: RowError[] }`
  - `planImport(valid: ImportRow[], existingSkus: Set<string>): { toCreate: ImportRow[]; toUpdate: ImportRow[]; errors: RowError[] }`

- [ ] **Step 1: Columnas y alias**

`src/lib/import/columns.ts`:

```ts
import { normalizeText } from "@/lib/text";

export type ColumnKey = "sku" | "name" | "description" | "category" | "subCategory" | "brand" | "cashPrice" | "listPrice" | "available" | "features" | "outlet" | "active";

const ALIASES: Record<ColumnKey, string[]> = {
  sku: ["sku", "codigo", "cod", "codigo sku"],
  name: ["nombre", "articulo", "producto", "name"],
  description: ["descripcion", "description"],
  category: ["categoria", "rubro", "category"],
  subCategory: ["subcategoria", "subrubro", "sub categoria"],
  brand: ["marca", "brand"],
  cashPrice: ["precio efectivo", "efectivo", "precio_efectivo"],
  listPrice: ["precio contado", "contado", "precio lista", "precio_contado", "precio"],
  available: ["disponible", "disponibilidad"],
  features: ["caracteristicas", "features"],
  outlet: ["outlet"],
  active: ["activo", "active"]
};

export const HEADER_ALIASES: Record<string, ColumnKey> = Object.fromEntries(
  (Object.entries(ALIASES) as [ColumnKey, string[]][]).flatMap(([key, names]) => names.map((n) => [normalizeText(n).replace(/_/g, " "), key]))
);

export function columnForHeader(header: string): ColumnKey | undefined {
  return HEADER_ALIASES[normalizeText(header).replace(/_/g, " ")];
}
```

- [ ] **Step 2: Tests de parseo y validación**

`src/lib/import/parse-rows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { columnForHeader } from "./columns";
import { parsePrice, parseRows } from "./parse-rows";

describe("columnForHeader", () => {
  it("reconoce encabezados con mayúsculas, tildes y espacios", () => {
    expect(columnForHeader("Precio Efectivo")).toBe("cashPrice");
    expect(columnForHeader("DESCRIPCIÓN")).toBe("description");
    expect(columnForHeader("precio_contado")).toBe("listPrice");
    expect(columnForHeader("columna rara")).toBeUndefined();
  });
});

describe("parsePrice", () => {
  it("números y texto con formato argentino", () => {
    expect(parsePrice(1234.5)).toBe(1234.5);
    expect(parsePrice("1234")).toBe(1234);
    expect(parsePrice("$ 1.234")).toBe(1234);
    expect(parsePrice("1.234,50")).toBe(1234.5);
    expect(parsePrice("1234,5")).toBe(1234.5);
  });
  it("inválidos devuelven null", () => {
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("1.2.3")).toBeNull();
  });
});

describe("parseRows", () => {
  it("fila válida completa", () => {
    const { valid, errors } = parseRows([{ rowNumber: 2, cells: { sku: " A1 ", name: "Heladera", category: "Heladeras", cashPrice: "100", listPrice: "120", available: "sí" } }]);
    expect(errors).toEqual([]);
    expect(valid[0]).toEqual({ rowNumber: 2, sku: "A1", data: { name: "Heladera", category: "Heladeras", cashPrice: 100, listPrice: 120, available: true } });
  });
  it("celdas vacías no se incluyen (no borran datos)", () => {
    const { valid } = parseRows([{ rowNumber: 2, cells: { sku: "A1", name: "", brand: "  ", cashPrice: "" } }]);
    expect(valid[0].data).toEqual({});
  });
  it("sin SKU es error", () => {
    const { errors } = parseRows([{ rowNumber: 5, cells: { name: "X" } }]);
    expect(errors).toEqual([{ rowNumber: 5, message: "Falta el SKU" }]);
  });
  it("SKU repetido en el archivo: la segunda fila es error", () => {
    const { valid, errors } = parseRows([
      { rowNumber: 2, cells: { sku: "A1", name: "Uno" } },
      { rowNumber: 3, cells: { sku: "a1 ", name: "Dos" } }
    ]);
    expect(valid).toHaveLength(1);
    expect(errors).toEqual([{ rowNumber: 3, message: "SKU repetido en el archivo (ya aparece en la fila 2)" }]);
  });
  it("precio inválido es error con el nombre de la columna", () => {
    const { errors } = parseRows([{ rowNumber: 4, cells: { sku: "A1", cashPrice: "abc" } }]);
    expect(errors).toEqual([{ rowNumber: 4, message: "Precio efectivo inválido: \"abc\"" }]);
  });
  it("disponible y outlet aceptan sí/no, 1/0, true/false", () => {
    const { valid } = parseRows([{ rowNumber: 2, cells: { sku: "A", available: "NO", outlet: 1, active: "false" } }]);
    expect(valid[0].data).toEqual({ available: false, outlet: true, active: false });
  });
  it("características separadas por | o ;", () => {
    const { valid } = parseRows([{ rowNumber: 2, cells: { sku: "A", features: "No Frost | 340L; Inverter" } }]);
    expect(valid[0].data.features).toEqual(["No Frost", "340L", "Inverter"]);
  });
});
```

Run: `npx vitest run src/lib/import/parse-rows.test.ts` → FAIL.

- [ ] **Step 3: Implementar `parse-rows.ts`**

```ts
import type { ColumnKey } from "./columns";

export type RawRow = { rowNumber: number; cells: Partial<Record<ColumnKey, unknown>> };
export type ProductFields = {
  name: string; description: string; category: string; subCategory: string; brand: string;
  cashPrice: number; listPrice: number; available: boolean; features: string[]; outlet: boolean; active: boolean;
};
export type ImportRow = { rowNumber: number; sku: string; data: Partial<ProductFields> };
export type RowError = { rowNumber: number; message: string };

const isBlank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  let text = String(value ?? "").replace(/[$\s]/g, "");
  if (!/^\d+([.,]\d+)*$/.test(text)) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if ((text.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(text)) text = text.replace(/\./g, "");
  if ((text.match(/\./g) ?? []).length > 1) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const t = String(value).trim().toLowerCase();
  if (["si", "sí", "s", "1", "true", "yes", "x"].includes(t)) return true;
  if (["no", "n", "0", "false"].includes(t)) return false;
  return null;
}

const TEXT_FIELDS = [["name", "Nombre"], ["description", "Descripción"], ["category", "Categoría"], ["subCategory", "Subcategoría"], ["brand", "Marca"]] as const;
const PRICE_FIELDS = [["cashPrice", "Precio efectivo"], ["listPrice", "Precio contado"]] as const;
const BOOL_FIELDS = [["available", "Disponible"], ["outlet", "Outlet"], ["active", "Activo"]] as const;

export function parseRows(rows: RawRow[]): { valid: ImportRow[]; errors: RowError[] } {
  const valid: ImportRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  for (const { rowNumber, cells } of rows) {
    const sku = String(cells.sku ?? "").trim();
    if (!sku) { errors.push({ rowNumber, message: "Falta el SKU" }); continue; }
    const key = sku.toLowerCase();
    if (seen.has(key)) { errors.push({ rowNumber, message: `SKU repetido en el archivo (ya aparece en la fila ${seen.get(key)})` }); continue; }
    const data: Partial<ProductFields> = {};
    let problem = "";
    for (const [field, label] of TEXT_FIELDS) if (!isBlank(cells[field])) data[field] = String(cells[field]).trim();
    for (const [field, label] of PRICE_FIELDS) {
      if (isBlank(cells[field])) continue;
      const price = parsePrice(cells[field]);
      if (price === null) { problem = `${label} inválido: "${String(cells[field]).trim()}"`; break; }
      data[field] = price;
    }
    if (!problem) for (const [field, label] of BOOL_FIELDS) {
      if (isBlank(cells[field])) continue;
      const flag = parseBool(cells[field]);
      if (flag === null) { problem = `${label} inválido: "${String(cells[field]).trim()}" (usá sí/no)`; break; }
      data[field] = flag;
    }
    if (!problem && !isBlank(cells.features)) data.features = String(cells.features).split(/[|;]/).map((f) => f.trim()).filter(Boolean).slice(0, 8);
    if (problem) { errors.push({ rowNumber, message: problem }); continue; }
    seen.set(key, rowNumber);
    valid.push({ rowNumber, sku, data });
  }
  return { valid, errors };
}
```

Nota: una celda de `disponible` con un número distinto de 0/1 se informa como error de esa fila. La columna "stock" no se importa (el catálogo no maneja cantidades).

Run: `npx vitest run src/lib/import/parse-rows.test.ts` → PASS.

- [ ] **Step 4: Tests del plan (crear vs. actualizar)**

`src/lib/import/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planImport } from "./plan";
import type { ImportRow } from "./parse-rows";

const full = { name: "Heladera", category: "Heladeras", cashPrice: 100, listPrice: 120 };
const row = (rowNumber: number, sku: string, data: ImportRow["data"]): ImportRow => ({ rowNumber, sku, data });

describe("planImport", () => {
  it("SKU existente se actualiza aunque venga incompleto", () => {
    const plan = planImport([row(2, "A1", { cashPrice: 90 })], new Set(["A1"]));
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toCreate).toHaveLength(0);
  });
  it("SKU nuevo con todos los campos obligatorios se crea", () => {
    expect(planImport([row(2, "B1", full)], new Set()).toCreate).toHaveLength(1);
  });
  it("SKU nuevo incompleto es error y dice qué falta", () => {
    const plan = planImport([row(3, "B2", { name: "X" })], new Set());
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.errors).toEqual([{ rowNumber: 3, message: "Artículo nuevo: faltan Categoría, Precio efectivo, Precio contado" }]);
  });
  it("la comparación de SKU no distingue mayúsculas", () => {
    expect(planImport([row(2, "a1", { cashPrice: 1 })], new Set(["A1"])).toUpdate).toHaveLength(1);
  });
});
```

Run: `npx vitest run src/lib/import/plan.test.ts` → FAIL.

- [ ] **Step 5: Implementar `plan.ts`**

```ts
import type { ImportRow, RowError } from "./parse-rows";

const REQUIRED: [keyof ImportRow["data"], string][] = [["name", "Nombre"], ["category", "Categoría"], ["cashPrice", "Precio efectivo"], ["listPrice", "Precio contado"]];

export function planImport(valid: ImportRow[], existingSkus: Set<string>): { toCreate: ImportRow[]; toUpdate: ImportRow[]; errors: RowError[] } {
  const existing = new Set([...existingSkus].map((s) => s.toLowerCase()));
  const toCreate: ImportRow[] = [], toUpdate: ImportRow[] = [], errors: RowError[] = [];
  for (const item of valid) {
    if (existing.has(item.sku.toLowerCase())) { toUpdate.push(item); continue; }
    const missing = REQUIRED.filter(([field]) => item.data[field] === undefined).map(([, label]) => label);
    if (missing.length > 0) errors.push({ rowNumber: item.rowNumber, message: `Artículo nuevo: faltan ${missing.join(", ")}` });
    else toCreate.push(item);
  }
  return { toCreate, toUpdate, errors };
}
```

Run: `npx vitest run src/lib/import/plan.test.ts` → PASS.

- [ ] **Step 6: Lector de archivos xlsx/csv**

`src/lib/import/read-file.ts`:

```ts
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { ColumnKey, columnForHeader } from "./columns";
import type { RawRow } from "./parse-rows";

export const MAX_IMPORT_ROWS = 10_000;

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if (value instanceof Date) return value.toISOString();
  }
  return value;
}

export async function readImportFile(buffer: Buffer, filename: string): Promise<{ rows: RawRow[]; columns: ColumnKey[] }> {
  const workbook = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) await workbook.csv.read(Readable.from(buffer));
  else await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");
  const columnByIndex = new Map<number, ColumnKey>();
  sheet.getRow(1).eachCell((cell, index) => {
    const key = columnForHeader(String(cellValue(cell.value) ?? ""));
    if (key) columnByIndex.set(index, key);
  });
  if (!([...columnByIndex.values()].includes("sku"))) throw new Error("No se encontró la columna SKU en la primera fila.");
  if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) throw new Error(`El archivo supera las ${MAX_IMPORT_ROWS} filas.`);
  const rows: RawRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: RawRow["cells"] = {};
    columnByIndex.forEach((key, index) => { cells[key] = cellValue(row.getCell(index).value); });
    if (Object.values(cells).some((v) => v !== null && v !== undefined && String(v).trim() !== "")) rows.push({ rowNumber, cells });
  });
  return { rows, columns: [...new Set(columnByIndex.values())] };
}
```

- [ ] **Step 7: Commit**

```bash
npm test && git add -A && git commit -m "feat: lectura, validación y plan de importación masiva"
```

---

### Task 11: API y pantalla de importación/exportación

**Files:**
- Create: `src/lib/import/apply.ts`
- Create: `src/app/api/admin/import/route.ts`, `src/app/api/admin/export/route.ts`
- Create: `src/components/admin/import-tab.tsx`
- Modify: `src/components/admin-panel.tsx`

**Interfaces:**
- Consumes: `readImportFile`, `parseRows`, `planImport` (Task 10), `withSearchText` (Task 3), `ProductModel`.
- Produces:
  - `applyImport(plan: { toCreate: ImportRow[]; toUpdate: ImportRow[] }): Promise<{ created: number; updated: number }>`
  - `POST /api/admin/import` (multipart: `file`, `mode` = `preview` | `apply`) → `{ created, updated, errors: RowError[], ignoredColumns: boolean }`
  - `GET /api/admin/export?format=xlsx|csv` → archivo descargable con las mismas columnas que acepta la importación.

- [ ] **Step 1: Aplicar la importación por lotes**

`src/lib/import/apply.ts`:

```ts
import { withSearchText } from "@/lib/product-schema";
import { ProductModel } from "@/models/Product";
import type { ImportRow } from "./parse-rows";

const BATCH = 500;

export async function applyImport(plan: { toCreate: ImportRow[]; toUpdate: ImportRow[] }) {
  const existing = await ProductModel.find({ sku: { $in: plan.toUpdate.map((r) => r.sku) } }, "sku name brand category subCategory").lean();
  const current = new Map(existing.map((p) => [String(p.sku).toLowerCase(), p]));
  const ops: object[] = [];
  for (const item of plan.toCreate) {
    ops.push({ insertOne: { document: withSearchText({ sku: item.sku, ...item.data }) } });
  }
  for (const item of plan.toUpdate) {
    const before = current.get(item.sku.toLowerCase());
    const merged = { sku: before?.sku ?? item.sku, name: before?.name, brand: before?.brand, category: before?.category, subCategory: before?.subCategory, ...item.data };
    ops.push({ updateOne: { filter: { sku: before?.sku ?? item.sku }, update: { $set: { ...item.data, searchText: withSearchText(merged).searchText } } } });
  }
  for (let i = 0; i < ops.length; i += BATCH) await ProductModel.bulkWrite(ops.slice(i, i + BATCH) as never, { ordered: false });
  return { created: plan.toCreate.length, updated: plan.toUpdate.length };
}
```

El `searchText` se recalcula con los valores actuales del artículo combinados con los del archivo, así la búsqueda sigue acertando tras una modificación masiva. Un SKU que difiere solo en mayúsculas del existente usa el SKU original para no crear un duplicado.

- [ ] **Step 2: Ruta de importación (vista previa y aplicar)**

`src/app/api/admin/import/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { applyImport } from "@/lib/import/apply";
import { parseRows } from "@/lib/import/parse-rows";
import { planImport } from "@/lib/import/plan";
import { readImportFile } from "@/lib/import/read-file";
import { ProductModel } from "@/models/Product";

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode") === "apply" ? "apply" : "preview";
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "El archivo supera los 10 MB." }, { status: 400 });
  let parsed;
  try {
    parsed = await readImportFile(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el archivo." }, { status: 400 });
  }
  const { valid, errors: rowErrors } = parseRows(parsed.rows);
  await connectDb();
  const existing = await ProductModel.find({ sku: { $in: valid.map((r) => r.sku) } }, "sku").lean();
  const plan = planImport(valid, new Set(existing.map((p) => String(p.sku))));
  const errors = [...rowErrors, ...plan.errors].sort((a, b) => a.rowNumber - b.rowNumber);
  const counts = mode === "apply" ? await applyImport(plan) : { created: plan.toCreate.length, updated: plan.toUpdate.length };
  return NextResponse.json({ mode, ...counts, errors, columns: parsed.columns });
}
```

- [ ] **Step 3: Exportar**

`src/app/api/admin/export/route.ts`:

```ts
import ExcelJS from "exceljs";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { ProductModel } from "@/models/Product";

const COLUMNS = [
  ["SKU", "sku"], ["Nombre", "name"], ["Descripción", "description"], ["Categoría", "category"], ["Subcategoría", "subCategory"],
  ["Marca", "brand"], ["Precio efectivo", "cashPrice"], ["Precio contado", "listPrice"], ["Disponible", "available"],
  ["Características", "features"], ["Outlet", "outlet"], ["Activo", "active"]
] as const;

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const products = await ProductModel.find({}).sort({ sku: 1 }).lean();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Catálogo");
  sheet.columns = COLUMNS.map(([header]) => ({ header, width: header === "Descripción" ? 50 : 18 }));
  for (const p of products) {
    sheet.addRow(COLUMNS.map(([, key]) => {
      const value = (p as Record<string, unknown>)[key];
      if (typeof value === "boolean") return value ? "sí" : "no";
      if (Array.isArray(value)) return value.join(" | ");
      return value ?? "";
    }));
  }
  const csv = new URL(request.url).searchParams.get("format") === "csv";
  const body = csv ? await workbook.csv.writeBuffer() : await workbook.xlsx.writeBuffer();
  return new Response(body as ArrayBuffer, {
    headers: {
      "Content-Type": csv ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="catalogo.${csv ? "csv" : "xlsx"}"`
    }
  });
}
```

- [ ] **Step 4: Pantalla "Importar"**

`src/components/admin/import-tab.tsx`:

```tsx
"use client";

import { useState } from "react";

type Result = { mode: "preview" | "apply"; created: number; updated: number; errors: { rowNumber: number; message: string }[]; columns: string[] };

export function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(mode: "preview" | "apply") {
    if (!file) return;
    setBusy(true); setError("");
    const form = new FormData();
    form.set("file", file); form.set("mode", mode);
    const response = await fetch("/api/admin/import", { method: "POST", body: form });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "No se pudo procesar el archivo."); return; }
    setResult(body);
    if (mode === "apply") setFile(null);
  }

  return <div className="admin-form">
    <h2>Importar artículos</h2>
    <p className="form-message">
      Subí un Excel (.xlsx) o CSV. La primera fila son los encabezados: SKU, Nombre, Descripción, Categoría, Subcategoría, Marca, Precio efectivo, Precio contado, Disponible, Características, Outlet, Activo.
      Si el SKU ya existe se actualiza (solo las celdas con valor); si no, se crea. Las imágenes se cargan desde cada artículo.
    </p>
    <input type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
    <button type="button" disabled={!file || busy} onClick={() => send("preview")}>Ver vista previa</button>
    <a className="primary-link" href="/api/admin/export?format=xlsx">Descargar catálogo actual (Excel)</a>
    {error ? <p className="error">{error}</p> : null}
    {result ? <div>
      <p><strong>{result.mode === "apply" ? "Importación terminada" : "Vista previa"}:</strong> {result.created} nuevos, {result.updated} a modificar, {result.errors.length} con error.</p>
      {result.errors.length > 0 ? <ul>{result.errors.slice(0, 200).map((e) => <li key={`${e.rowNumber}-${e.message}`}>Fila {e.rowNumber}: {e.message}</li>)}</ul> : null}
      {result.mode === "preview" && result.created + result.updated > 0 ? <button type="button" disabled={busy} onClick={() => send("apply")}>Confirmar e importar {result.created + result.updated} artículos</button> : null}
    </div> : null}
  </div>;
}
```

En `admin-panel.tsx`: importar `ImportTab`, agregar `{tab === "import" && <ImportTab />}` y la pestaña "Importar / Exportar".

- [ ] **Step 5: Prueba con un archivo real de ~3.000 filas**

Generar un CSV de prueba y probar el flujo completo:

```bash
python3 - <<'PY' > /tmp/claude-1000/-home-mati-Escritorio-Proyectos-electronorte-eccomerce--1--eccomerce/5bc49335-1d9e-4a02-afa2-8059563e2946/scratchpad/prueba.csv
import random
cats = ["Heladeras", "Lavarropas", "Televisores", "Aires acondicionados", "Cocinas"]
brands = ["Samsung", "LG", "Philips", "Whirlpool", "Drean"]
print("SKU,Nombre,Categoría,Marca,Precio efectivo,Precio contado,Disponible")
for i in range(1, 3001):
    p = random.randint(100, 900) * 1000
    print(f"ART-{i:05d},Artículo de prueba {i},{random.choice(cats)},{random.choice(brands)},{p},{int(p*1.1)},sí")
PY
```

En `/admin` → Importar: subir ese archivo, ver la vista previa (esperado: 3000 nuevos, 0 errores), confirmar, y comprobar en `/catalogo` los conteos de facetas y la paginación. Luego editar 3 precios en una copia del archivo y reimportarlo: esperado `0 nuevos, 3000 a modificar` y sin duplicados (`db.products.countDocuments()` sigue en 3000). Limpiar después: desde `mongosh` borrar los artículos `ART-*`.

- [ ] **Step 6: Commit**

```bash
npm run typecheck && npm test
git add -A && git commit -m "feat: importación y exportación masiva con vista previa"
```

---

### Task 12: Cierre — Docker, README y verificación completa

**Files:**
- Modify: `Dockerfile`, `docker-compose.yml`, `README.md`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Persistir imágenes subidas en Docker**

En `Dockerfile`, antes de `USER app`: `RUN mkdir -p /data/uploads && chown app:app /data/uploads` y `ENV UPLOAD_DIR=/data/uploads`. En `docker-compose.yml`, servicio `web`: `volumes: ["uploads_data:/data/uploads"]`, y bajo `volumes:` raíz agregar `uploads_data:`. Cambiar `MONGODB_URI` del servicio `web` a `mongodb://mongo:27017/catalogo_electronorte`.

- [ ] **Step 2: README**

Reemplazar `README.md` con: qué es el proyecto (catálogo con WhatsApp), cómo levantarlo en Linux (`docker start electronorte-mongo` o `docker run -d -p 27017:27017 mongo:8`, `npm install`, `npm run dev`), variables de entorno (`.env.example`), el formato del archivo de importación (columnas y reglas: SKU como clave, celdas vacías no borran, columnas ausentes no se tocan), cómo cargar imágenes, cómo configurar WhatsApp y fechas BBVA, y que carrito/pedidos/clientes están en `src/_disabled/` para reactivarlos.

- [ ] **Step 3: Verificación completa**

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck sin errores, todos los tests en PASS, build exitoso (incluye la ruta `/catalogo` con `Suspense`).

- [ ] **Step 4: Recorrido manual de punta a punta**

Con `npm run dev`: (1) importar el CSV de prueba; (2) en `/catalogo` filtrar por categoría + dos marcas + rango de precio, cambiar orden, recargar y confirmar que la URL conserva el estado; (3) buscar `heladera` y `HELADERA`; (4) abrir un artículo y usar "Consultar por WhatsApp" — debe abrir `wa.me` con nombre, SKU y link; (5) cargar la fecha de hoy como día BBVA y ver "6 cuotas con BBVA" en las tarjetas; (6) subir una imagen a un artículo; (7) probar `/checkout`, `/account` y `/api/orders` → deben dar 404; (8) probar `http://localhost:3000/api/uploads/..%2F.env.local` → 404.

- [ ] **Step 5: Commit final**

```bash
git add -A && git commit -m "docs: README, Docker con volumen de imágenes y verificación final"
```

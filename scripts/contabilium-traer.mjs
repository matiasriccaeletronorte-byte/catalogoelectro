// Trae los artículos de Contabilium (solo lectura, GET) y los guarda en datos-contabilium/.
// Las credenciales se leen de .env.local: CONTABILIUM_EMAIL y CONTABILIUM_API_KEY. No se imprimen nunca.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const BASE = (process.env.CONTABILIUM_BASE_URL || "https://rest.contabilium.com").replace(/\/$/, "");
const PAGE_SIZE = 50;
const MAX_PAGES = 400; // tope de seguridad: 20.000 artículos
const PAUSE_MS = 600; // la API admite unas 25 consultas cada 10 s; vamos bastante por debajo
const OUT = "datos-contabilium";
const IMAGE_KEY = /imagen|imagenes|foto|fotos|image|images|img|picture|thumbnail/i;

async function loadEnv() {
  try {
    const text = await readFile(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* sin .env.local: se usan las variables del entorno */ }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getToken(email, apiKey) {
  const response = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: email, client_secret: apiKey })
  });
  if (response.status === 400 || response.status === 401) throw new Error("Contabilium rechazó el email o la API Key (revisá que estén bien copiados en .env.local).");
  if (response.status === 403) throw new Error("Contabilium respondió 403: la cuenta no tiene plan con acceso a la API, o el pedido fue bloqueado.");
  if (!response.ok) throw new Error(`No se pudo obtener el token (HTTP ${response.status}).`);
  const data = await response.json();
  if (!data.access_token) throw new Error("La respuesta de Contabilium no trajo token.");
  return data.access_token;
}

async function get(path, token, params = {}, attempt = 1) {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (response.status === 429 && attempt <= 4) { await sleep(3000 * attempt); return get(path, token, params, attempt + 1); }
  if (!response.ok) throw new Error(`GET ${path} respondió HTTP ${response.status}.`);
  return response.json();
}

const itemsOf = (body) => {
  if (Array.isArray(body)) return body;
  const items = body?.Items ?? body?.items;
  if (Array.isArray(items)) return items;
  return items ? [items] : [];
};

/** Saca los campos de imágenes, en cualquier nivel. */
function withoutImages(value) {
  if (Array.isArray(value)) return value.map(withoutImages);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !IMAGE_KEY.test(key)).map(([key, inner]) => [key, withoutImages(inner)]));
  }
  return value;
}

async function main() {
  await loadEnv();
  const email = process.env.CONTABILIUM_EMAIL;
  const apiKey = process.env.CONTABILIUM_API_KEY;
  if (!email || !apiKey) {
    console.error("Faltan CONTABILIUM_EMAIL y/o CONTABILIUM_API_KEY en .env.local.");
    process.exit(1);
  }
  const token = await getToken(email, apiKey);
  console.log("Conexión con Contabilium correcta. Trayendo artículos…");

  const articles = [];
  const seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await get("/api/conceptos/search", token, { page, pageSize: PAGE_SIZE });
    const items = itemsOf(body);
    let fresh = 0;
    for (const item of items) {
      const key = String(item.Id ?? item.id ?? item.Codigo ?? item.codigo ?? JSON.stringify(item));
      if (seen.has(key)) continue;
      seen.add(key);
      articles.push(withoutImages(item));
      fresh++;
    }
    console.log(`  página ${page}: ${items.length} artículos (${articles.length} en total)`);
    const totalPages = body?.TotalPage ?? body?.totalPage;
    if (items.length < PAGE_SIZE || fresh === 0 || (totalPages && page >= totalPages)) break;
    await sleep(PAUSE_MS);
  }

  let rubros = [];
  try { rubros = await get("/api/conceptos/rubros", token); } catch (error) { console.warn(`No se pudieron traer los rubros: ${error.message}`); }

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/articulos.json`, JSON.stringify(articles, null, 2));
  await writeFile(`${OUT}/rubros.json`, JSON.stringify(withoutImages(rubros), null, 2));

  const fields = new Map();
  for (const article of articles) for (const [key, value] of Object.entries(article)) {
    const entry = fields.get(key) ?? { llenos: 0, ejemplo: "" };
    if (value !== null && value !== "" && value !== undefined) { entry.llenos++; if (!entry.ejemplo) entry.ejemplo = String(typeof value === "object" ? JSON.stringify(value) : value).slice(0, 60); }
    fields.set(key, entry);
  }
  console.log(`\nListo: ${articles.length} artículos guardados en ${OUT}/articulos.json (sin imágenes).`);
  console.log("\nCampos encontrados (nombre · artículos con dato · ejemplo):");
  for (const [key, info] of fields) console.log(`  ${key} · ${info.llenos} · ${info.ejemplo}`);
}

main().catch((error) => { console.error(`Error: ${error.message}`); process.exit(1); });

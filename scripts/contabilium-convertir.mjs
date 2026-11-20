// Convierte datos-contabilium/articulos.json en un Excel para "Importar / Exportar" del admin.
// Uso: node scripts/contabilium-convertir.mjs [--descuento-efectivo 15]
// Solo importa artículos con precio y stock mayores a 0. Marca y categoría salen del nombre.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { rutaDe } from "./arbol-categorias.mjs";

const DIR = "datos-contabilium";
const argIndex = process.argv.indexOf("--descuento-efectivo");
const DESCUENTO = argIndex > -1 ? Number(process.argv[argIndex + 1]) : NaN;
if (!(DESCUENTO >= 0 && DESCUENTO < 90)) { console.error("Indicá el descuento del precio en efectivo: --descuento-efectivo 15"); process.exit(1); }

const ACRONYMS = new Set(["LED", "LCD", "USB", "TV", "UHD", "HDMI", "FHD", "HD", "GPS", "DVD", "CD", "MP3", "AC", "DC", "WIFI", "RGB", "BT", "NFC", "SSD", "RAM", "GN", "GLP", "II", "III", "IV", "AA", "AAA", "RPM", "BBQ", "PVC", "ABS", "LPG", "NO", "FROST"]);
const SMALL = new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "CON", "PARA", "Y", "O", "EN", "SIN", "POR", "A", "AL"]);
// primeras palabras del nombre que NO son marcas
const NOT_BRAND = new Set(["BAZAR", "JUGUETE", "MUEBLES", "MACIZO", "ENRIQUE", "SMART", "BLACK", "STAR", "WEEK", "HOME", "ESTUFA", "COCINA", "HELADERA", "VENTILADOR", "PARLANTE", "ANAFE", "CAFETERA", "PLANCHA", "LICUADORA", "TERMOTANQUE", "FREEZER", "LAVARROPAS", "MICROONDAS", "CALEFACTOR", "CALOVENTOR", "BICICLETA", "SILLA", "MESA", "PAVA", "HORNO", "AIRE", "TELEVISOR", "NOTEBOOK", "CELULAR", "KIT", "SET", "JUEGO", "COMBO", "CAMARA", "CARGADOR", "CABLE", "TOSTADORA", "PROCESADORA", "BATIDORA", "SECADOR"]);

// Categoría por palabras clave del nombre (el orden importa: gana la primera que coincide)
const CATEGORIES = [
  ["Aires acondicionados", /(\bAIRE\b.*\bSPLIT\b|\bSPLIT\b.*\bFRIGORIAS\b|ACONDICIONADO|FRIGORIAS)/],
  ["Televisores", /\b(TELEVISOR|TV|SMART TV|LED \d{2}|SOPORTE TV)\b/],
  ["Celulares", /\b(CELULAR|SMARTPHONE|IPHONE)\b/],
  ["Lavarropas", /\b(SECADORA|LAVARROPAS?|LAVASECARROPAS?|SECARROPAS?|LAVAVAJILLAS|CENTRIFUGA|CENTRIFIGA)\b/],
  ["Heladeras y freezers", /\b(HELADERA|FREEZER|FRIGOBAR|CONSERVADORA|CAVA)\b/],
  ["Termotanques", /\b(TERMOTANQUE|CALEFON|CALEFÓN)\b/],
  ["Cocinas y hornos", /\b(COCINA|ANAFE|HORNO|HORNALLAS|CAMPANA|PURIFICADOR|PARRILLA|ASADOR|QUEMADOR)\b/],
  ["Microondas", /\b(MICROONDAS)\b/],
  ["Ventiladores", /\b(VENTILADOR|TURBO VENTILADOR|CIRCULADOR)\b/],
  ["Calefacción", /\b(ESTUFA|CALEFACTOR|CALOVENTOR|PANEL CALEFACTOR|RADIADOR|BRASERO|CALEFACCION|CALEFACCIÓN|VITROCONVECTOR|VITROCALEFACTOR|CONVECTOR|CALENTADOR)\b/],
  ["Climatización", /\b(HUMIDIFICADOR|DESHUMIDIFICADOR|AIRE FRIO|ENFRIADOR|EVAPORATIVO)\b/],
  ["Audio", /\b(SUBWOOFER|PARLANTE|PARLANTES|AURICULAR|AURICULARES|BARRA DE SONIDO|SOUNDBAR|RADIO|MICROFONO|MICRÓFONO|EQUIPO DE MUSICA|MINICOMPONENTE|AMPLIFICADOR)\b/],
  ["Herramientas", /\b(ELECTROBOMBA|PODADORA|APAREJO|SET DE HERRAMIENTAS|HERRAMIENTAS|LLAVE COMBINADA|LLAVE|HACHA|PISTOLA DE CALOR|PISTOLA|BOMBA|GENERADOR|PULVERIZADOR|AMOLADORA|SIERRA|TALADRO|ATORNILLADOR|LIJADORA|CEPILLO ELECTRICO|COMPRESOR|SOLDADORA|HIDROLAVADORA|CORTADORA DE CESPED|BORDEADORA|MOTOSIERRA|ROTOMARTILLO|CALADORA|DISCO|HERRAMIENTA)\b/],
  ["Cuidado personal", /\b(TERMOMETRO|NEBULIZADOR|DIFUSOR DE AIRE|AFEITADORA|CORTADORA DE CABELLO|CORTADORA DE PELO|CORTAPELO|CABELLO|SECADOR DE PELO|SECADOR|PLANCHITA|ONDULADOR|MODELADOR|DEPILADORA|BALANZA|MASAJEADOR|CEPILLO|RIZADOR|PATILLERA|MAQUINA DE CORTAR)\b/],
  ["Planchas", /\b(PLANCHA|PLANCHADOR|CENTRO DE PLANCHADO)\b/],
  ["Aspiradoras y limpieza", /\b(LIMPIADOR DE ALFOMBRAS|ASPIRADORA|ROBOT ASPIRADOR|LUSTRADORA|BARREDORA|LIMPIA|VAPORIZADORA)\b/],
  ["Pequeños electrodomésticos", /\b(PAELLERA|RALLADOR|GELATIERA|FABRICA DE HELADOS|MAQUINA DE HIELO|SALADINO|CORTAVERDURAS|WAFLERA|VAPORERA|MAQUINA DE HELADOS|CORTADORA DE FIAMBRE|PICADOR|MAKER|PAVA|CAFETERA|TOSTADORA|FREIDORA|LICUADORA|PROCESADORA|MULTIPROCESADORA|BATIDORA|SANDWICHERA|EXPRIMIDOR|JUGUERA|WAFFLERA|YOGURTERA|PANIFICADORA|FABRICA DE PAN|MINI PIMER|MINIPIMER|PICADORA|HELADERA PORTATIL|OLLA|ARROCERA|HERVIDOR|GRILL|PLANCHA GRILL|PIZZERA|SALAD MAKER|CAFE|MOLINILLO|EXTRACTOR|BLENDER|MIXER|PROCESAD)\b/],
  ["Bicicletas y rodados", /\b(BICICLETA|BICI|MONOPATIN|MONOPATÍN|PATIN|PATÍN|TRICICLO|CAMINADORA|ELIPTICO|ELÍPTICO)\b/],
  ["Muebles", /\b(MUEBLE|MUEBLES|SILLA|SILLON|SILLÓN|MESA|RACK|ESCRITORIO|COMODA|CÓMODA|BIBLIOTECA|PLACARD|ESTANTE|SOMMIER|COLCHON|COLCHÓN|BOX|GABINETE|BANQUETA|BAUL|BAÚL)\b/],
  ["Textil y blanco", /\b(SABANA|SABANAS|FRAZADA|ACOLCHADO|CUBRECAMA|EDREDON|TOALLON|TOALLA|COBERTOR|CORDERITO|ALMOHADA|MANTA|FLANNEL|COPERTOR|ALFOMBRA|CORTINA)\b/],
  ["Jardín, playa y camping", /\b(PILETA|PILETAS|GAZEBO|SOMBRILLA|REPOSERA|CARPA|PLAYA|TOLDO|HAMACA|PARRILLERO|OUTDOORS|CAMPING|MOCHILA)\b/],
  ["Bebés y niños", /\b(ANDADOR|COCHE|CUNA|BEBE|BEBÉ|MOISES|PORTABEBE|INFANTIL)\b/],
  ["Motos", /\b(MOTO|MOTOCICLETA|CUATRICICLO)\b/],
  ["Juguetes", /\b(JUGUETE|JUEGO DE MESA|MUÑECA|MUÑECO|PELOTA)\b/],
  ["Bazar", /\b(BAZAR|VASO|TAZA|PLATO|CUBIERTOS|SARTEN|SARTÉN|CACEROLA|TERMO|MATE|FUENTE|TUPPER|VIANDA|JARRA|COPA|BOWL|CUCHILLO|TABLA|UTENSILIO|ESCURRIDOR|ORGANIZADOR|BALDE|CESTO)\b/],
  ["Informática", /\b(NOTEBOOK|TABLET|MONITOR|IMPRESORA|MOUSE|TECLADO|CAMARA IP|CÁMARA IP|ROUTER|PENDRIVE|DISCO RIGIDO|MEMORIA|WEBCAM|CAMARA|CÁMARA|CARGADOR|CABLE|FUENTE USB|ADAPTADOR|POWER BANK|BATERIA|PILAS|PILA|LINTERNA)\b/],
  ["Iluminación", /\b(LAMPARA|LÁMPARA|LUZ|REFLECTOR|PLAFON|PLAFÓN|FOCO|ARTEFACTO|GUIRNALDA|VELADOR)\b/]
];

const money = (value) => Math.round(value);
const normalize = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

function titleCase(text) {
  return text.split(/(\s+|-|\/)/).map((part, index) => {
    if (!/[A-Za-zÁÉÍÓÚÑ]/.test(part)) return part;
    const upper = part.toUpperCase();
    if (/\d/.test(part) || ACRONYMS.has(normalize(upper))) return upper;
    if (index > 0 && SMALL.has(upper)) return upper.toLowerCase();
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  }).join("");
}

function cleanName(raw) {
  let name = raw.replace(/\s+/g, " ").trim();
  const features = [];
  let outlet = false;
  // garantía entre paréntesis: "(DOCE MESES DE GARANTIA OFICIAL)", "(TRES MESES DE GARANTIA CON EL LOCAL)"
  name = name.replace(/\(\s*([^()]*GARANT[^()]*)\)/i, (_, inner) => {
    const months = { UN: 1, UNO: 1, DOS: 2, TRES: 3, SEIS: 6, DOCE: 12, VEINTICUATRO: 24 };
    const word = normalize(inner.toUpperCase()).match(/\b(UN|UNO|DOS|TRES|SEIS|DOCE|VEINTICUATRO|\d{1,2})\s+MES/);
    const n = word ? (months[word[1]] ?? Number(word[1])) : null;
    const where = /LOCAL/i.test(inner) ? " con el local" : /OFICIAL/i.test(inner) ? " oficial" : "";
    features.push(n ? `Garantía ${n} ${n === 1 ? "mes" : "meses"}${where}` : "Con garantía");
    return " ";
  });
  if (/\bOUTLET\b/i.test(name)) { outlet = true; name = name.replace(/\bOUTLET\b\s*\(?\s*\)?/gi, " "); }
  name = name.replace(/\s*-\s*$/, "").replace(/^(BAZAR|JUGUETE|MUEBLES)\s+/i, "").replace(/\s+BAZAR$/i, "").replace(/[\s(,;:-]+$/, "").replace(/\s+/g, " ").trim();
  return { name, features, outlet };
}

function categoryOf(upperName, firstWord) {
  if (/\bBAZAR\b/.test(upperName)) return "Bazar";
  if (firstWord === "BAZAR") return "Bazar";
  if (firstWord === "JUGUETE") return "Juguetes";
  if (firstWord === "MUEBLES" || firstWord === "MACIZO") return "Muebles";
  const text = normalize(upperName);
  for (const [category, regex] of CATEGORIES) if (regex.test(text)) return category;
  return "Otros";
}

/** Líneas del árbol con cantidades acumuladas por rama. */
function arbolLineas(rows) {
  const conteo = new Map();
  for (const row of rows) {
    const partes = row.category.split(" > ");
    for (let largo = 1; largo <= partes.length; largo++) {
      const clave = partes.slice(0, largo).join(" > ");
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    }
  }
  return [...conteo.keys()].sort((a, b) => a.localeCompare(b, "es")).map((clave) => {
    const partes = clave.split(" > ");
    return `${"  ".repeat(partes.length)}${partes[partes.length - 1]}: ${conteo.get(clave)}`;
  });
}

async function main() {
  const all = JSON.parse(await readFile(`${DIR}/articulos.json`, "utf8"));
  const MIN_PRICE = 500; // por debajo son artículos internos (gift card, gastos, "...DE OFERTA" a $1)
  const internal = all.filter((a) => a.PrecioFinal > 0 && a.PrecioFinal < MIN_PRICE && a.Stock > 0);
  const kept = all.filter((a) => a.PrecioFinal >= MIN_PRICE && a.Stock > 0 && !/^(ENVIO|GIFT CARD|TARJETA DE REGALO)\b/i.test(a.Nombre.trim()));
  const noPrice = all.filter((a) => !(a.PrecioFinal > 0)).length;
  const noStock = all.filter((a) => a.PrecioFinal > 0 && !(a.Stock > 0)).length;

  const firstWords = new Map();
  for (const a of kept) { const w = (a.Nombre.trim().split(/\s+/)[0] || "").toUpperCase(); firstWords.set(w, (firstWords.get(w) ?? 0) + 1); }
  const isBrand = (w) => w.length >= 3 && (firstWords.get(w) ?? 0) >= 3 && !NOT_BRAND.has(w) && /^[A-ZÑ&.]+$/.test(w);

  const rows = [];
  const stats = { categorias: new Map(), marcas: new Map(), otros: [] };
  for (const a of kept) {
    const { name, features, outlet } = cleanName(a.Nombre);
    const words = name.toUpperCase().split(" ");
    const first = words[0] ?? "";
    const brand = isBrand(first) ? titleCase(first) : "";
    const rawUpper = a.Nombre.toUpperCase();
    const category = categoryOf(rawUpper, rawUpper.trim().split(/\s+/)[0] ?? "");
    const ruta = rutaDe(category, name).join(" > ");
    const contado = money(a.PrecioFinal);
    const efectivo = money(a.PrecioFinal * (1 - DESCUENTO / 100));
    const shown = titleCase(name).slice(0, 200);
    rows.push({ sku: a.Codigo.trim(), name: shown, description: (a.Descripcion ?? "").trim(), category: ruta, brand, efectivo, contado, features: features.join(" | "), outlet: outlet ? "sí" : "no" });
    stats.categorias.set(ruta, (stats.categorias.get(ruta) ?? 0) + 1);
    if (brand) stats.marcas.set(brand, (stats.marcas.get(brand) ?? 0) + 1);
    if (category === "Otros") stats.otros.push(shown);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Artículos");
  sheet.columns = [
    { header: "SKU", key: "sku", width: 20 }, { header: "Nombre", key: "name", width: 60 }, { header: "Descripción", key: "description", width: 40 },
    { header: "Categoría", key: "category", width: 26 }, { header: "Marca", key: "brand", width: 18 },
    { header: "Precio efectivo", key: "efectivo", width: 16 }, { header: "Precio contado", key: "contado", width: 16 },
    { header: "Características", key: "features", width: 34 }, { header: "Outlet", key: "outlet", width: 8 }
  ];
  sheet.addRows(rows);
  sheet.getRow(1).font = { bold: true };
  await mkdir(DIR, { recursive: true });
  await workbook.xlsx.writeFile(`${DIR}/importar-catalogo.xlsx`);

  const sorted = (map) => [...map.entries()].sort((x, y) => y[1] - x[1]);
  const report = [
    `Artículos en Contabilium: ${all.length}`, `Se importan: ${rows.length}`, `Omitidos por precio 0: ${noPrice}`, `Omitidos por sin stock: ${noStock}`, `Omitidos por precio menor a $${MIN_PRICE} (artículos internos): ${internal.length}`,
    `Descuento del precio en efectivo: ${DESCUENTO}% (contado = PrecioFinal de Contabilium)`, `Marcados como outlet: ${rows.filter((r) => r.outlet === "sí").length}`, "",
    "ÁRBOL PROPUESTO (cantidad de artículos por rama, incluye lo que hay debajo)", ...arbolLineas(rows), "",
    `MARCAS (${stats.marcas.size})`, ...sorted(stats.marcas).map(([k, v]) => `  ${k}: ${v}`), "",
    `SIN CATEGORÍA (${stats.otros.length})`, ...stats.otros.map((n) => `  ${n}`), "", `OMITIDOS POR PRECIO BAJO (${internal.length})`, ...internal.map((a) => `  ${a.Codigo} | ${a.Nombre} | $${a.PrecioFinal}`)
  ].join("\n");
  await writeFile(`${DIR}/informe-importacion.txt`, report);
  console.log(report.split("\n").slice(0, 40).join("\n"));
  console.log(`\nArchivo listo: ${DIR}/importar-catalogo.xlsx (${rows.length} filas). Informe completo: ${DIR}/informe-importacion.txt`);
}

main().catch((error) => { console.error(`Error: ${error.message}`); process.exit(1); });

// Borra TODOS los artículos de la base indicada en MONGODB_URI (no toca categorías, marcas, cupones ni ajustes).
// Por seguridad NO lee .env.local: la conexión se pasa en el comando, solo en tu terminal.
//   Vista previa (no borra nada):  MONGODB_URI='mongodb+srv://...' node scripts/borrar-articulos.mjs
//   Borrar de verdad:              MONGODB_URI='mongodb+srv://...' node scripts/borrar-articulos.mjs --confirmar
// Contra una base local hace falta agregar --local.
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const confirm = process.argv.includes("--confirmar");
const allowLocal = process.argv.includes("--local");

if (!uri) { console.error("Falta MONGODB_URI en el comando (ver las instrucciones al principio del archivo)."); process.exit(1); }

let host = "?";
try { host = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:")).host.split("@").pop(); } catch { /* se muestra "?" */ }
const isLocal = /localhost|127\.0\.0\.1/.test(host);
if (isLocal && !allowLocal) { console.error(`La conexión apunta a una base LOCAL (${host}). Si es lo que querés, agregá --local.`); process.exit(1); }

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const products = db.collection("products");
  const total = await products.countDocuments();
  const demo = await products.countDocuments({ sku: /^DEMO-/ });
  console.log(`Base: ${db.databaseName} en ${host}${isLocal ? " (LOCAL)" : ""}`);
  console.log(`Artículos: ${total} (de prueba DEMO-: ${demo}, otros: ${total - demo})`);
  const others = await products.find({ sku: { $not: /^DEMO-/ } }, { projection: { sku: 1, name: 1 } }).limit(10).toArray();
  for (const item of others) console.log(`  · ${item.sku} | ${item.name}`);

  if (!confirm) {
    console.log("\nVista previa: NO se borró nada. Para borrar estos artículos, repetí el comando agregando --confirmar");
  } else if (total === 0) {
    console.log("\nNo hay artículos para borrar.");
  } else {
    const result = await products.deleteMany({});
    console.log(`\nBorrados ${result.deletedCount} artículos. Quedan ${await products.countDocuments()}.`);
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

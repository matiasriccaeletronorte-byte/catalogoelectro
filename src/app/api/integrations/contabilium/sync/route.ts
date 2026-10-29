import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { ProductModel } from "@/models/Product";

type RemoteProduct = Record<string, unknown>;

function normalizeEndpoint(baseUrl: string, endpoint: string) {
  return new URL(endpoint, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function extractArray(payload: unknown): RemoteProduct[] {
  if (Array.isArray(payload)) return payload as RemoteProduct[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["products", "items", "Items", "data", "results", "rows"]) {
    const value = record[key];
    if (Array.isArray(value)) return value as RemoteProduct[];
  }
  return [];
}

function pickString(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function pickSku(item: RemoteProduct) {
  return pickString(item.sku ?? item.SKU ?? item.code ?? item.codigo ?? item.Codigo ?? item.sku_code ?? item.skuCode);
}

function pickNumber(item: RemoteProduct, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();

  const baseUrl = process.env.CONTABILIUM_BASE_URL;
  const apiKey = process.env.CONTABILIUM_API_KEY;
  const endpoint = process.env.CONTABILIUM_PRODUCTS_ENDPOINT ?? "/api/conceptos/search?pageSize=50";
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "Faltan CONTABILIUM_BASE_URL o CONTABILIUM_API_KEY en .env.local" }, { status: 400 });
  }

  const url = normalizeEndpoint(baseUrl, endpoint);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const error = response.status === 401 || response.status === 403
      ? "Contabilium rechazó las credenciales. Verificá o regenerá la API Key en Contabilium."
      : "Contabilium no respondió correctamente.";
    return NextResponse.json({ error, status: response.status }, { status: response.status });
  }

  const payload = await response.json();
  const remoteProducts = extractArray(payload)
    .map(item => ({
      raw: item,
      sku: pickSku(item),
      stock: pickNumber(item, ["Stock", "stock", "stock_available", "inventory_quantity", "quantity", "existencia"]),
      price: pickNumber(item, ["PrecioFinal", "Precio", "price", "precio", "sale_price", "price_incl", "importe", "amount"])
    }))
    .filter(item => item.sku && item.stock !== null && item.price !== null);

  await connectDb();
  const matched = await ProductModel.find({ sku: { $in: remoteProducts.map(product => product.sku) } });
  const bySku = new Map(remoteProducts.map(product => [product.sku, product]));

  let updated = 0;
  for (const product of matched) {
    const remote = bySku.get(product.sku ?? "");
    if (!remote || remote.stock === null || remote.price === null) continue;
    product.stock = remote.stock;
    product.price = remote.price;
    await product.save();
    updated += 1;
  }

  return NextResponse.json({
    updated,
    matched: matched.length,
    remote: remoteProducts.length
  });
}

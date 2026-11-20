import ExcelJS from "exceljs";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { loadNodes } from "@/lib/category-store";
import { productPathText } from "@/lib/category-tree";
import { connectDb } from "@/lib/db";
import { ProductModel } from "@/models/Product";

const COLUMNS = [
  ["SKU", "sku"], ["Nombre", "name"], ["Descripción", "description"], ["Categoría", "categoryPath"],
  ["Marca", "brand"], ["Precio efectivo", "cashPrice"], ["Precio contado", "listPrice"], ["Disponible", "available"],
  ["Características", "features"], ["Outlet", "outlet"], ["Activo", "active"]
] as const;

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  await connectDb();
  const products = await ProductModel.find({}).sort({ sku: 1 }).lean();
  const nodes = await loadNodes();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Catálogo");
  sheet.columns = COLUMNS.map(([header]) => ({ header, width: header === "Descripción" ? 50 : 18 }));
  for (const p of products) {
    sheet.addRow(COLUMNS.map(([, key]) => {
      if (key === "categoryPath") return productPathText(nodes, p as { categoryId?: unknown; category?: string; subCategory?: string });
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

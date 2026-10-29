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

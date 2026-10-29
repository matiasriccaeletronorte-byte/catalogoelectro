import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
import { ImportConflictError } from "@/lib/import/apply";
import { runImport } from "@/lib/import/run";
import { readImportFile } from "@/lib/import/read-file";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await isAdmin(request))) return unauthorized();
  const form = await request.formData();
  const file = form.get("file");
  const mode = form.get("mode") === "apply" ? "apply" : "preview";
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "El archivo supera los 4 MB. Dividilo en partes." }, { status: 400 });
  let parsed;
  try {
    parsed = await readImportFile(Buffer.from(await file.arrayBuffer()), file.name);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer el archivo." }, { status: 400 });
  }
  await connectDb();
  try {
    return NextResponse.json({ ...(await runImport(parsed.rows, mode)), columns: parsed.columns });
  } catch (error) {
    if (error instanceof ImportConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

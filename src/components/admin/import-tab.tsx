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
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "No se pudo procesar el archivo."); return; }
    setResult(body);
    if (mode === "apply") setFile(null);
  }

  return <div className="product-form">
    <p>CATÁLOGO</p>
    <h1>Importar y exportar</h1>
    <small>
      Subí un Excel (.xlsx) o CSV. La primera fila son los encabezados: SKU, Nombre, Descripción, Categoría, Subcategoría, Marca, Precio efectivo, Precio contado, Disponible, Características (separadas por |), Outlet, Activo.
      Si el SKU ya existe se actualiza (solo las celdas con valor); si no, se crea. Las imágenes se cargan desde cada artículo.
    </small>
    <input type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
    <button type="button" disabled={!file || busy} onClick={() => send("preview")}>Ver vista previa</button>
    <a className="primary-link" href="/api/admin/export?format=xlsx">Descargar catálogo actual (Excel)</a>
    <a className="primary-link" href="/api/admin/export?format=csv">Descargar catálogo actual (CSV)</a>
    {error ? <p className="error">{error}</p> : null}
    {result ? <div>
      <p><strong>{result.mode === "apply" ? "Importación terminada" : "Vista previa"}:</strong> {result.created} nuevos, {result.updated} a modificar, {result.errors.length} con error.</p>
      {result.errors.length > 0 ? <ul>{result.errors.slice(0, 200).map((e) => <li key={`${e.rowNumber}-${e.message}`}>Fila {e.rowNumber}: {e.message}</li>)}</ul> : null}
      {result.mode === "preview" && result.created + result.updated > 0 ? <button type="button" disabled={busy} onClick={() => send("apply")}>Confirmar e importar {result.created + result.updated} artículos</button> : null}
    </div> : null}
  </div>;
}

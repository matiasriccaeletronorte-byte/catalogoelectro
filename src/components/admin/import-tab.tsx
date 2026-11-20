"use client";

import { useEffect, useState } from "react";

type Result = { mode: "preview" | "apply"; created: number; updated: number; errors: { rowNumber: number; message: string }[]; columns: string[]; newCategories?: string[] };

export function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [word, setWord] = useState("");
  const [purgeMessage, setPurgeMessage] = useState("");

  const loadTotal = () => fetch("/api/admin/purge-products").then((r) => (r.ok ? r.json() : null)).then((d) => setTotal(d ? d.total : null)).catch(() => setTotal(null));
  useEffect(() => { void loadTotal(); }, []);

  async function purge() {
    setBusy(true); setPurgeMessage("");
    const response = await fetch("/api/admin/purge-products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: word }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setPurgeMessage(body.error ?? "No se pudo borrar."); return; }
    setWord("");
    setPurgeMessage(`Se borraron ${body.deleted} artículos.`);
    void loadTotal();
  }

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
      Subí un Excel (.xlsx) o CSV. La primera fila son los encabezados: SKU, Nombre, Descripción, Categoría (con subniveles así: Climatización &gt; Aires acondicionados &gt; Split), Marca, Precio efectivo, Precio contado, Disponible, Características (separadas por |), Outlet, Activo.
      Si el SKU ya existe se actualiza (solo las celdas con valor); si no, se crea. Las imágenes se cargan desde cada artículo.
    </small>
    <input type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
    <button type="button" disabled={!file || busy} onClick={() => send("preview")}>Ver vista previa</button>
    <a className="primary-link" href="/api/admin/export?format=xlsx">Descargar catálogo actual (Excel)</a>
    <a className="primary-link" href="/api/admin/export?format=csv">Descargar catálogo actual (CSV)</a>
    {error ? <p className="error">{error}</p> : null}
    {result ? <div>
      <p><strong>{result.mode === "apply" ? "Importación terminada" : "Vista previa"}:</strong> {result.created} nuevos, {result.updated} a modificar, {result.errors.length} con error.</p>
      {result.newCategories && result.newCategories.length > 0 ? <details className="new-categories">
        <summary>{result.mode === "apply" ? "Se crearon" : "Se van a crear"} {result.newCategories.length} categorías nuevas</summary>
        <ul>{result.newCategories.slice(0, 200).map((path) => <li key={path}>{path}</li>)}</ul>
      </details> : null}
      {result.errors.length > 0 ? <ul>{result.errors.slice(0, 200).map((e) => <li key={`${e.rowNumber}-${e.message}`}>Fila {e.rowNumber}: {e.message}</li>)}</ul> : null}
      {result.mode === "preview" && result.created + result.updated > 0 ? <button type="button" disabled={busy} onClick={() => send("apply")}>Confirmar e importar {result.created + result.updated} artículos</button> : null}
    </div> : null}
    <section className="danger-zone">
      <h2>Borrar todos los artículos</h2>
      <p>Hay <strong>{total ?? "…"}</strong> artículos cargados. Esta acción los borra a todos y <strong>no se puede deshacer</strong>. No toca categorías, marcas, cupones ni los textos de la home. Si necesitás conservar los datos, antes descargá el catálogo en Excel.</p>
      <label>Para confirmar, escribí <b>BORRAR</b>
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="BORRAR" autoComplete="off" />
      </label>
      <button type="button" className="danger" disabled={busy || word !== "BORRAR" || !total} onClick={() => void purge()}>Borrar los {total ?? ""} artículos</button>
      {purgeMessage ? <p role="status">{purgeMessage}</p> : null}
    </section>
  </div>;
}

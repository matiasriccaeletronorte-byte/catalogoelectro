"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { buildTree, descendantIds, formatPath, nodePath, type CategoryNodeData, type TreeNode } from "@/lib/category-tree";

type Data = { nodes: CategoryNodeData[]; counts: Record<string, number>; legacyProducts: number };
type Pending = { id: string; kind: "move" | "move-products" } | null;

export function CategoriesTab({ onChange }: { onChange: () => void }) {
  const [data, setData] = useState<Data>({ nodes: [], counts: {}, legacyProducts: 0 });
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/category-tree");
    if (response.ok) setData(await response.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(method: "POST" | "DELETE", body: object, fallback: string): Promise<boolean> {
    const response = await fetch("/api/admin/category-tree", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(result.error ?? fallback); return false; }
    setMessage("");
    await load();
    onChange();
    return true;
  }

  async function add(event: FormEvent<HTMLFormElement>, parentId: string | null) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) return;
    if (await send("POST", { action: "create", parentId, name }, "No se pudo crear la categoría.")) {
      form.reset();
      if (parentId) setOpen((current) => new Set(current).add(parentId));
      setAdding(null);
    }
  }

  async function rename(node: CategoryNodeData) {
    const name = window.prompt(`Nuevo nombre para "${node.name}":`, node.name)?.trim();
    if (name && name !== node.name) await send("POST", { action: "rename", id: node.id, name }, "No se pudo renombrar.");
  }

  async function deleteProducts(node: CategoryNodeData) {
    const count = data.counts[node.id] ?? 0;
    const word = window.prompt(`Se van a BORRAR ${count} ${count === 1 ? "artículo" : "artículos"} de "${node.name}" y de sus subcategorías. No se puede deshacer. Las categorías no se borran. Antes conviene descargar el catálogo en Excel (Importar / Exportar).\n\nPara confirmar, escribí BORRAR:`);
    if (word?.trim() !== "BORRAR") return;
    if (await send("POST", { action: "delete-products", id: node.id, confirm: "BORRAR" }, "No se pudieron borrar los artículos.")) setMessage(`Se borraron los artículos de "${node.name}".`);
  }

  async function remove(node: CategoryNodeData) {
    if (window.confirm(`¿Borrar la categoría "${node.name}"?`)) await send("DELETE", { id: node.id }, "No se pudo borrar.");
  }

  async function choose(event: FormEvent<HTMLSelectElement>, node: CategoryNodeData, kind: "move" | "move-products") {
    const value = event.currentTarget.value;
    if (value === "__none") return;
    const target = value === "__root" ? null : value;
    if (kind === "move") await send("POST", { action: "move", id: node.id, newParentId: target }, "No se pudo mover.");
    else if (target && window.confirm(`¿Pasar todos los artículos de "${node.name}" a "${formatPath(nodePath(data.nodes, target))}"?`)) await send("POST", { action: "move-products", fromId: node.id, toId: target }, "No se pudieron mover los artículos.");
    setPending(null);
  }

  const toggle = (id: string) => setOpen((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const optionsFor = (node: CategoryNodeData, kind: "move" | "move-products") => {
    const banned = new Set([node.id, ...(kind === "move" ? descendantIds(data.nodes, node.id) : [])]);
    return data.nodes.filter((n) => !banned.has(n.id)).map((n) => ({ id: n.id, label: formatPath(nodePath(data.nodes, n.id)) })).sort((a, b) => a.label.localeCompare(b.label, "es"));
  };

  const row = (node: TreeNode, depth: number): React.ReactNode => {
    const count = data.counts[node.id] ?? 0;
    const isOpen = open.has(node.id);
    return <div key={node.id} className="tree-item">
      <div className="tree-row" style={{ paddingLeft: depth * 22 }}>
        <button type="button" className="tree-toggle" onClick={() => toggle(node.id)} aria-expanded={isOpen} aria-label={isOpen ? "Cerrar" : "Abrir"} disabled={node.children.length === 0}>{node.children.length === 0 ? "·" : isOpen ? "▾" : "▸"}</button>
        <b>{node.name}</b>
        <span className="tree-count">{count} {count === 1 ? "artículo" : "artículos"}</span>
        <span className="tree-actions">
          <button type="button" className="row-action" onClick={() => setAdding(adding === node.id ? null : node.id)}>+ Subcategoría</button>
          <button type="button" className="row-action" onClick={() => void rename(node)}>Renombrar</button>
          <button type="button" className="row-action" onClick={() => setPending({ id: node.id, kind: "move" })}>Mover</button>
          <button type="button" className="row-action" onClick={() => setPending({ id: node.id, kind: "move-products" })} disabled={count === 0}>Mover artículos</button>
          <button type="button" className="row-action danger" onClick={() => void deleteProducts(node)} disabled={count === 0}>Borrar artículos</button>
          <button type="button" className="row-action danger" onClick={() => void remove(node)}>Borrar</button>
        </span>
      </div>
      {pending?.id === node.id ? <div className="tree-inline" style={{ paddingLeft: depth * 22 + 28 }}>
        <label>{pending.kind === "move" ? "Mover dentro de:" : "Pasar los artículos a:"}
          <select defaultValue="__none" onChange={(e) => void choose(e, node, pending.kind)}>
            <option value="__none">Elegí…</option>
            {pending.kind === "move" ? <option value="__root">Primer nivel (sin padre)</option> : null}
            {optionsFor(node, pending.kind).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <button type="button" className="row-action" onClick={() => setPending(null)}>Cancelar</button>
      </div> : null}
      {adding === node.id ? <form className="tree-inline" style={{ paddingLeft: depth * 22 + 28 }} onSubmit={(e) => void add(e, node.id)}>
        <input name="name" placeholder={`Subcategoría de ${node.name}`} maxLength={60} autoFocus />
        <button>Agregar</button>
      </form> : null}
      {isOpen ? node.children.map((child) => row(child, depth + 1)) : null}
    </div>;
  };

  return <>
    <p>ORGANIZACIÓN</p>
    <h1>Categorías</h1>
    {data.legacyProducts > 0 ? <div className="legacy-banner" role="status">
      <b>Hay {data.legacyProducts} artículos con la categoría vieja (sin árbol).</b> Convertilos para poder organizarlos en subcategorías. Se puede repetir sin problema.
      <button type="button" onClick={async () => { if (await send("POST", { action: "convert" }, "No se pudo convertir.")) setMessage("Listo: las categorías actuales ya forman parte del árbol."); }}>Convertir las categorías actuales</button>
    </div> : null}
    <form className="category-form" onSubmit={(e) => void add(e, null)}>
      <input name="name" placeholder="Nueva categoría de primer nivel" maxLength={60} required />
      <button>Agregar</button>
    </form>
    <small>Las categorías se ordenan de la A a la Z ("Otros" siempre al final). Una categoría solo se puede borrar si no tiene subcategorías ni artículos.</small>
    {message ? <small role="alert" className="tree-message">{message}</small> : null}
    <div className="category-tree-view">{buildTree(data.nodes).map((node) => row(node, 0))}</div>
  </>;
}

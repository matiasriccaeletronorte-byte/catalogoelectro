"use client";

import { buildTree, nodePath, type CategoryNodeData } from "@/lib/category-tree";

/** Selectores en cascada: nivel 1, nivel 2, nivel 3… `value` es el id del nodo más profundo elegido. */
export function CategoryPicker({ nodes, value, onChange }: { nodes: CategoryNodeData[]; value: string; onChange: (id: string) => void }) {
  const tree = buildTree(nodes);
  const chosen = value ? nodePath(nodes, value) : [];
  const levels: { options: { id: string; name: string }[]; selected: string }[] = [{ options: tree.map((n) => ({ id: n.id, name: n.name })), selected: chosen[0]?.id ?? "" }];
  let current = tree.find((n) => n.id === chosen[0]?.id);
  for (let depth = 1; current && current.children.length > 0; depth++) {
    levels.push({ options: current.children.map((n) => ({ id: n.id, name: n.name })), selected: chosen[depth]?.id ?? "" });
    current = current.children.find((n) => n.id === chosen[depth]?.id);
  }
  const pick = (depth: number, id: string) => onChange(id || (depth > 0 ? chosen[depth - 1].id : ""));
  return <div className="category-picker">
    {levels.map((level, depth) => <label className="field" key={depth}>{depth === 0 ? "Categoría" : `Subcategoría${depth > 1 ? ` (nivel ${depth + 1})` : ""}`}
      <select value={level.selected} onChange={(e) => pick(depth, e.target.value)} required={depth === 0}>
        <option value="">{depth === 0 ? "Elegí una categoría…" : "Sin subcategoría"}</option>
        {level.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>)}
  </div>;
}

import { Types } from "mongoose";
import {
  canMove, categoryHref, CategoryNodeData, derivedFields, descendantIds, findByName, hasCycle, nodePath, normalizeName, slugify, uniqueSlug, validCategoryName
} from "@/lib/category-tree";
import { searchTextOf } from "@/lib/product-schema";
import { CategoryModel } from "@/models/Category";
import { CategoryNodeModel } from "@/models/CategoryNode";
import { CategoryRedirectModel } from "@/models/CategoryRedirect";
import { ProductModel } from "@/models/Product";

export class CategoryError extends Error {
  constructor(public code: "invalid" | "not_found" | "duplicate" | "cycle" | "has_children" | "has_products", message: string) {
    super(message);
  }
}

type Row = { _id: Types.ObjectId; name: string; slug: string; parentId: Types.ObjectId | null };
const toData = (row: Row): CategoryNodeData => ({ id: String(row._id), name: row.name, slug: row.slug, parentId: row.parentId ? String(row.parentId) : null });
const cleanName = (name: string) => name.replace(/\s+/g, " ").trim();

export async function loadNodes(): Promise<CategoryNodeData[]> {
  const rows = (await CategoryNodeModel.find().lean()) as unknown as Row[];
  return rows.map(toData);
}

export async function createNode(parentId: string | null, rawName: string): Promise<CategoryNodeData> {
  const name = cleanName(rawName);
  if (!validCategoryName(name)) throw new CategoryError("invalid", "El nombre tiene que tener entre 2 y 60 caracteres y no puede incluir el signo >.");
  const nodes = await loadNodes();
  if (parentId && !nodes.some((node) => node.id === parentId)) throw new CategoryError("not_found", "La categoría padre no existe.");
  if (findByName(nodes, parentId, name)) throw new CategoryError("duplicate", "Ya existe una categoría con ese nombre en ese nivel.");
  const slug = uniqueSlug(slugify(name), nodes.filter((node) => node.parentId === parentId).map((node) => node.slug));
  try {
    const doc = await CategoryNodeModel.create({ name, slug, nameKey: normalizeName(name), parentId: parentId ? new Types.ObjectId(parentId) : null });
    return toData(doc.toObject() as unknown as Row);
  } catch (error) {
    // dos pedidos a la vez con el mismo nombre: gana uno y el otro recibe el aviso de duplicado
    if ((error as { code?: number }).code === 11000) throw new CategoryError("duplicate", "Ya existe una categoría con ese nombre en ese nivel.");
    throw error;
  }
}

type ProductRow = { _id: Types.ObjectId; sku?: string; name?: string; brand?: string; categoryId?: Types.ObjectId | null };

/** Actualizaciones de categoría para un grupo de artículos. Cada una exige que el artículo siga en la categoría que se leyó: si alguien lo cambió mientras tanto, no se lo pisa. */
export function productUpdateOps(rows: ProductRow[], path: CategoryNodeData[]) {
  const { category, subCategory } = derivedFields(path);
  const ids = path.map((node) => new Types.ObjectId(node.id));
  const leaf = ids[ids.length - 1];
  return rows.map((row) => ({
    updateOne: {
      filter: { _id: row._id, categoryId: row.categoryId ?? null },
      update: { $set: { categoryId: leaf, categoryPath: ids, category, subCategory, searchText: searchTextOf({ ...row, category, subCategory }) } }
    }
  }));
}

/** Pone categoría, camino y copias derivadas (y el texto de búsqueda) a los artículos que cumplan el filtro. */
async function setProductsCategory(filter: Record<string, unknown>, path: CategoryNodeData[]): Promise<number> {
  if (path.length === 0) return 0;
  const rows = (await ProductModel.find(filter).select("sku name brand categoryId").lean()) as unknown as ProductRow[];
  for (let i = 0; i < rows.length; i += 1000) await ProductModel.bulkWrite(productUpdateOps(rows.slice(i, i + 1000), path));
  return rows.length;
}

/** Recalcula camino y copias derivadas de todos los artículos de una rama (después de renombrar o mover). */
async function recomputeBranch(nodeId: string): Promise<void> {
  const nodes = await loadNodes();
  for (const id of [nodeId, ...descendantIds(nodes, nodeId)]) await setProductsCategory({ categoryId: id }, nodePath(nodes, id));
}

const slugPath = (nodes: CategoryNodeData[], id: string) => nodePath(nodes, id).map((node) => node.slug).join("/");
const branchPaths = (nodes: CategoryNodeData[], id: string) => [id, ...descendantIds(nodes, id)].map((nodeId) => ({ id: nodeId, path: slugPath(nodes, nodeId) }));

/** Guarda las direcciones viejas de una rama que cambió de camino, para redirigirlas en vez de dar 404. */
async function recordRedirects(before: { id: string; path: string }[]): Promise<void> {
  const nodes = await loadNodes();
  for (const { id, path } of before) {
    if (path && path !== slugPath(nodes, id)) await CategoryRedirectModel.updateOne({ fromPath: path }, { $set: { nodeId: new Types.ObjectId(id) } }, { upsert: true });
  }
}

/** Dirección actual a la que lleva una dirección vieja (`climatizacion/aires`), o `null` si no hay historial o la categoría ya no existe. */
export async function findRedirect(fromPath: string): Promise<string | null> {
  const doc = (await CategoryRedirectModel.findOne({ fromPath }).lean()) as { nodeId: Types.ObjectId } | null;
  if (!doc) return null;
  const path = nodePath(await loadNodes(), String(doc.nodeId));
  return path.length > 0 ? categoryHref(path) : null;
}

export async function renameNode(id: string, rawName: string): Promise<void> {
  const name = cleanName(rawName);
  if (!validCategoryName(name)) throw new CategoryError("invalid", "El nombre tiene que tener entre 2 y 60 caracteres y no puede incluir el signo >.");
  const nodes = await loadNodes();
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new CategoryError("not_found", "La categoría no existe.");
  const clash = findByName(nodes, node.parentId, name);
  if (clash && clash.id !== id) throw new CategoryError("duplicate", "Ya existe una categoría con ese nombre en ese nivel.");
  const slug = uniqueSlug(slugify(name), nodes.filter((item) => item.parentId === node.parentId && item.id !== id).map((item) => item.slug));
  const before = branchPaths(nodes, id);
  await CategoryNodeModel.updateOne({ _id: id }, { $set: { name, slug, nameKey: normalizeName(name) } });
  await recomputeBranch(id);
  await recordRedirects(before);
}

export async function moveNode(id: string, newParentId: string | null): Promise<void> {
  const nodes = await loadNodes();
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new CategoryError("not_found", "La categoría no existe.");
  if (!canMove(nodes, id, newParentId)) throw new CategoryError("cycle", "No se puede mover una categoría dentro de sí misma ni de sus subcategorías.");
  const clash = findByName(nodes, newParentId, node.name);
  if (clash && clash.id !== id) throw new CategoryError("duplicate", "El destino ya tiene una categoría con ese nombre.");
  const slug = uniqueSlug(node.slug, nodes.filter((item) => item.parentId === newParentId && item.id !== id).map((item) => item.slug));
  const before = branchPaths(nodes, id);
  await CategoryNodeModel.updateOne({ _id: id }, { $set: { parentId: newParentId ? new Types.ObjectId(newParentId) : null, slug } });
  // si dos personas movieron categorías a la vez y quedó un ciclo, se deshace este movimiento
  if (hasCycle(await loadNodes(), id)) {
    await CategoryNodeModel.updateOne({ _id: id }, { $set: { parentId: node.parentId ? new Types.ObjectId(node.parentId) : null, slug: node.slug } });
    throw new CategoryError("cycle", "Otra persona movió categorías al mismo tiempo. Recargá y probá de nuevo.");
  }
  // se recalcula siempre, también al "mover" a la misma ubicación: sirve para reparar artículos desactualizados
  await recomputeBranch(id);
  await recordRedirects(before);
}

export async function deleteNode(id: string): Promise<void> {
  const nodes = await loadNodes();
  if (!nodes.some((node) => node.id === id)) throw new CategoryError("not_found", "La categoría no existe.");
  if (nodes.some((node) => node.parentId === id)) throw new CategoryError("has_children", "Tiene subcategorías. Movelas o borralas antes.");
  if (await ProductModel.exists({ categoryId: id })) throw new CategoryError("has_products", "Tiene artículos. Pasalos a otra categoría antes de borrarla.");
  await CategoryNodeModel.deleteOne({ _id: id });
}

/** Pasa todos los artículos de una categoría (y de sus subcategorías) a otra. */
export async function moveProducts(fromId: string, toId: string): Promise<number> {
  const nodes = await loadNodes();
  if (!nodes.some((node) => node.id === fromId) || !nodes.some((node) => node.id === toId)) throw new CategoryError("not_found", "La categoría no existe.");
  if (fromId === toId) return 0;
  return setProductsCategory({ categoryId: { $in: [fromId, ...descendantIds(nodes, fromId)] } }, nodePath(nodes, toId));
}

/** Devuelve el camino de nodos para una lista de nombres, creando los que no existan (sin distinguir tildes ni mayúsculas). */
export async function ensurePath(names: string[], known?: CategoryNodeData[]): Promise<CategoryNodeData[]> {
  const nodes = known ?? (await loadNodes());
  const path: CategoryNodeData[] = [];
  let parentId: string | null = null;
  for (const name of names) {
    let node = findByName(nodes, parentId, name);
    if (!node) {
      try {
        node = await createNode(parentId, name);
        nodes.push(node);
      } catch (error) {
        // otra persona o importación la creó justo antes: se usa esa
        if (!(error instanceof CategoryError) || error.code !== "duplicate") throw error;
        const fresh = await loadNodes();
        node = findByName(fresh, parentId, name);
        if (!node) throw error;
        nodes.splice(0, nodes.length, ...fresh);
      }
    }
    path.push(node);
    parentId = node.id;
  }
  return path;
}

/** Cantidad de artículos por categoría; cada artículo cuenta en todos los niveles de su camino. */
export async function countsByNode(includeInactive: boolean): Promise<Record<string, number>> {
  const match: Record<string, unknown> = { categoryPath: { $exists: true, $ne: [] } };
  if (!includeInactive) match.active = { $ne: false };
  const rows = (await ProductModel.aggregate([{ $match: match }, { $unwind: "$categoryPath" }, { $group: { _id: "$categoryPath", count: { $sum: 1 } } }])) as { _id: Types.ObjectId; count: number }[];
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

export async function categoryFieldsFor(id: string) {
  const path = nodePath(await loadNodes(), id);
  if (path.length === 0) return null;
  return { categoryId: new Types.ObjectId(id), categoryPath: path.map((node) => new Types.ObjectId(node.id)), ...derivedFields(path) };
}

export const legacyProductCount = (): Promise<number> => ProductModel.countDocuments({ categoryId: null });

/** Convierte las categorías planas de hoy al árbol. Se puede repetir sin duplicar nada. */
export async function convertLegacy(): Promise<{ created: number; assigned: number }> {
  const nodes = await loadNodes();
  const before = nodes.length;
  const saved = (await CategoryModel.find().lean()) as unknown as { name: string; subCategories?: string[] }[];
  for (const category of saved) {
    if (validCategoryName(category.name)) await ensurePath([category.name], nodes);
    for (const sub of category.subCategories ?? []) if (validCategoryName(category.name) && validCategoryName(sub)) await ensurePath([category.name, sub], nodes);
  }
  const pairs = (await ProductModel.aggregate([
    { $match: { categoryId: null } },
    { $group: { _id: { category: "$category", subCategory: "$subCategory" } } }
  ])) as { _id: { category?: string; subCategory?: string } }[];
  let assigned = 0;
  for (const pair of pairs) {
    const category = cleanName(pair._id.category ?? "");
    const subCategory = cleanName(pair._id.subCategory ?? "");
    const names = [category, subCategory].filter(Boolean);
    if (names.length === 0 || !names.every(validCategoryName)) continue;
    const path = await ensurePath(names, nodes);
    assigned += await setProductsCategory({ categoryId: null, category: pair._id.category ?? "", subCategory: pair._id.subCategory ? pair._id.subCategory : { $in: ["", null] } }, path);
  }
  return { created: nodes.length - before, assigned };
}

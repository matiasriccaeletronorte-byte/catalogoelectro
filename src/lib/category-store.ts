import { Types } from "mongoose";
import {
  canMove, CategoryNodeData, derivedFields, descendantIds, findByName, nodePath, normalizeName, slugify, uniqueSlug, validCategoryName
} from "@/lib/category-tree";
import { searchTextOf } from "@/lib/product-schema";
import { CategoryModel } from "@/models/Category";
import { CategoryNodeModel } from "@/models/CategoryNode";
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
  if (!validCategoryName(name)) throw new CategoryError("invalid", "El nombre tiene que tener entre 2 y 60 caracteres.");
  const nodes = await loadNodes();
  if (parentId && !nodes.some((node) => node.id === parentId)) throw new CategoryError("not_found", "La categoría padre no existe.");
  if (findByName(nodes, parentId, name)) throw new CategoryError("duplicate", "Ya existe una categoría con ese nombre en ese nivel.");
  const slug = uniqueSlug(slugify(name), nodes.filter((node) => node.parentId === parentId).map((node) => node.slug));
  const doc = await CategoryNodeModel.create({ name, slug, nameKey: normalizeName(name), parentId: parentId ? new Types.ObjectId(parentId) : null });
  return toData(doc.toObject() as unknown as Row);
}

/** Pone categoría, camino y copias derivadas (y el texto de búsqueda) a los artículos que cumplan el filtro. */
async function setProductsCategory(filter: Record<string, unknown>, path: CategoryNodeData[]): Promise<number> {
  if (path.length === 0) return 0;
  const { category, subCategory } = derivedFields(path);
  const ids = path.map((node) => new Types.ObjectId(node.id));
  const leaf = ids[ids.length - 1];
  const rows = (await ProductModel.find(filter).select("sku name brand").lean()) as unknown as { _id: Types.ObjectId; sku?: string; name?: string; brand?: string }[];
  for (let i = 0; i < rows.length; i += 1000) {
    await ProductModel.bulkWrite(rows.slice(i, i + 1000).map((row) => ({
      updateOne: { filter: { _id: row._id }, update: { $set: { categoryId: leaf, categoryPath: ids, category, subCategory, searchText: searchTextOf({ ...row, category, subCategory }) } } }
    })));
  }
  return rows.length;
}

/** Recalcula camino y copias derivadas de todos los artículos de una rama (después de renombrar o mover). */
async function recomputeBranch(nodeId: string): Promise<void> {
  const nodes = await loadNodes();
  for (const id of [nodeId, ...descendantIds(nodes, nodeId)]) await setProductsCategory({ categoryId: id }, nodePath(nodes, id));
}

export async function renameNode(id: string, rawName: string): Promise<void> {
  const name = cleanName(rawName);
  if (!validCategoryName(name)) throw new CategoryError("invalid", "El nombre tiene que tener entre 2 y 60 caracteres.");
  const nodes = await loadNodes();
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new CategoryError("not_found", "La categoría no existe.");
  const clash = findByName(nodes, node.parentId, name);
  if (clash && clash.id !== id) throw new CategoryError("duplicate", "Ya existe una categoría con ese nombre en ese nivel.");
  const slug = uniqueSlug(slugify(name), nodes.filter((item) => item.parentId === node.parentId && item.id !== id).map((item) => item.slug));
  await CategoryNodeModel.updateOne({ _id: id }, { $set: { name, slug, nameKey: normalizeName(name) } });
  await recomputeBranch(id);
}

export async function moveNode(id: string, newParentId: string | null): Promise<void> {
  const nodes = await loadNodes();
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new CategoryError("not_found", "La categoría no existe.");
  if (!canMove(nodes, id, newParentId)) throw new CategoryError("cycle", "No se puede mover una categoría dentro de sí misma ni de sus subcategorías.");
  if (node.parentId === newParentId) return;
  const clash = findByName(nodes, newParentId, node.name);
  if (clash && clash.id !== id) throw new CategoryError("duplicate", "El destino ya tiene una categoría con ese nombre.");
  const slug = uniqueSlug(node.slug, nodes.filter((item) => item.parentId === newParentId && item.id !== id).map((item) => item.slug));
  await CategoryNodeModel.updateOne({ _id: id }, { $set: { parentId: newParentId ? new Types.ObjectId(newParentId) : null, slug } });
  await recomputeBranch(id);
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
      node = await createNode(parentId, name);
      nodes.push(node);
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

import { unstable_cache } from "next/cache";
import { countsByNode, loadNodes } from "@/lib/category-store";
import { buildMenuTree } from "@/lib/category-tree";
import { connectDb } from "@/lib/db";

/** Árbol del menú (solo categorías con artículos). Se guarda 60 segundos y se renueva solo al editar categorías en el admin. */
export const getMenuTree = unstable_cache(
  async () => {
    await connectDb();
    const [nodes, counts] = await Promise.all([loadNodes(), countsByNode(false)]);
    return buildMenuTree(nodes, counts);
  },
  ["menu-tree"],
  { revalidate: 60, tags: ["category-tree"] }
);

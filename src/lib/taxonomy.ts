import { BrandModel } from "@/models/Brand";
import { ProductModel } from "@/models/Product";
import { searchTextOf } from "@/lib/product-schema";

type Field = "category" | "brand";

/** Cambia el nombre de una categoría o marca en todos los artículos y recalcula su texto de búsqueda. */
export async function renameInProducts(field: Field, from: string, to: string): Promise<number> {
  const rows = (await ProductModel.find({ [field]: from }).select("sku name brand category subCategory").lean()) as unknown as { _id: unknown; sku?: string; name?: string; brand?: string; category?: string; subCategory?: string }[];
  if (rows.length === 0) return 0;
  await ProductModel.bulkWrite(rows.map((row) => ({
    updateOne: { filter: { _id: row._id }, update: { $set: { [field]: to, searchText: searchTextOf({ ...row, [field]: to }) } } }
  })));
  return rows.length;
}

/** Elimina una marca. Si tiene artículos, solo lo hace con confirmación y los deja sin marca (no se borran). */
export async function removeBrand(name: string, clearArticles: boolean): Promise<{ ok: true; cleared: number } | { ok: false; count: number }> {
  const count = await ProductModel.countDocuments({ brand: name });
  if (count > 0 && !clearArticles) return { ok: false, count };
  const cleared = count > 0 ? await renameInProducts("brand", name, "") : 0;
  await BrandModel.deleteOne({ name });
  return { ok: true, cleared };
}

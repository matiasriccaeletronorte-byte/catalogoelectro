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

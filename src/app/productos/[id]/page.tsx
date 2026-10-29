import { notFound } from "next/navigation";
import { connectDb } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { ProductDetail } from "@/components/product-detail";
import { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDb();
  let record: Record<string, unknown> | null = null;
  try {
    record = await ProductModel.findOne({ _id: id, active: { $ne: false }, stock: { $gt: 0 } }).lean() as unknown as Record<string, unknown> | null;
  } catch {
    notFound();
  }
  if (!record) notFound();
  const { _id, ...data } = record;
  return <ProductDetail product={{ ...(data as Omit<Product, "id">), id: String(_id) }} />;
}

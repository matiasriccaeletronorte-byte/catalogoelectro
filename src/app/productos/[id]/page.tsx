import { notFound } from "next/navigation";
import { connectDb } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { ProductDetail } from "@/components/product-detail";
import { toPublicProduct } from "@/lib/catalog-query";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectDb();
  let record: Record<string, unknown> | null = null;
  try {
    record = await ProductModel.findOne({ _id: id, active: { $ne: false } }).lean() as unknown as Record<string, unknown> | null;
  } catch {
    notFound();
  }
  if (!record) notFound();
  return <ProductDetail product={toPublicProduct(record)} />;
}

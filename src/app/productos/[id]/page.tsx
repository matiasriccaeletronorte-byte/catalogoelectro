import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { connectDb } from "@/lib/db";
import { ProductModel } from "@/models/Product";
import { ProductDetail } from "@/components/product-detail";
import { JsonLd } from "@/components/json-ld";
import { toPublicProduct } from "@/lib/catalog-query";
import { absoluteUrl, breadcrumbJsonLd, clip, productJsonLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const loadProduct = cache(async (id: string): Promise<Product | null> => {
  await connectDb();
  try {
    const record = await ProductModel.findOne({ _id: id, active: { $ne: false } }).lean() as unknown as Record<string, unknown> | null;
    return record ? toPublicProduct(record) : null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const product = await loadProduct((await params).id);
  if (!product) return { title: "Producto no encontrado", robots: { index: false } };
  const base = siteUrl();
  const title = [product.name, product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? product.brand : ""].filter(Boolean).join(" · ");
  const description = clip(`${product.name}${product.sku ? ` (código ${product.sku})` : ""}. ${product.description || ""} Consultá precio en efectivo, cuotas y disponibilidad por WhatsApp.`, 158);
  const image = [product.images?.[0], product.image].find((item) => /^https?:\/\/|^\//.test(item ?? ""));
  return {
    title,
    description,
    alternates: { canonical: `/productos/${product.id}` },
    openGraph: { type: "website", title, description, url: `${base}/productos/${product.id}`, ...(image ? { images: [absoluteUrl(base, image)] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description }
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const product = await loadProduct((await params).id);
  if (!product) notFound();
  const base = siteUrl();
  return <>
    <JsonLd data={productJsonLd(product, base)} />
    <JsonLd data={breadcrumbJsonLd(base, [{ name: "Inicio", path: "/" }, { name: product.category, path: `/catalogo?category=${encodeURIComponent(product.category)}` }, { name: product.name, path: `/productos/${product.id}` }])} />
    <ProductDetail product={product} />
  </>;
}

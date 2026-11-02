import type { Branch } from "./branches";
import type { Product } from "./types";

export const SITE_NAME = "Electronorte";

export const clip = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

export const absoluteUrl = (base: string, path: string) => (/^https?:\/\//.test(path) ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`);

export function productJsonLd(product: Product, base: string) {
  const images = (product.images?.length ? product.images : [product.image]).filter((image) => /^https?:\/\/|^\//.test(image ?? "")).map((image) => absoluteUrl(base, image));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: clip(product.description || product.name, 500),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    category: product.category,
    ...(images.length ? { image: images } : {}),
    offers: {
      "@type": "Offer",
      url: `${base}/productos/${product.id}`,
      priceCurrency: "ARS",
      price: product.listPrice,
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE_NAME }
    }
  };
}

export function breadcrumbJsonLd(base: string, trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: `${base}${item.path}` }))
  };
}

export function storeJsonLd(base: string, branches: Branch[], phone: string) {
  const [city, region] = (branches[0]?.city ?? "Los Polvorines, Buenos Aires").split(",").map((part) => part.trim());
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: base,
    logo: `${base}/electronorte-white-red.png`,
    ...(phone ? { telephone: `+${phone.replace(/\D/g, "")}` } : {}),
    subOrganization: branches.map((branch) => ({
      "@type": "ElectronicsStore",
      name: `${SITE_NAME} ${branch.name}`,
      telephone: branch.phone,
      address: { "@type": "PostalAddress", streetAddress: branch.name, addressLocality: branch.city.split(",")[0]?.trim() || city, addressRegion: region ?? "Buenos Aires", addressCountry: "AR" }
    }))
  };
}

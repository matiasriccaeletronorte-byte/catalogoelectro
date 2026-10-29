export const DEFAULT_TEMPLATE = "Hola, quiero consultar por {nombre} (código {sku}) – {link}";

export function buildWhatsappUrl(phone: string, template: string, vars: { name: string; sku?: string; link: string }): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  let text = template || DEFAULT_TEMPLATE;
  if (!vars.sku) text = text.replace(/\s*\(código \{sku\}\)/, "").replace("{sku}", "");
  text = text.replace("{nombre}", vars.name).replace("{sku}", vars.sku ?? "").replace("{link}", vars.link);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`;
}

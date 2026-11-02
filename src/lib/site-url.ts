/** URL pública del sitio, sin barra final. Se puede fijar con NEXT_PUBLIC_SITE_URL (por ejemplo al tener dominio propio). */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "http://localhost:3000";
  const url = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return url.replace(/\/+$/, "");
}

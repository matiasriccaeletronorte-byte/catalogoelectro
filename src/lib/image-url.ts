/** Convierte enlaces compartidos de Google Drive en una URL que puede usarse en una etiqueta <img>. */
export function normalizeImageUrl(value: string, width = 1200) {
  const url = value.trim();
  if (!url) return "";
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  const idMatch = url.match(/[?&]id=([^&#]+)/i);
  const contentMatch = url.match(/googleusercontent\.com\/d\/([^=/?#]+)/i);
  const fileId = fileMatch?.[1] ?? idMatch?.[1] ?? contentMatch?.[1];
  return fileId ? `/api/images/google-drive/${fileId}?w=${width}` : url;
}

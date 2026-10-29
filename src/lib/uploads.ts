import path from "path";

// Vercel rechaza pedidos de más de ~4,5 MB, así que el tope va por debajo.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const extensionFor = (mime: string): string | null => EXT[mime] ?? null;
export const isSafeUploadName = (name: string): boolean => /^[a-f0-9]{24}-\d{10,16}\.(jpg|png|webp)$/.test(name);
export const uploadDir = (): string => path.resolve(process.env.UPLOAD_DIR || "./uploads");
export const isObjectId = (value: string): boolean => /^[a-f0-9]{24}$/.test(value);
export const MAX_IMAGES_PER_PRODUCT = 10;

/** Detecta el tipo real de la imagen por sus primeros bytes, sin confiar en el tipo que declara el cliente. */
export function detectImageType(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

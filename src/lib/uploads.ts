import path from "path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const extensionFor = (mime: string): string | null => EXT[mime] ?? null;
export const isSafeUploadName = (name: string): boolean => /^[a-f0-9]{24}-\d{10,16}\.(jpg|png|webp)$/.test(name);
export const uploadDir = (): string => path.resolve(process.env.UPLOAD_DIR || "./uploads");

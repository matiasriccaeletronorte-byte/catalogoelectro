export const MAX_IMAGES_PER_PRODUCT = 10;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** Reparte una selección de archivos: cuáles se suben, cuáles no caben en el máximo y cuáles no son JPG, PNG o WebP. */
export function planUploads<T extends { name: string; type: string }>(files: T[], currentCount: number, max = MAX_IMAGES_PER_PRODUCT) {
  const valid = files.filter((file) => ALLOWED.includes(file.type));
  const room = Math.max(0, max - currentCount);
  return {
    accepted: valid.slice(0, room),
    overLimit: Math.max(0, valid.length - room),
    wrongType: files.filter((file) => !ALLOWED.includes(file.type)).map((file) => file.name)
  };
}

import sharp from "sharp";

export const MAX_IMAGE_WIDTH = 1200;

/** Achica la foto a 1200 px de ancho máximo (o `maxWidth`), la pasa a WebP y le saca los metadatos. Falla si no es una imagen. */
export async function processImage(input: Buffer, maxWidth = MAX_IMAGE_WIDTH): Promise<Buffer> {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

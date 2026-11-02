/** Deja lista la URL de una imagen para usarla en una etiqueta <img>. Las imágenes se suben desde el panel, no se enlazan desde servicios externos. */
export function normalizeImageUrl(value: string, _width = 1200) {
  return value.trim();
}

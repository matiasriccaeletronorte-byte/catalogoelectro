/** Imagen del banner para cada pantalla. Si falta una, se usa la otra; sin ninguna, el banner no lleva foto. */
export function slideImages(slide: { image?: string; mobileImage?: string }): { desktop: string; mobile: string } {
  const desktop = slide.image || slide.mobileImage || "";
  const mobile = slide.mobileImage || slide.image || "";
  return { desktop, mobile };
}

// Árbol de categorías propuesto. Convierte las categorías planas que arma el convertidor en caminos de varios niveles.
// El usuario lo revisa en el informe antes de importar y después lo corrige desde el admin.

export const RUTA_POR_CATEGORIA = {
  "Aires acondicionados": ["Climatización", "Aires acondicionados"],
  "Calefacción": ["Climatización", "Calefacción"],
  "Ventiladores": ["Climatización", "Ventiladores"],
  "Climatización": ["Climatización"],

  "Heladeras y freezers": ["Línea blanca", "Heladeras y freezers"],
  "Lavarropas": ["Línea blanca", "Lavarropas"],
  "Cocinas y hornos": ["Línea blanca", "Cocinas y hornos"],
  "Microondas": ["Línea blanca", "Microondas"],
  "Termotanques": ["Línea blanca", "Termotanques"],

  "Pequeños electrodomésticos": ["Pequeños electrodomésticos"],
  "Planchas": ["Pequeños electrodomésticos", "Planchas"],
  "Aspiradoras y limpieza": ["Pequeños electrodomésticos", "Aspiradoras y limpieza"],

  "Televisores": ["TV, audio y tecnología", "Televisores"],
  "Audio": ["TV, audio y tecnología", "Audio"],
  "Informática": ["TV, audio y tecnología", "Informática"],
  "Celulares": ["TV, audio y tecnología", "Celulares"],

  "Bazar": ["Hogar", "Bazar"],
  "Muebles": ["Hogar", "Muebles"],
  "Textil y blanco": ["Hogar", "Textil y blanco"],
  "Iluminación": ["Hogar", "Iluminación"],

  "Cuidado personal": ["Belleza y cuidado personal"],

  "Herramientas": ["Herramientas y jardín", "Herramientas"],
  "Jardín, playa y camping": ["Herramientas y jardín", "Jardín, playa y camping"],

  "Bebés y niños": ["Bebés, niños y juegos", "Bebés y niños"],
  "Juguetes": ["Bebés, niños y juegos", "Juguetes"],

  "Bicicletas y rodados": ["Movilidad", "Bicicletas y rodados"],
  "Motos": ["Movilidad", "Motos"],

  "Otros": ["Otros"]
};

const sinTildes = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Camino propuesto para un artículo: por su categoría plana y, en los aires acondicionados, por palabras del nombre. */
export function rutaDe(categoriaPlana, nombre) {
  const base = RUTA_POR_CATEGORIA[categoriaPlana] ?? [categoriaPlana];
  if (categoriaPlana === "Aires acondicionados") {
    const texto = sinTildes(nombre);
    if (/\bsplit\b/.test(texto)) return [...base, "Split"];
    if (/\bportatil\b/.test(texto)) return [...base, "Portátil"];
    if (/\bventana\b/.test(texto)) return [...base, "Ventana"];
  }
  return base;
}

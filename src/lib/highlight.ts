export type TextPart = { text: string; match: boolean };

const fold = (value: string) => [...value].map((char) => char.normalize("NFD").replace(/[̀-ͯ]/g, "")).join("").toLowerCase();

/** Parte un texto en tramos para marcar las palabras buscadas, sin distinguir mayúsculas ni tildes. */
export function highlightParts(text: string, query: string): TextPart[] {
  const words = [...new Set(fold(query).split(/\s+/).filter((word) => word.length > 0))].slice(0, 6);
  if (words.length === 0 || !text) return [{ text, match: false }];
  const folded = fold(text);
  const marked = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    let from = 0;
    for (let at = folded.indexOf(word, from); at !== -1; at = folded.indexOf(word, from)) {
      for (let i = at; i < at + word.length; i++) marked[i] = true;
      from = at + word.length;
    }
  }
  const parts: TextPart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += text[i];
    else parts.push({ text: text[i], match: marked[i] });
  }
  return parts;
}

/** Recuadro para artículos sin foto: un ícono liso en lugar de un emoji. */
export function ImagePlaceholder({ label = "Sin foto" }: { label?: string }) {
  return <span className="image-placeholder" role="img" aria-label={label}>
    <svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="9" width="36" height="30" rx="5" />
      <circle cx="17" cy="20" r="3.5" />
      <path d="M6 33l10-9 8 7 6-5 12 10" />
    </svg>
  </span>;
}

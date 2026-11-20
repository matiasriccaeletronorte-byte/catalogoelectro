import Link from "next/link";

export type Crumb = { name: string; href?: string };

export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return <nav className="product-breadcrumb" aria-label="Migas de pan">
    {trail.map((crumb, index) => <span className="crumb" key={`${crumb.name}-${index}`}>
      {crumb.href ? <Link href={crumb.href}>{crumb.name}</Link> : <b>{crumb.name}</b>}
      {index < trail.length - 1 ? <span aria-hidden="true">›</span> : null}
    </span>)}
  </nav>;
}

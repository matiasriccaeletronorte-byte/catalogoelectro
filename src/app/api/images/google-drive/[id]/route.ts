import { NextResponse } from "next/server";

const validId = /^[A-Za-z0-9_-]{10,}$/;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId.test(id)) return NextResponse.json({ error: "Archivo de Drive inválido" }, { status: 400 });
  const width = Math.min(Math.max(Number(new URL(request.url).searchParams.get("w")) || 1200, 200), 2400);
  const response = await fetch(`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`, { redirect: "follow", next: { revalidate: 86400 } });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.startsWith("image/")) return NextResponse.json({ error: "No se pudo obtener la imagen de Drive. Verificá que sea pública." }, { status: 404 });
  return new Response(response.body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400" } });
}

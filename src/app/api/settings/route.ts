import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings";

export async function GET() {
  const response = NextResponse.json(await getSiteSettings());
  response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return response;
}

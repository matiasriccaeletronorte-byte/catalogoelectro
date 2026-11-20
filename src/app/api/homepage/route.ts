import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { getHomepageSettings } from "@/lib/homepage-settings";

export async function GET() {
  await connectDb();
  return NextResponse.json(await getHomepageSettings());
}

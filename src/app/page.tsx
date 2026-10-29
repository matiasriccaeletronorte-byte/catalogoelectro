import { HomePage } from "@/components/home-page";
import { connectDb } from "@/lib/db";
import { buildHomeShelves } from "@/lib/home-shelves";

export const dynamic = "force-dynamic";

export default async function Page() {
  await connectDb();
  return <HomePage shelves={await buildHomeShelves()} />;
}

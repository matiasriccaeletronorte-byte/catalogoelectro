import { HomePage } from "@/components/home-page";
import { JsonLd } from "@/components/json-ld";
import { storeJsonLd } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { siteUrl } from "@/lib/site-url";
import { connectDb } from "@/lib/db";
import { buildHomeShelves } from "@/lib/home-shelves";

export const dynamic = "force-dynamic";

export default async function Page() {
  await connectDb();
  const [shelves, settings] = await Promise.all([buildHomeShelves(), getSiteSettings()]);
  return <>
    <JsonLd data={storeJsonLd(siteUrl(), settings.branches, settings.whatsappPhone)} />
    <HomePage shelves={shelves} />
  </>;
}

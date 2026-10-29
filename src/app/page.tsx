import { HomePage } from "@/components/home-page";

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{
    q?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const initialQuery = typeof params.q === "string" ? params.q : "";
  return <HomePage initialQuery={initialQuery} />;
}

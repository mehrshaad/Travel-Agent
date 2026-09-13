import { PlaceDetail } from "@/components/PlaceDetail";

export const dynamic = "force-dynamic";

/**
 * Thin wrapper: the traveller's plan lives in the browser, so resolving a slug has to
 * happen there too. Rendering this on the server 404'd every real stop, because the
 * server only ever knew the seeded Montreal lists.
 */
export default async function PlaceBySlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PlaceDetail slug={slug} />;
}

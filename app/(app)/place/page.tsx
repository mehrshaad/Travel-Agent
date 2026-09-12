import { redirect } from "next/navigation";

/**
 * This screen was a hardcoded Librairie Bertrand copy of /place/[slug], reachable from
 * nothing. Its gallery and directions link now live on the real page; the route stays
 * so older links keep working.
 */
export default function PlaceIndex() {
  redirect("/place/librairie-bertrand");
}

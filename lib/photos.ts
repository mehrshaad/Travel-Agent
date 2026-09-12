/**
 * Photos for every place the UI names.
 *
 * All files are real photographs pulled from Wikimedia Commons under reusable
 * licences (see lib/photo-manifest.json for per-file artist + licence, and /credits
 * for the rendered list). Re-fetch with `python3 scripts/fetch-photos.py`.
 *
 * `specific: false` means the photo represents the *category*, not that exact venue —
 * several of these are small businesses with no freely licensed photograph. Those are
 * labelled "representative" on the credits page rather than passed off as the real thing.
 */
import manifest from "./photo-manifest.json";

export interface Photo {
  src: string;
  artist: string;
  license: string;
  source: string;
  specific: boolean;
}

export const PHOTOS = manifest as Record<string, Photo>;

/** Place name (as written in the UI data) -> photo slug. */
const BY_NAME: Record<string, string> = {
  "Pointe-à-Callière": "pointe-a-calliere",
  "Librairie Bertrand": "bookstore",
  "Café Tehran": "persian-food",
  "Château Ramezay": "chateau-ramezay",
  "Jean-Talon Market": "jean-talon-market",
  "Drawn & Quarterly": "drawn-quarterly",
  "Bota Bota spa": "bota-bota",
  "Casino de Montréal": "casino-montreal",
  "Auberge du Vieux-Port": "auberge-vieux-port",
  "Hôtel Gault": "hotel-gault",
  "Loft · Griffintown": "griffintown",
  "HI Montreal hostel": "hostel-dorm",
  "Crew Collective café": "cafe-interior",
  "Crew Collective": "cafe-interior",
  "Schwartz’s Deli": "schwartzs",
  "Habitat 67 walk": "habitat-67",
  "Hôtel Nelligan": "hotel-nelligan",
  "Café Olimpico": "cafe-olimpico",
  "Notre-Dame Basilica": "notre-dame",
  "Mount Royal lookout": "mount-royal",
  "St-Viateur Bagel": "st-viateur",
  "Musée des Beaux-Arts": "mmfa",
  "Mile End record shops": "record-shop",
  "Old Montreal walk": "old-montreal",
  "Old Port stroll": "old-port",
  "Place Jacques-Cartier": "place-jacques-cartier",
  "Damas": "restaurant-table",
  "Le Petit Local": "restaurant-table",
  "Byblos le Petit Café": "persian-food",
  "Kem CoBa": "ice-cream",
};

export function photoFor(name: string): Photo | undefined {
  const slug = BY_NAME[name];
  return slug ? PHOTOS[slug] : undefined;
}

export function photo(slug: string): Photo | undefined {
  return PHOTOS[slug];
}

/** Short credit line, e.g. "Andre Carrotflower · CC BY-SA 4.0". */
export function credit(p: Photo | undefined): string | undefined {
  return p ? `${p.artist} · ${p.license}` : undefined;
}

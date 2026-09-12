import type { Ambience, Interest, PlaceCategory, PlaceSection } from "@/types";

/** OSM selector(s) that identify each category, plus what the category means to us. */
interface CategoryDef {
  selectors: string[];
  section: PlaceSection;
  ambience: Ambience;
  interests: Interest[];
  /** Typical visit length, used by the scheduler. */
  minutes: number;
}

export const CATEGORIES: Partial<Record<PlaceCategory, CategoryDef>> = {
  museum:     { selectors: ['"tourism"="museum"'], section: "explore", ambience: "indoor", interests: ["history", "culture", "art"], minutes: 90 },
  gallery:    { selectors: ['"tourism"="gallery"'], section: "explore", ambience: "indoor", interests: ["art", "culture"], minutes: 60 },
  landmark:   { selectors: ['"tourism"="attraction"'], section: "explore", ambience: "mixed", interests: ["history", "culture"], minutes: 30 },
  historic:   { selectors: ['"historic"'], section: "explore", ambience: "mixed", interests: ["history", "culture"], minutes: 40 },
  park:       { selectors: ['"leisure"="park"'], section: "explore", ambience: "outdoor", interests: ["nature", "walking", "free", "family"], minutes: 45 },
  viewpoint:  { selectors: ['"tourism"="viewpoint"'], section: "explore", ambience: "outdoor", interests: ["nature", "walking", "free"], minutes: 20 },
  bookstore:  { selectors: ['"shop"="books"'], section: "explore", ambience: "indoor", interests: ["books", "culture", "free"], minutes: 45 },
  shopping:   { selectors: ['"shop"="mall"', '"shop"="department_store"'], section: "explore", ambience: "indoor", interests: ["shopping"], minutes: 60 },
  nightlife:  { selectors: ['"amenity"="nightclub"'], section: "explore", ambience: "indoor", interests: ["nightlife"], minutes: 120 },
  restaurant: { selectors: ['"amenity"="restaurant"'], section: "eat", ambience: "indoor", interests: ["food"], minutes: 75 },
  cafe:       { selectors: ['"amenity"="cafe"'], section: "eat", ambience: "indoor", interests: ["coffee", "food"], minutes: 45 },
  bakery:     { selectors: ['"shop"="bakery"'], section: "eat", ambience: "indoor", interests: ["food", "coffee"], minutes: 20 },
  bar:        { selectors: ['"amenity"="bar"', '"amenity"="pub"'], section: "eat", ambience: "indoor", interests: ["nightlife", "food"], minutes: 90 },
  hotel:      { selectors: ['"tourism"="hotel"'], section: "stay", ambience: "indoor", interests: [], minutes: 0 },
  hostel:     { selectors: ['"tourism"="hostel"'], section: "stay", ambience: "indoor", interests: [], minutes: 0 },
  pharmacy:   { selectors: ['"amenity"="pharmacy"'], section: "essentials", ambience: "indoor", interests: [], minutes: 15 },
  grocery:    { selectors: ['"shop"="supermarket"'], section: "essentials", ambience: "indoor", interests: [], minutes: 20 },
  convenience:{ selectors: ['"shop"="convenience"'], section: "essentials", ambience: "indoor", interests: [], minutes: 10 },
  atm:        { selectors: ['"amenity"="atm"'], section: "essentials", ambience: "outdoor", interests: [], minutes: 5 },
  laundry:    { selectors: ['"shop"="laundry"', '"amenity"="laundry"'], section: "essentials", ambience: "indoor", interests: [], minutes: 45 },
  restroom:   { selectors: ['"amenity"="toilets"'], section: "essentials", ambience: "indoor", interests: [], minutes: 5 },
  tourist_info:{ selectors: ['"tourism"="information"'], section: "essentials", ambience: "mixed", interests: ["culture", "free"], minutes: 15 },
};

/** Reverse lookup: an OSM tag bag -> our category. First match wins. */
export function categoryOf(tags: Record<string, string>): PlaceCategory | null {
  for (const [cat, def] of Object.entries(CATEGORIES) as [PlaceCategory, CategoryDef][]) {
    for (const sel of def.selectors) {
      const [k, v] = sel.replace(/"/g, "").split("=");
      if (v === undefined ? tags[k] !== undefined : tags[k] === v) return cat;
    }
  }
  return null;
}

export function defOf(cat: PlaceCategory): CategoryDef {
  return CATEGORIES[cat] ?? { selectors: [], section: "explore", ambience: "mixed", interests: [], minutes: 30 };
}

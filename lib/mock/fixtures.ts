/**
 * Contract-shaped fixtures — valid instances of the types in `types/index.ts`.
 *
 * These are what `?mock=1` serves, and what every `/api/trips/trip_montreal_demo/…`
 * route falls back to, so the demo trip works with no network and no setup. Unlike
 * `lib/mock/ui.ts` (pre-formatted display strings), everything here is domain-shaped:
 * Money objects, ISO datetimes with a real offset, coordinates taken from
 * public/montreal-map.html so the map and the API agree stop for stop.
 *
 * Money convention: every `avgCost` and `estimatedCost` is **per person**, which is what
 * `Place.avgCost` is defined as, and `dailyBudget` is the per-person ceiling the
 * traveller typed. Mixing the two — a party-of-two lunch against a one-person budget —
 * is how the seeded day used to read $64 spent and $108 planned on the same afternoon.
 *
 * Deliberately includes the awkward cases the UI must survive:
 *   - a Place with no rating and no priceLevel (the common OSM case)
 *   - a Place with openingHours.unknown === true
 *   - a negative explanation factor
 */

import type {
  Ambience, BadWeatherWindow, BudgetState, Explanation, ISODate, Interest, Itinerary,
  ItineraryDay, ItineraryItem, LatLng, Money, NowSuggestion, OpeningHours, Place,
  PlaceCategory, PlaceSection, PriceLevel, Recommendation, ReplanEvent, TimeSlot,
  TransportLeg, TransportMode, TransportOption, Trip, UsageMeter, UserProfile,
  WeatherCode, WeatherDay, WeatherForecast, WeatherHour, AgentTrace,
} from "@/types";

const TZ = "-04:00"; // America/Toronto in September
const cad = (amount: number): Money => ({ amount, currency: "CAD" });
const at = (date: string, time: string) => `${date}T${time}:00${TZ}`;

/** The four planned days, in order. Day 2 is the one the seeded copy calls "today". */
const D1 = "2026-09-15"; // Tuesday
const D2 = "2026-09-16"; // Wednesday — rain, and the re-plan
const D3 = "2026-09-17"; // Thursday
const D4 = "2026-09-18"; // Friday

export const TRIP: Trip = {
  id: "trip_montreal_demo",
  name: "Montreal, mostly on foot",
  destination: {
    query: "Montreal, Canada",
    city: "Montréal",
    country: "Canada",
    countryCode: "ca",
    coords: { lat: 45.5017, lng: -73.5673 },
    timezone: "America/Toronto",
  },
  startDate: D1,
  endDate: "2026-09-19",
  travelers: { adults: 2, children: 0 },
  preferences: {
    interests: ["history", "coffee", "books", "food", "walking", "culture"],
    dailyBudget: cad(150),
    pace: "balanced",
    transportModes: ["walk", "transit"],
    maxWalkMeters: 6000,
    minRating: 4.3,
    dietary: [],
    avoid: ["crowds at midday"],
  },
  status: "active",
  createdAt: at("2026-09-13", "19:04"),
};

/* ---------------- Places ---------------- */

interface Seed {
  id: string;
  name: string;
  category: PlaceCategory;
  section: PlaceSection;
  interests: Interest[];
  coords: LatLng;
  address?: string;
  ambience: Ambience;
  rating?: number;
  ratingCount?: number;
  priceLevel?: PriceLevel;
  /** Per person, for a typical visit. */
  cost?: number;
  minutes?: number;
  hours?: OpeningHours;
  /** Slug under /photos — see lib/photo-manifest.json for artist and licence. */
  photo?: string;
  url?: string;
  description: string;
  tags: string[];
  confidence: number;
}

function open(days: number[], opens: string, closes: string, raw: string): OpeningHours {
  return { weekly: days.map((d) => ({ day: d as 0, opens, closes })), raw, unknown: false };
}

/** What OSM gives you most of the time. The UI must say "unknown", never "closed". */
const HOURS_UNKNOWN: OpeningHours = { weekly: [], unknown: true };

const DAILY = [0, 1, 2, 3, 4, 5, 6];
const MON_SAT = [1, 2, 3, 4, 5, 6];

function seed(s: Seed): Place {
  const { cost, minutes, hours, photo, ...rest } = s;
  return {
    ...rest,
    source: s.id.startsWith("exa:") ? "exa" : "osm",
    avgCost: cost === undefined ? undefined : cad(cost),
    durationMinutes: minutes,
    openingHours: hours,
    photoUrl: photo ? `/photos/${photo}.jpg` : undefined,
  };
}

export const PLACES: Place[] = [
  seed({
    id: "osm:way/26721190",
    name: "Montréal–Trudeau (YUL)",
    category: "transit_stop", section: "getAround", interests: [],
    coords: { lat: 45.45773, lng: -73.7496 },
    address: "975 boul. Roméo-Vachon Nord, Dorval",
    ambience: "indoor",
    cost: 11, minutes: 45,
    hours: open(DAILY, "00:00", "24:00", "24/7"),
    description: "The 747 shuttle leaves from the international arrivals kerb and runs all night.",
    tags: ["airport", "bus", "747"],
    confidence: 0.95,
  }),
  seed({
    id: "osm:way/158473021",
    name: "Hôtel Nelligan",
    category: "hotel", section: "stay", interests: ["history"],
    coords: { lat: 45.50478, lng: -73.55372 },
    address: "106 rue Saint-Paul Ouest, Montréal",
    ambience: "indoor",
    rating: 4.6, ratingCount: 2104, priceLevel: 3,
    // Zero, not $186: the room was paid for before the trip, so it never lands on a day.
    cost: 0, minutes: 40,
    hours: open(DAILY, "00:00", "24:00", "24/7"),
    photo: "hotel-nelligan",
    url: "https://hotelnelligan.com/",
    description: "Two stone warehouses on rue Saint-Paul, joined by a glass atrium.",
    tags: ["hotel", "old montreal", "booked"],
    confidence: 0.9,
  }),
  seed({
    id: "osm:way/40213786",
    name: "Old Port stroll",
    category: "landmark", section: "explore", interests: ["walking", "free", "history"],
    coords: { lat: 45.5085, lng: -73.5462 },
    address: "Quai de l'Horloge, Vieux-Port de Montréal",
    ambience: "outdoor",
    rating: 4.7, ratingCount: 18900,
    cost: 0, minutes: 75,
    hours: HOURS_UNKNOWN,
    photo: "old-port",
    description: "A flat 1.4 km along the water from the clock tower back to the basin.",
    tags: ["waterfront", "outdoor", "free"],
    confidence: 0.86,
  }),
  seed({
    id: "osm:node/3901552218",
    name: "Byblos le Petit Café",
    category: "restaurant", section: "eat", interests: ["food"],
    coords: { lat: 45.5335, lng: -73.5822 },
    address: "1499 av. Laurier Est, Montréal",
    ambience: "indoor",
    rating: 4.5, ratingCount: 940, priceLevel: 2,
    cost: 24, minutes: 90,
    hours: open([2, 3, 4, 5, 6, 0], "09:00", "22:00", "Tu-Su 09:00-22:00"),
    photo: "persian-food",
    description: "Persian kitchen on Laurier — omelettes at breakfast, stews at night.",
    tags: ["persian", "restaurant"],
    confidence: 0.84,
  }),
  seed({
    id: "osm:node/1076342266",
    name: "Café Olimpico",
    category: "cafe", section: "eat", interests: ["coffee"],
    coords: { lat: 45.52355, lng: -73.60148 },
    address: "124 rue Saint-Viateur Ouest, Montréal",
    ambience: "indoor",
    rating: 4.6, ratingCount: 5280, priceLevel: 1,
    cost: 6, minutes: 35,
    hours: open(DAILY, "07:00", "19:00", "Mo-Su 07:00-19:00"),
    photo: "cafe-olimpico",
    description: "Pulling shots on Saint-Viateur since 1970; cash and card, no laptops.",
    tags: ["coffee", "mile end"],
    confidence: 0.92,
  }),
  seed({
    id: "osm:way/55362011",
    name: "Place Jacques-Cartier",
    category: "landmark", section: "explore", interests: ["history", "walking", "free"],
    coords: { lat: 45.5075, lng: -73.5533 },
    address: "Place Jacques-Cartier, Vieux-Montréal",
    ambience: "outdoor",
    rating: 4.5, ratingCount: 14200,
    cost: 0, minutes: 90,
    hours: HOURS_UNKNOWN,
    photo: "place-jacques-cartier",
    description: "The sloping square at the centre of Old Montreal; the self-guided 2.1 km loop starts here.",
    tags: ["square", "outdoor", "free"],
    confidence: 0.88,
  }),
  seed({
    id: "osm:way/25998747",
    name: "Notre-Dame Basilica",
    category: "historic", section: "explore", interests: ["history", "culture", "art"],
    coords: { lat: 45.5045, lng: -73.5563 },
    address: "110 rue Notre-Dame Ouest, Montréal",
    ambience: "indoor",
    rating: 4.8, ratingCount: 41300, priceLevel: 2,
    cost: 16, minutes: 60,
    hours: open(MON_SAT, "09:00", "16:30", "Mo-Sa 09:00-16:30"),
    photo: "notre-dame",
    url: "https://www.basiliquenotredame.ca/",
    description: "1829 Gothic Revival interior in blue and gold, with timed entry all day.",
    tags: ["church", "indoor", "ticketed"],
    confidence: 0.94,
  }),
  seed({
    id: "osm:node/2215530918",
    name: "Café Tehran",
    category: "restaurant", section: "eat", interests: ["food", "coffee"],
    coords: { lat: 45.5248, lng: -73.5948 },
    address: "5065 boul. Saint-Laurent, Montréal",
    ambience: "indoor",
    rating: 4.5, ratingCount: 402, priceLevel: 2,
    cost: 22, minutes: 75,
    hours: open(MON_SAT, "11:30", "22:00", "Mo-Sa 11:30-22:00"),
    photo: "persian-food",
    description: "Persian kitchen; the ghormeh sabzi is the dish locals name.",
    tags: ["persian", "restaurant"],
    confidence: 0.86,
  }),
  seed({
    id: "osm:way/29938741",
    name: "Pointe-à-Callière",
    category: "museum", section: "explore", interests: ["history", "culture"],
    coords: { lat: 45.5023, lng: -73.5542 },
    address: "350 Place Royale, Montréal",
    ambience: "indoor",
    rating: 4.6, ratingCount: 6120, priceLevel: 2,
    cost: 26, minutes: 90,
    hours: open(DAILY, "10:00", "17:00", "Mo-Su 10:00-17:00"),
    photo: "pointe-a-calliere",
    url: "https://pacmusee.qc.ca/",
    description: "Archaeology museum built on the actual founding site of the city.",
    tags: ["museum", "archaeology", "indoor"],
    confidence: 0.9,
  }),
  seed({
    id: "osm:node/4410882931",
    name: "Librairie Bertrand",
    category: "bookstore", section: "explore", interests: ["books", "culture"],
    coords: { lat: 45.5016, lng: -73.5568 },
    address: "430 rue Saint-Pierre, Montréal",
    ambience: "indoor",
    // No rating and no priceLevel — this is what OSM actually gives you most of the time.
    // The UI must render this without inventing a score or showing 0 stars.
    cost: 0, minutes: 45,
    hours: HOURS_UNKNOWN,
    photo: "bookstore",
    description: "Independent bookstore in Old Montreal.",
    tags: ["books", "indoor", "free"],
    confidence: 0.62,
  }),
  seed({
    id: "osm:node/4922100371",
    name: "Damas",
    category: "restaurant", section: "eat", interests: ["food", "culture"],
    coords: { lat: 45.5203, lng: -73.6128 },
    address: "1201 av. Van Horne, Outremont",
    ambience: "indoor",
    rating: 4.6, ratingCount: 1870, priceLevel: 3,
    cost: 38, minutes: 120,
    hours: open(DAILY, "17:00", "23:00", "Mo-Su 17:00-23:00"),
    photo: "restaurant-table",
    description: "Syrian dining room in Outremont — the one splurge of the trip.",
    tags: ["levantine", "restaurant", "reserved"],
    confidence: 0.88,
  }),
  seed({
    id: "osm:way/55123301",
    name: "Mount Royal lookout",
    category: "viewpoint", section: "explore", interests: ["nature", "walking", "free"],
    coords: { lat: 45.5045, lng: -73.5873 },
    address: "Belvédère Kondiaronk, Parc du Mont-Royal",
    ambience: "outdoor",
    rating: 4.8, ratingCount: 21400,
    cost: 0, minutes: 120,
    hours: HOURS_UNKNOWN,
    photo: "mount-royal",
    description: "The city's best-known lookout, a 3.1 km climb from downtown.",
    tags: ["park", "viewpoint", "outdoor", "free"],
    confidence: 0.88,
  }),
  seed({
    id: "osm:node/1391052258",
    name: "St-Viateur Bagel",
    category: "bakery", section: "eat", interests: ["food"],
    coords: { lat: 45.5225, lng: -73.6042 },
    address: "263 rue Saint-Viateur Ouest, Montréal",
    ambience: "indoor",
    rating: 4.7, ratingCount: 9400, priceLevel: 1,
    cost: 8, minutes: 30,
    hours: open(DAILY, "00:00", "24:00", "24/7"),
    photo: "st-viateur",
    description: "Wood-fired bagels since 1957, twenty-four hours a day. Cash only.",
    tags: ["bagel", "cash only"],
    confidence: 0.93,
  }),
  seed({
    id: "osm:node/3611720544",
    name: "Drawn & Quarterly",
    category: "bookstore", section: "explore", interests: ["books", "culture"],
    coords: { lat: 45.5231, lng: -73.5944 },
    address: "211 rue Bernard Ouest, Montréal",
    ambience: "indoor",
    rating: 4.8, ratingCount: 1310, priceLevel: 2,
    cost: 30, minutes: 60,
    hours: open(DAILY, "10:00", "20:00", "Mo-Su 10:00-20:00"),
    photo: "drawn-quarterly",
    description: "The comics publisher's own shop, and the reason half of Mile End reads.",
    tags: ["books", "indoor"],
    confidence: 0.9,
  }),
  seed({
    id: "osm:way/32152301",
    name: "Jean-Talon Market",
    category: "shopping", section: "explore", interests: ["food", "walking"],
    coords: { lat: 45.5366, lng: -73.6147 },
    address: "7070 av. Henri-Julien, Montréal",
    ambience: "mixed",
    rating: 4.7, ratingCount: 24800, priceLevel: 1,
    // Covered aisles, open sides: rain does not cancel it, so it is not weather-sensitive.
    cost: 14, minutes: 90,
    hours: open(DAILY, "07:00", "18:00", "Mo-Su 07:00-18:00"),
    photo: "jean-talon-market",
    description: "North America's largest open-air market, under a permanent roof.",
    tags: ["market", "covered", "food"],
    confidence: 0.91,
  }),
  seed({
    id: "osm:node/4102668311",
    name: "Le Petit Local",
    category: "restaurant", section: "eat", interests: ["food"],
    coords: { lat: 45.4737, lng: -73.6044 },
    address: "5478 rue Notre-Dame Ouest, Saint-Henri",
    ambience: "indoor",
    rating: 4.5, ratingCount: 620, priceLevel: 2,
    cost: 29, minutes: 120,
    hours: open([3, 4, 5, 6], "17:30", "22:00", "We-Sa 17:30-22:00"),
    photo: "restaurant-table",
    description: "Small Saint-Henri room doing a set market menu most nights.",
    tags: ["local", "restaurant"],
    confidence: 0.7,
  }),
  seed({
    id: "osm:way/19894823",
    name: "Musée des Beaux-Arts",
    category: "museum", section: "explore", interests: ["art", "culture"],
    coords: { lat: 45.4986, lng: -73.5795 },
    address: "1380 rue Sherbrooke Ouest, Montréal",
    ambience: "indoor",
    rating: 4.7, ratingCount: 15600, priceLevel: 2,
    cost: 24, minutes: 120,
    hours: open([2, 3, 4, 5, 6, 0], "10:00", "17:00", "Tu-Su 10:00-17:00"),
    photo: "mmfa",
    url: "https://www.mbam.qc.ca/",
    description: "Five pavilions on Sherbrooke; the Canadian wing is the one to keep time for.",
    tags: ["museum", "art", "indoor"],
    confidence: 0.92,
  }),
  seed({
    id: "osm:node/5127740183",
    name: "Kem CoBa",
    category: "cafe", section: "eat", interests: ["food"],
    coords: { lat: 45.5199, lng: -73.5936 },
    address: "60 av. Fairmount Ouest, Montréal",
    ambience: "indoor",
    rating: 4.6, ratingCount: 3100, priceLevel: 1,
    cost: 9, minutes: 30,
    hours: open([2, 3, 4, 5, 6, 0], "11:00", "22:00", "Tu-Su 11:00-22:00"),
    photo: "ice-cream",
    description: "Soft serve on Fairmount; the queue moves and the flavours change weekly.",
    tags: ["ice cream", "cheap"],
    confidence: 0.85,
  }),
  seed({
    id: "osm:node/6690214417",
    name: "Mile End record shops",
    category: "shopping", section: "explore", interests: ["shopping", "culture", "walking"],
    coords: { lat: 45.5233, lng: -73.5949 },
    address: "boul. Saint-Laurent between Fairmount and Bernard",
    ambience: "indoor",
    rating: 4.4, ratingCount: 460, priceLevel: 2,
    cost: 20, minutes: 90,
    hours: open(DAILY, "11:00", "19:00", "Mo-Su 11:00-19:00"),
    photo: "record-shop",
    description: "Four second-hand shops inside three blocks of Saint-Laurent.",
    tags: ["records", "shopping"],
    confidence: 0.6,
  }),
  seed({
    id: "osm:way/25998747#aura",
    name: "Notre-Dame · AURA show",
    category: "event", section: "explore", interests: ["art", "culture"],
    coords: { lat: 45.5045, lng: -73.5563 },
    address: "110 rue Notre-Dame Ouest, Montréal",
    ambience: "indoor",
    rating: 4.6, ratingCount: 7800, priceLevel: 2,
    cost: 32, minutes: 75,
    hours: open([1, 2, 3, 4, 5, 6], "18:00", "21:00", "Mo-Sa 18:00-21:00"),
    photo: "notre-dame",
    url: "https://www.aurabasiliquemontreal.com/",
    description: "The basilica's own light and sound piece, played on the vaults after closing.",
    tags: ["show", "evening", "indoor"],
    confidence: 0.82,
  }),
  seed({
    id: "exa:9d1f4c2a8b",
    name: "Bota Bota spa",
    category: "landmark", section: "explore", interests: ["culture"],
    coords: { lat: 45.4981, lng: -73.5522 },
    address: "358 rue de la Commune Ouest, Montréal",
    ambience: "indoor",
    rating: 4.5, priceLevel: 3,
    cost: 60, minutes: 150,
    hours: HOURS_UNKNOWN,
    photo: "bota-bota",
    description: "Spa on a moored ferry in the Old Port.",
    tags: ["spa", "indoor"],
    confidence: 0.55,
  }),
];

const byName = (name: string) => PLACES.find((p) => p.name === name)!;

/* ---------------- Weather ---------------- */

/** [precipitationChance, precipitationMm] for the hours that are not plain. */
type WetHours = Record<number, [number, number]>;

function codeFor(chance: number, mm: number): WeatherCode {
  if (mm > 2) return "heavy_rain";
  if (mm > 0) return "rain";
  return chance > 35 ? "cloudy" : "clear";
}

/**
 * A day of hourly weather from a min/max curve: coldest before sunrise, warmest mid
 * afternoon. Written rather than sampled so the four days differ from each other — a
 * flat 21°C across the trip made Nimbus's rain window look like the only fact it had.
 */
function hoursFor(date: ISODate, min: number, max: number, wet: WetHours = {}): WeatherHour[] {
  return Array.from({ length: 24 }, (_, h) => {
    const curve = Math.max(0, Math.sin(((h - 5) / 19) * Math.PI));
    const tempC = Math.round(min + (max - min) * curve);
    const [chance, mm] = wet[h] ?? [8, 0];
    return {
      time: at(date, `${String(h).padStart(2, "0")}:00`),
      tempC,
      feelsLikeC: tempC - 1,
      precipitationMm: mm,
      precipitationChance: chance,
      windKph: 11,
      code: codeFor(chance, mm),
      outdoorFriendly: chance < 50 && mm < 0.5,
    };
  });
}

function day(
  date: ISODate,
  min: number,
  max: number,
  code: WeatherCode,
  chance: number,
  sunrise: string,
  sunset: string,
  wet: WetHours = {},
  badWindows: BadWeatherWindow[] = [],
): WeatherDay {
  return {
    date,
    minTempC: min,
    maxTempC: max,
    code,
    precipitationChance: chance,
    sunrise: at(date, sunrise),
    sunset: at(date, sunset),
    hours: hoursFor(date, min, max, wet),
    badWindows,
  };
}

export const BAD_WINDOW: BadWeatherWindow = {
  from: at(D2, "15:00"),
  to: at(D2, "17:00"),
  code: "heavy_rain",
  reason: "Heavy rain 15:00–17:00, 82% confidence",
  severity: "moderate",
};

const SEP15 = day(D1, 15, 23, "clear", 10, "06:30", "19:09");
const SEP16 = day(
  D2, 14, 22, "rain", 82, "06:32", "19:06",
  { 14: [55, 0.4], 15: [82, 3.1], 16: [82, 2.8], 17: [55, 0.4] },
  [BAD_WINDOW],
);
const SEP17 = day(D3, 12, 19, "clear", 8, "06:33", "19:04");
const SEP18 = day(D4, 13, 20, "cloudy", 30, "06:34", "19:02");

export const FORECAST: WeatherForecast = {
  tripId: TRIP.id,
  days: [SEP15, SEP16, SEP17, SEP18],
  fetchedAt: at(D2, "14:28"),
  source: "open_meteo",
};

/* ---------------- Explanations ---------------- */

function why(text: string, agent: Explanation["agent"], factors: Explanation["factors"]): Explanation {
  return { text, agent, factors };
}

/* ---------------- Transport ---------------- */

function option(
  mode: TransportOption["mode"],
  minutes: number,
  meters: number,
  cost: number,
  note?: string,
): TransportOption {
  return {
    mode,
    durationMinutes: minutes,
    distanceMeters: meters,
    cost: cad(cost),
    available: true,
    note,
    // Modelled, not quoted — see docs/SARA_PLAN.md B8. The public OSRM demo returns car
    // speeds for every profile, so per-mode durations are computed, not routed.
    confidence: mode === "walk" ? 0.8 : 0.5,
  };
}

/** One flat STM fare, which also buys 120 minutes of transfers. */
const FARE = 3.35;

/**
 * A leg costed four ways from its length alone.
 *
 * Overrides exist for the legs where distance is a bad model of the fare: an airport
 * shuttle is a flat price however long the road is.
 */
function leg(
  from: Place,
  to: Place,
  meters: number,
  recommended: TransportMode,
  reason: string,
  overrides: Partial<Record<TransportMode, Partial<TransportOption>>> = {},
): TransportLeg {
  const base: Record<TransportMode, TransportOption> = {
    walk: option("walk", Math.ceil(meters / 75), meters, 0),
    transit: option("transit", Math.ceil(meters / 550) + 9, meters, FARE, "flat STM fare estimate"),
    bike: option("bike", Math.ceil(meters / 250) + 2, meters, 5, "BIXI single trip"),
    rideshare: option(
      "rideshare",
      Math.ceil(meters / 400) + 3,
      meters,
      Math.max(14, Math.round(5.5 + (meters / 1000) * 1.9)),
      "modelled estimate, not a live quote",
    ),
    car: option("car", Math.ceil(meters / 450) + 5, meters, 0),
  };
  const options = (["walk", "transit", "bike", "rideshare"] as TransportMode[])
    .map((mode) => ({ ...base[mode], ...overrides[mode] }))
    .filter((o) => o.available);

  return {
    from: from.coords,
    to: to.coords,
    fromPlaceId: from.id,
    toPlaceId: to.id,
    recommended,
    reason,
    options,
  };
}

export const LEG_TO_BERTRAND: TransportLeg = leg(
  byName("Pointe-à-Callière"),
  byName("Librairie Bertrand"),
  400,
  "walk",
  "400 m and covered most of the way — under your 6 km daily walking rule.",
  { bike: { note: "wet roads expected after 15:00" } },
);

/* ---------------- Itinerary ---------------- */

function item(
  id: string,
  date: ISODate,
  name: string,
  slot: TimeSlot,
  start: string,
  end: string,
  cost: number,
  explanation: Explanation,
  extra: Partial<ItineraryItem> = {},
): ItineraryItem {
  const place = byName(name);
  return {
    id,
    placeId: place.id,
    place,
    slot,
    startTime: at(date, start),
    endTime: at(date, end),
    status: "planned",
    estimatedCost: cad(cost),
    why: explanation,
    locked: false,
    weatherSensitive: place.ambience === "outdoor",
    ...extra,
  };
}

/* -- Day 1 · Tuesday 15 September -------------------------------------------- */

const DAY1_ITEMS: ItineraryItem[] = [
  item("it_d1_yul", D1, "Montréal–Trudeau (YUL)", "afternoon", "14:20", "15:05", 11,
    why("The 747 is $11 flat and runs every twenty minutes; the modelled Uber was $48.", "transport", [
      { kind: "budget", label: "$37 cheaper than the car for the same 45 minutes", weight: 0.8 },
      { kind: "preference", label: "You chose transit over rideshare", weight: 0.6 },
    ]),
    { status: "done" }),
  item("it_d1_hotel", D1, "Hôtel Nelligan", "afternoon", "16:00", "16:40", 0,
    why("Paid before you left at $186 a night, so none of today's $150 goes on the room.", "accommodation", [
      { kind: "distance", label: "Six of your twenty stops are inside 1.2 km", weight: 0.75 },
      { kind: "budget", label: "Prepaid — outside the daily ceiling", weight: 0.5 },
      { kind: "rating", label: "4.6 ★ from 2,104 reviews", weight: 0.4 },
    ]),
    {
      status: "done",
      legFromPrevious: leg(
        byName("Montréal–Trudeau (YUL)"), byName("Hôtel Nelligan"), 20500, "transit",
        "747 bus, 45 minutes door to door, one flat fare each.",
        {
          walk: { available: false, note: "20.5 km — not a walk with luggage" },
          bike: { available: false, note: "no BIXI dock at the airport" },
          transit: { durationMinutes: 45, cost: cad(11), note: "747 airport shuttle, flat fare, 24 h" },
          rideshare: { durationMinutes: 26, cost: cad(48), note: "modelled from road distance, not a live quote" },
        },
      ),
    }),
  item("it_d1_port", D1, "Old Port stroll", "evening", "17:30", "18:45", 0,
    why("Flat, free and 700 m from the door — the gentlest thing to do on a travel day.", "attractions", [
      { kind: "weather", label: "Clear and 22°C until sunset at 19:09", weight: 0.8 },
      { kind: "pace", label: "One stop in the first evening, by your own rule", weight: 0.6 },
      { kind: "budget", label: "Free", weight: 0.4 },
    ]),
    {
      status: "done",
      legFromPrevious: leg(byName("Hôtel Nelligan"), byName("Old Port stroll"), 700, "walk",
        "700 m along rue de la Commune, nine minutes."),
    }),
  item("it_d1_byblos", D1, "Byblos le Petit Café", "evening", "19:30", "21:00", 24,
    why("Persian, 4.5 ★, $24 a head — the closest thing to a home kitchen on night one.", "food", [
      { kind: "preference", label: "Matches your interest in Persian food", weight: 0.9 },
      { kind: "budget", label: "$24 sits under your $35 dinner ceiling", weight: 0.55 },
      { kind: "hours", label: "Open to 22:00, so a late landing still works", weight: 0.35 },
    ]),
    {
      status: "done",
      legFromPrevious: leg(byName("Old Port stroll"), byName("Byblos le Petit Café"), 4600, "transit",
        "4.6 km. Champ-de-Mars to Laurier is eighteen minutes underground; walking it would eat the table."),
    }),
];

const DAY1: ItineraryDay = {
  date: D1,
  dayNumber: 1,
  items: DAY1_ITEMS,
  totals: { estimatedCost: cad(35), walkingMeters: 3000, activeMinutes: 400 },
  weather: SEP15,
  summary: "Land, drop the bags, and let the Old Port take the first evening.",
};

/* -- Day 2 · Wednesday 16 September — the rain, and the re-plan --------------- */

const DAY2_ITEMS: ItineraryItem[] = [
  item("it_d2_coffee", D2, "Café Olimpico", "morning", "08:45", "09:20", 6,
    why("Your first stop is always coffee, never breakfast — and this one has been at it since 1970.", "food", [
      { kind: "behavior", label: "You opened a café card first on both trips", weight: 0.85 },
      { kind: "budget", label: "$6, the cheapest start available", weight: 0.5 },
      { kind: "rating", label: "4.6 ★ from 5,280 reviews", weight: 0.4 },
    ]),
    { status: "done" }),
  item("it_d2_oldmtl", D2, "Place Jacques-Cartier", "morning", "09:50", "11:00", 0,
    why("Four hundred years of façades in a 2.1 km loop, and it is dry until two.", "attractions", [
      { kind: "weather", label: "Clear all morning; the rain lands at 15:00", weight: 0.85 },
      { kind: "preference", label: "Matches your interest in history and walking", weight: 0.8 },
      { kind: "budget", label: "Free", weight: 0.4 },
    ]),
    {
      status: "done",
      legFromPrevious: leg(byName("Café Olimpico"), byName("Place Jacques-Cartier"), 5600, "transit",
        "5.6 km across town — Laurier to Champ-de-Mars, nineteen minutes for one fare."),
    }),
  item("it_d2_notredame", D2, "Notre-Dame Basilica", "morning", "11:15", "12:15", 16,
    why("Booked for 11:15 — the cruise groups reach the doors at noon.", "attractions", [
      { kind: "hours", label: "Timed entry held, two tickets", weight: 0.9 },
      { kind: "preference", label: "Avoids the midday crowds you asked to skip", weight: 0.7 },
      { kind: "distance", label: "400 m from the square", weight: 0.5 },
    ]),
    {
      status: "done",
      locked: true,
      legFromPrevious: leg(byName("Place Jacques-Cartier"), byName("Notre-Dame Basilica"), 400, "walk",
        "400 m down rue Notre-Dame, five minutes."),
    }),
  item("it_d2_lunch", D2, "Café Tehran", "afternoon", "12:45", "14:00", 22,
    why("The only Persian kitchen under $25 nearby with a 4.5+ rating.", "food", [
      { kind: "preference", label: "Matches your interest in Persian food", weight: 0.9 },
      { kind: "budget", label: "$22 sits under your $35 ceiling", weight: 0.5 },
      { kind: "rating", label: "4.5 ★ from 402 reviews", weight: 0.4 },
    ]),
    {
      status: "done",
      legFromPrevious: leg(byName("Notre-Dame Basilica"), byName("Café Tehran"), 5300, "transit",
        "5.3 km north — Place-d'Armes to Laurier, then four minutes on foot."),
    }),
  item("it_d2_museum", D2, "Pointe-à-Callière", "afternoon", "14:30", "16:00", 26,
    why("Swapped in for Mount Royal: indoors for the whole rain window, and 400 m from your bookstore.", "weather", [
      { kind: "weather", label: "Indoor during the 15:00–17:00 rain window", weight: 0.95 },
      { kind: "preference", label: "Matches your interest in history", weight: 0.7 },
      { kind: "budget", label: "$26 fits the $98 you have left today", weight: 0.5 },
    ])),
  item("it_d2_books", D2, "Librairie Bertrand", "afternoon", "16:30", "17:15", 0,
    why("Seven bookstore searches this trip make this your strongest signal.", "personalizer", [
      { kind: "behavior", label: "7 bookstore searches in 2 days", weight: 0.95 },
      { kind: "budget", label: "Free entry", weight: 0.5 },
      { kind: "hours", label: "Opening hours unknown — worth calling ahead", weight: -0.2 },
    ]),
    { legFromPrevious: LEG_TO_BERTRAND }),
  item("it_d2_dinner", D2, "Damas", "evening", "19:00", "21:00", 38,
    why("Your one splurge. Thursday is built cheap to pay for it.", "food", [
      { kind: "preference", label: "Levantine, which you reordered twice in Toronto", weight: 0.8 },
      { kind: "budget", label: "$38 is $3 over the dinner ceiling, once", weight: -0.3 },
      { kind: "rating", label: "4.6 ★ from 1,870 reviews", weight: 0.5 },
    ]),
    {
      status: "confirmed",
      locked: true,
      legFromPrevious: leg(byName("Librairie Bertrand"), byName("Damas"), 6000, "transit",
        "6 km to Outremont — over your walking rule, so the métro wins."),
    }),
];

const DAY2: ItineraryDay = {
  date: D2,
  dayNumber: 2,
  items: DAY2_ITEMS,
  totals: { estimatedCost: cad(108), walkingMeters: 5600, activeMinutes: 735 },
  weather: SEP16,
  summary: "Old Montreal on foot, indoors after 2 PM.",
};

/* -- Day 3 · Thursday 17 September ------------------------------------------- */

const DAY3_ITEMS: ItineraryItem[] = [
  item("it_d3_mountain", D3, "Mount Royal lookout", "morning", "09:00", "11:00", 0,
    why("Moved here from Wednesday by Nimbus: 19°C, clear, and the city is still quiet at nine.", "weather", [
      { kind: "weather", label: "Clear all day, 8% chance of rain", weight: 0.9 },
      { kind: "preference", label: "Matches walking, and it is the one climb you asked for", weight: 0.7 },
      { kind: "budget", label: "Free", weight: 0.4 },
    ])),
  item("it_d3_bagel", D3, "St-Viateur Bagel", "afternoon", "12:00", "12:30", 8,
    why("Cash only — bring $10. Wood-fired, and open whatever time you get down the hill.", "local", [
      { kind: "hours", label: "Open 24 hours, so the climb cannot make you late", weight: 0.7 },
      { kind: "budget", label: "$8 for two, the cheapest lunch on the trip", weight: 0.6 },
      { kind: "rating", label: "4.7 ★ from 9,400 reviews", weight: 0.5 },
    ]),
    {
      legFromPrevious: leg(byName("Mount Royal lookout"), byName("St-Viateur Bagel"), 3600, "transit",
        "Bus 11 down Camillien-Houde, then 400 m into Mile End — twenty-two minutes for one fare."),
    }),
  item("it_d3_books", D3, "Drawn & Quarterly", "afternoon", "13:30", "14:30", 30,
    why("The independent bookstore you keep reopening. Echo has stopped pretending it is a maybe.", "personalizer", [
      { kind: "behavior", label: "Reopened this card four times before the trip", weight: 0.95 },
      { kind: "preference", label: "Matches your interest in books", weight: 0.8 },
      { kind: "budget", label: "$30 budgeted, because you will buy something", weight: -0.25 },
    ]),
    {
      legFromPrevious: leg(byName("St-Viateur Bagel"), byName("Drawn & Quarterly"), 800, "walk",
        "800 m along Bernard, eleven minutes past the bakeries."),
    }),
  item("it_d3_market", D3, "Jean-Talon Market", "afternoon", "16:00", "17:30", 14,
    why("Covered aisles, so it is the one outdoor thing the forecast cannot cancel.", "attractions", [
      { kind: "weather", label: "Under a permanent roof — weather-proof either way", weight: 0.7 },
      { kind: "preference", label: "Matches food and walking", weight: 0.65 },
      { kind: "budget", label: "$14 of tasting, not a meal", weight: 0.45 },
    ]),
    {
      legFromPrevious: leg(byName("Drawn & Quarterly"), byName("Jean-Talon Market"), 2300, "transit",
        "2.3 km — Laurier to Jean-Talon, twelve minutes."),
    }),
  item("it_d3_dinner", D3, "Le Petit Local", "evening", "19:00", "21:00", 29,
    why("$29 for the set menu, under your $35 ceiling, and it pays back last night's Damas.", "food", [
      { kind: "budget", label: "$29 — $9 under what you spent yesterday", weight: 0.75 },
      { kind: "preference", label: "Small room, no queue, which you keep choosing", weight: 0.6 },
      { kind: "distance", label: "7.1 km out to Saint-Henri", weight: -0.3 },
    ]),
    {
      legFromPrevious: leg(byName("Jean-Talon Market"), byName("Le Petit Local"), 7100, "transit",
        "7.1 km to Saint-Henri — orange line the whole way, thirty-four minutes."),
    }),
];

const DAY3: ItineraryDay = {
  date: D3,
  dayNumber: 3,
  items: DAY3_ITEMS,
  totals: { estimatedCost: cad(81), walkingMeters: 5500, activeMinutes: 720 },
  weather: SEP17,
  summary: "Mount Royal early, then Mile End at bookshop pace.",
};

/* -- Day 4 · Friday 18 September --------------------------------------------- */

const DAY4_ITEMS: ItineraryItem[] = [
  item("it_d4_museum", D4, "Musée des Beaux-Arts", "morning", "09:30", "11:30", 24,
    why("Four of the artists you saved are in the Canadian wing, and it opens before the coach parties.", "attractions", [
      { kind: "preference", label: "Matches your interest in art and culture", weight: 0.85 },
      { kind: "behavior", label: "You saved four works from this collection", weight: 0.7 },
      { kind: "weather", label: "Indoors on the greyest morning of the trip", weight: 0.5 },
    ])),
  item("it_d4_icecream", D4, "Kem CoBa", "afternoon", "12:30", "13:00", 9,
    why("Cheap by design — Morsel is protecting tonight's show.", "food", [
      { kind: "budget", label: "$9 keeps the day under $90 before the ticket", weight: 0.8 },
      { kind: "rating", label: "4.6 ★ from 3,100 reviews", weight: 0.45 },
      { kind: "hours", label: "Closed Mondays, open today", weight: 0.3 },
    ]),
    {
      legFromPrevious: leg(byName("Musée des Beaux-Arts"), byName("Kem CoBa"), 2700, "transit",
        "2.7 km — Guy-Concordia to Laurier, sixteen minutes."),
    }),
  item("it_d4_records", D4, "Mile End record shops", "afternoon", "14:00", "15:30", 20,
    why("You lingered four minutes on this card without tapping it. Atlas gave it the gap.", "personalizer", [
      { kind: "behavior", label: "4 min 12 s of dwell, no tap", weight: 0.9 },
      { kind: "distance", label: "400 m from the ice cream", weight: 0.6 },
      { kind: "budget", label: "$20 set aside, which you may not spend", weight: 0.35 },
    ]),
    {
      legFromPrevious: leg(byName("Kem CoBa"), byName("Mile End record shops"), 400, "walk",
        "400 m up Saint-Laurent, five minutes."),
    }),
  item("it_d4_aura", D4, "Notre-Dame · AURA show", "evening", "18:00", "19:15", 32,
    why("Affordable because the trip is running $276 under its ceiling — and it is the last night.", "orchestrator", [
      { kind: "budget", label: "$32 against $276 of unspent budget", weight: 0.85 },
      { kind: "novelty", label: "The one thing on the plan you have not seen a version of", weight: 0.6 },
      { kind: "preference", label: "Indoors, and it ends by 19:15 for an early flight", weight: 0.5 },
    ]),
    {
      legFromPrevious: leg(byName("Mile End record shops"), byName("Notre-Dame · AURA show"), 3600, "transit",
        "3.6 km back to Old Montreal — twenty-one minutes, and you are inside before the doors close."),
    }),
];

const DAY4: ItineraryDay = {
  date: D4,
  dayNumber: 4,
  items: DAY4_ITEMS,
  totals: { estimatedCost: cad(85), walkingMeters: 3600, activeMinutes: 585 },
  weather: SEP18,
  summary: "Museums, records, and the basilica lit up at the end.",
};

/**
 * The budget, and the arithmetic it has to satisfy:
 *   - every `perDay.planned` equals that day's `totals.estimatedCost`
 *   - the four planned days sum to 309, which is what the screens call "planned"
 *   - `spentToDate` (42 + 52) plus `plannedRemaining` (64 left today, 81, 85) is exactly
 *     `projectedTotal`, so the headline and Morsel's tip can never disagree
 * `actual` runs a little above `planned` because fares and a beer are not stops.
 */
export const BUDGET: BudgetState = {
  dailyLimit: cad(150),
  tripLimit: cad(600),
  spentToDate: cad(94),
  plannedRemaining: cad(230),
  projectedTotal: cad(324),
  status: "under",
  perDay: [
    { date: D1, planned: cad(35), actual: cad(42) },
    { date: D2, planned: cad(108), actual: cad(52) },
    { date: D3, planned: cad(81) },
    { date: D4, planned: cad(85) },
  ],
};

export const ITINERARY: Itinerary = {
  id: "itin_montreal_v3",
  tripId: TRIP.id,
  version: 3,
  days: [DAY1, DAY2, DAY3, DAY4],
  budget: BUDGET,
  generatedAt: at("2026-09-13", "19:06"),
  lastReplanAt: at(D2, "14:28"),
};

/* ---------------- Replan ---------------- */

export const REPLAN: ReplanEvent = {
  id: "replan_7f2a",
  tripId: TRIP.id,
  trigger: "weather",
  detectedBy: "weather",
  observation: "Heavy rain 15:00–17:00 on Sep 16, confidence up from 40% to 82%",
  decision: "Moved Mount Royal to Sep 17 morning; Pointe-à-Callière takes the 14:30 slot",
  fromVersion: 2,
  toVersion: 3,
  at: at(D2, "14:28"),
  accepted: null,
  changes: [
    {
      op: "move",
      dayDate: D2,
      itemId: "it_d3_mountain",
      before: { startTime: at(D2, "14:30") },
      after: { startTime: at(D3, "09:00") },
      reason: "Outdoor stop inside the rain window",
    },
    {
      op: "add",
      dayDate: D2,
      itemId: "it_d2_museum",
      after: { startTime: at(D2, "14:30") },
      reason: "Indoor replacement 400 m from the bookstore, $26 fits the remaining $98",
    },
  ],
};

/* ---------------- Profile ---------------- */

export const PROFILE: UserProfile = {
  userId: "user_demo",
  tripId: TRIP.id,
  interestWeights: {
    history: 0.85, books: 0.82, coffee: 0.78, food: 0.74,
    culture: 0.7, walking: 0.66, nature: 0.4, nightlife: 0.04,
  },
  budgetBand: "medium",
  preferredPriceLevels: [1, 2],
  minRating: 4.3,
  maxWalkMeters: 6000,
  transportWeights: { walk: 0.81, transit: 0.62, bike: 0.2, rideshare: 0.08, car: 0.02 },
  dietary: [],
  pace: "balanced",
  signalCount: 214,
  confidence: 0.86,
  updatedAt: at(D2, "13:10"),
  changeLog: [
    {
      at: at(D2, "13:10"),
      field: "preferredPriceLevels",
      from: [1, 2, 3],
      to: [1, 2],
      cause: "Declined three dinners over $45 in a row",
    },
    {
      at: at(D1, "21:02"),
      field: "interestWeights.books",
      from: 0.61,
      to: 0.82,
      cause: "Searched “bookstore” 7 times in 2 days",
    },
    {
      at: at(D1, "18:40"),
      field: "transportWeights.walk",
      from: 0.68,
      to: 0.81,
      cause: "Walked 3 legs that were planned as transit",
    },
  ],
};

/* ---------------- Recommendations ---------------- */

export const RECOMMENDATIONS: Recommendation[] = [
  {
    place: byName("Pointe-à-Callière"),
    score: 0.96,
    fitsBudget: true,
    openNow: true,
    distanceMeters: 400,
    travelTime: { mode: "walk", minutes: 6 },
    why: why("Indoor, 400 m from your bookstore, and built on the founding site.", "attractions", [
      { kind: "weather", label: "Indoor during today's rain window", weight: 0.9 },
      { kind: "preference", label: "Matches your interest in history", weight: 0.8 },
      { kind: "distance", label: "6 min walk to your next stop", weight: 0.5 },
    ]),
  },
  {
    place: byName("Librairie Bertrand"),
    score: 0.94,
    fitsBudget: true,
    // Hours are unknown for this place, so openNow is deliberately absent — not false.
    // The UI must render "hours unknown" rather than "closed".
    distanceMeters: 400,
    travelTime: { mode: "walk", minutes: 6 },
    why: why("Seven bookstore searches say this is your strongest signal.", "personalizer", [
      { kind: "behavior", label: "7 bookstore searches this trip", weight: 0.95 },
      { kind: "budget", label: "Free", weight: 0.45 },
      { kind: "hours", label: "Opening hours unknown", weight: -0.2 },
    ]),
  },
  {
    place: byName("Bota Bota spa"),
    score: 0.61,
    fitsBudget: false,
    distanceMeters: 1100,
    travelTime: { mode: "walk", minutes: 14 },
    why: why("Held back: $60 is most of what is left of today, and dinner is booked.", "orchestrator", [
      { kind: "budget", label: "$60 of the $98 you have left today", weight: -0.6 },
      { kind: "weather", label: "Indoor, so the rain does not rule it out", weight: 0.4 },
    ]),
  },
];

/* ---------------- Now suggestion ---------------- */

export const NOW: NowSuggestion = {
  headline: "You have 3 hours before dinner.",
  narrative:
    "It is 20°C and dry for another twenty minutes, then rain until about five. Pointe-à-Callière " +
    "is indoors for the whole window and Librairie Bertrand is 400 m past it, free, and the strongest " +
    "match in your profile this trip. That keeps you at $52 of $150 today and puts you six minutes " +
    "from your 19:00 table at Damas.",
  options: RECOMMENDATIONS.slice(0, 2),
  constraints: {
    now: at(D2, "14:40"),
    freeUntil: at(D2, "19:00"),
    weather: SEP16.hours[14],
    remainingToday: cad(98),
    location: { lat: 45.5023, lng: -73.5542 },
  },
  generatedAt: at(D2, "14:40"),
};

/* ---------------- Traces & usage ---------------- */

export const USAGE: UsageMeter = {
  exaSpentUsd: 0.147,
  exaBudgetUsd: 10,
  exaSearches: 21,
  llmCalls: 38,
  cacheHitRate: 0.72,
};

export function trace(
  agent: AgentTrace["agent"],
  task: string,
  status: AgentTrace["status"],
  summary?: string,
): AgentTrace {
  return {
    id: `trace_${agent}_${Math.random().toString(36).slice(2, 8)}`,
    agent,
    status,
    task,
    output: summary ? { summary } : undefined,
    toolCalls: [],
    startedAt: at(D2, "14:28"),
    durationMs: status === "done" ? 1400 : undefined,
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  };
}

export const PLAN_AGENTS: AgentTrace["agent"][] = [
  "weather", "attractions", "food", "local", "transport", "personalizer", "itinerary",
];

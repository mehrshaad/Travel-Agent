/**
 * Contract-shaped fixtures — valid instances of the types in `types/index.ts`.
 *
 * These are what `?mock=1` serves. Unlike `lib/mock/ui.ts` (pre-formatted display
 * strings), everything here is domain-shaped: Money objects, ISO datetimes with a real
 * offset, coordinates taken from public/montreal-map.html so the map and the API agree.
 *
 * Deliberately includes the awkward cases the UI must survive:
 *   - a Place with no rating and no priceLevel (the common OSM case)
 *   - a Place with openingHours.unknown === true
 *   - a negative explanation factor
 */

import type {
  BadWeatherWindow, BudgetState, Explanation, Itinerary, ItineraryDay, ItineraryItem,
  Money, NowSuggestion, Place, Recommendation, ReplanEvent, TransportLeg, TransportOption,
  Trip, UsageMeter, UserProfile, WeatherDay, WeatherForecast, WeatherHour, AgentTrace,
} from "@/types";

const TZ = "-04:00"; // America/Toronto in September
const cad = (amount: number): Money => ({ amount, currency: "CAD" });
const at = (date: string, time: string) => `${date}T${time}:00${TZ}`;

export const TRIP: Trip = {
  id: "trip_montreal_demo",
  name: "Montreal, mostly on foot",
  destination: {
    query: "Montreal, Canada",
    city: "Montréal",
    country: "Canada",
    coords: { lat: 45.5017, lng: -73.5673 },
    timezone: "America/Toronto",
  },
  startDate: "2026-09-15",
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

export const PLACES: Place[] = [
  {
    id: "osm:way/29938741",
    source: "osm",
    name: "Pointe-à-Callière",
    category: "museum",
    section: "explore",
    interests: ["history", "culture"],
    coords: { lat: 45.5023, lng: -73.5542 },
    address: "350 Place Royale, Montréal",
    ambience: "indoor",
    rating: 4.6,
    ratingCount: 6120,
    priceLevel: 2,
    avgCost: cad(26),
    durationMinutes: 90,
    openingHours: {
      weekly: [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: d as 0, opens: "10:00", closes: "17:00" })),
      raw: "Mo-Su 10:00-17:00",
      unknown: false,
    },
    url: "https://pacmusee.qc.ca/",
    photoUrl: "/photos/pointe-a-calliere.jpg",
    description: "Archaeology museum built on the actual founding site of the city.",
    tags: ["museum", "archaeology", "indoor"],
    confidence: 0.9,
  },
  {
    id: "osm:node/4410882931",
    source: "osm",
    name: "Librairie Bertrand",
    category: "bookstore",
    section: "explore",
    interests: ["books", "culture"],
    coords: { lat: 45.5016, lng: -73.5568 },
    address: "430 rue Saint-Pierre, Montréal",
    ambience: "indoor",
    // No rating and no priceLevel — this is what OSM actually gives you most of the time.
    // The UI must render this without inventing a score or showing 0 stars.
    durationMinutes: 45,
    openingHours: { weekly: [], raw: undefined, unknown: true },
    photoUrl: "/photos/bookstore.jpg",
    description: "Independent bookstore in Old Montreal.",
    tags: ["books", "indoor", "free"],
    confidence: 0.62,
  },
  {
    id: "osm:node/2215530918",
    source: "osm",
    name: "Café Tehran",
    category: "restaurant",
    section: "eat",
    interests: ["food", "coffee"],
    coords: { lat: 45.5248, lng: -73.5948 },
    ambience: "indoor",
    rating: 4.5,
    ratingCount: 402,
    priceLevel: 2,
    avgCost: cad(22),
    durationMinutes: 75,
    openingHours: {
      weekly: [1, 2, 3, 4, 5, 6].map((d) => ({ day: d as 1, opens: "11:30", closes: "22:00" })),
      raw: "Mo-Sa 11:30-22:00",
      unknown: false,
    },
    photoUrl: "/photos/persian-food.jpg",
    description: "Persian kitchen; the ghormeh sabzi is the dish locals name.",
    tags: ["persian", "restaurant"],
    confidence: 0.86,
  },
  {
    id: "osm:way/55123301",
    source: "osm",
    name: "Mount Royal · Kondiaronk lookout",
    category: "viewpoint",
    section: "explore",
    interests: ["nature", "walking", "free"],
    coords: { lat: 45.5045, lng: -73.5873 },
    ambience: "outdoor",
    rating: 4.8,
    ratingCount: 21400,
    avgCost: cad(0),
    durationMinutes: 75,
    openingHours: { weekly: [], unknown: true },
    photoUrl: "/photos/mount-royal.jpg",
    description: "The city's best-known lookout, a 3.1 km climb from downtown.",
    tags: ["park", "viewpoint", "outdoor", "free"],
    confidence: 0.88,
  },
  {
    id: "exa:9d1f4c2a8b",
    source: "exa",
    name: "Bota Bota spa",
    category: "landmark",
    section: "explore",
    interests: ["culture"],
    coords: { lat: 45.4981, lng: -73.5522 },
    ambience: "indoor",
    rating: 4.5,
    priceLevel: 3,
    avgCost: cad(60),
    durationMinutes: 150,
    openingHours: { weekly: [], unknown: true },
    photoUrl: "/photos/bota-bota.jpg",
    description: "Spa on a moored ferry in the Old Port.",
    tags: ["spa", "indoor"],
    confidence: 0.55,
  },
];

const byId = (id: string) => PLACES.find((p) => p.id === id)!;

/* ---------------- Weather ---------------- */

function hour(date: string, h: number, tempC: number, chance: number, mm: number): WeatherHour {
  const friendly = chance < 50 && mm < 0.5;
  return {
    time: at(date, `${String(h).padStart(2, "0")}:00`),
    tempC,
    feelsLikeC: tempC - 1,
    precipitationMm: mm,
    precipitationChance: chance,
    windKph: 11,
    code: mm > 2 ? "heavy_rain" : mm > 0 ? "rain" : chance > 35 ? "cloudy" : "clear",
    outdoorFriendly: friendly,
  };
}

const SEP16_HOURS: WeatherHour[] = Array.from({ length: 24 }, (_, h) => {
  if (h >= 15 && h < 17) return hour("2026-09-16", h, 19, 82, 3.1);
  if (h === 14 || h === 17) return hour("2026-09-16", h, 20, 55, 0.4);
  return hour("2026-09-16", h, 21, 12, 0);
});

export const BAD_WINDOW: BadWeatherWindow = {
  from: at("2026-09-16", "15:00"),
  to: at("2026-09-16", "17:00"),
  code: "heavy_rain",
  reason: "Heavy rain 15:00–17:00, 82% confidence",
  severity: "moderate",
};

const SEP16: WeatherDay = {
  date: "2026-09-16",
  minTempC: 14,
  maxTempC: 22,
  code: "rain",
  precipitationChance: 82,
  sunrise: at("2026-09-16", "06:32"),
  sunset: at("2026-09-16", "19:06"),
  hours: SEP16_HOURS,
  badWindows: [BAD_WINDOW],
};

export const FORECAST: WeatherForecast = {
  tripId: TRIP.id,
  days: [SEP16],
  fetchedAt: at("2026-09-16", "14:28"),
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

export const LEG_TO_BERTRAND: TransportLeg = {
  from: { lat: 45.5023, lng: -73.5542 },
  to: { lat: 45.5016, lng: -73.5568 },
  fromPlaceId: "osm:way/29938741",
  toPlaceId: "osm:node/4410882931",
  recommended: "walk",
  reason: "400 m and dry until 15:00 — under your 6 km daily walking rule.",
  options: [
    option("walk", 6, 400, 0),
    option("transit", 9, 400, 3.35, "flat STM fare estimate"),
    option("bike", 4, 400, 5, "wet roads expected after 15:00"),
    option("rideshare", 5, 400, 14, "modelled estimate, not a live quote"),
  ],
};

/* ---------------- Itinerary ---------------- */

function item(
  id: string,
  placeId: string,
  slot: ItineraryItem["slot"],
  start: string,
  end: string,
  cost: number,
  explanation: Explanation,
  extra: Partial<ItineraryItem> = {},
): ItineraryItem {
  const place = byId(placeId);
  return {
    id,
    placeId,
    place,
    slot,
    startTime: at("2026-09-16", start),
    endTime: at("2026-09-16", end),
    status: "planned",
    estimatedCost: cad(cost),
    why: explanation,
    locked: false,
    weatherSensitive: place.ambience === "outdoor",
    ...extra,
  };
}

const DAY2_ITEMS: ItineraryItem[] = [
  item("it_lunch", "osm:node/2215530918", "afternoon", "12:45", "14:00", 22,
    why("The only Persian kitchen under $25 nearby with a 4.5+ rating.", "food", [
      { kind: "preference", label: "Matches your interest in Persian food", weight: 0.9 },
      { kind: "budget", label: "$22 sits under your $35 dinner ceiling", weight: 0.5 },
      { kind: "rating", label: "4.5 ★ from 402 reviews", weight: 0.4 },
    ]),
    { status: "done" }),
  item("it_museum", "osm:way/29938741", "afternoon", "14:00", "15:30", 26,
    why("Swapped in for Mount Royal — indoor, and 6 minutes from lunch.", "weather", [
      { kind: "weather", label: "Indoor during the 15:00–17:00 rain window", weight: 0.95 },
      { kind: "distance", label: "6 min walk from your last stop", weight: 0.6 },
      { kind: "preference", label: "Matches your interest in history", weight: 0.7 },
    ])),
  item("it_books", "osm:node/4410882931", "afternoon", "16:30", "17:15", 0,
    why("Seven bookstore searches this trip make this your strongest signal.", "personalizer", [
      { kind: "behavior", label: "7 bookstore searches in 2 days", weight: 0.95 },
      { kind: "budget", label: "Free entry", weight: 0.5 },
      { kind: "hours", label: "Opening hours unknown — worth calling ahead", weight: -0.2 },
    ]),
    { legFromPrevious: LEG_TO_BERTRAND }),
];

export const BUDGET: BudgetState = {
  dailyLimit: cad(150),
  tripLimit: cad(600),
  spentToDate: cad(312),
  plannedRemaining: cad(242),
  projectedTotal: cad(554),
  status: "under",
  perDay: [
    { date: "2026-09-15", planned: cad(150), actual: cad(142) },
    { date: "2026-09-16", planned: cad(150), actual: cad(64) },
    { date: "2026-09-17", planned: cad(118) },
    { date: "2026-09-18", planned: cad(93) },
  ],
};

const DAY2: ItineraryDay = {
  date: "2026-09-16",
  dayNumber: 2,
  items: DAY2_ITEMS,
  totals: { estimatedCost: cad(48), walkingMeters: 3400, activeMinutes: 270 },
  weather: SEP16,
  summary: "Old Montreal on foot, indoors after 2 PM.",
};

export const ITINERARY: Itinerary = {
  id: "itin_montreal_v3",
  tripId: TRIP.id,
  version: 3,
  days: [DAY2],
  budget: BUDGET,
  generatedAt: at("2026-09-13", "19:06"),
  lastReplanAt: at("2026-09-16", "14:28"),
};

/* ---------------- Replan ---------------- */

export const REPLAN: ReplanEvent = {
  id: "replan_7f2a",
  tripId: TRIP.id,
  trigger: "weather",
  detectedBy: "weather",
  observation: "Heavy rain 15:00–17:00 on Sep 16, confidence up from 40% to 82%",
  decision: "Moved Mount Royal to Sep 17 morning; Pointe-à-Callière takes the 14:00 slot",
  fromVersion: 2,
  toVersion: 3,
  at: at("2026-09-16", "14:28"),
  accepted: null,
  changes: [
    {
      op: "move",
      dayDate: "2026-09-16",
      itemId: "it_mountroyal",
      before: { startTime: at("2026-09-16", "14:00") },
      after: { startTime: at("2026-09-17", "09:00") },
      reason: "Outdoor stop inside the rain window",
    },
    {
      op: "add",
      dayDate: "2026-09-16",
      itemId: "it_museum",
      after: { startTime: at("2026-09-16", "14:00") },
      reason: "Indoor replacement 6 minutes from lunch, $26 fits the remaining $86",
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
  updatedAt: at("2026-09-16", "13:10"),
  changeLog: [
    {
      at: at("2026-09-16", "13:10"),
      field: "preferredPriceLevels",
      from: [1, 2, 3],
      to: [1, 2],
      cause: "Declined three dinners over $45 in a row",
    },
    {
      at: at("2026-09-15", "21:02"),
      field: "interestWeights.books",
      from: 0.61,
      to: 0.82,
      cause: "Searched “bookstore” 7 times in 2 days",
    },
    {
      at: at("2026-09-15", "18:40"),
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
    place: byId("osm:way/29938741"),
    score: 0.96,
    fitsBudget: true,
    openNow: true,
    distanceMeters: 420,
    travelTime: { mode: "walk", minutes: 6 },
    why: why("Indoor, 6 minutes from lunch, and built on the founding site.", "attractions", [
      { kind: "weather", label: "Indoor during today's rain window", weight: 0.9 },
      { kind: "preference", label: "Matches your interest in history", weight: 0.8 },
      { kind: "distance", label: "6 min walk", weight: 0.5 },
    ]),
  },
  {
    place: byId("osm:node/4410882931"),
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
    place: byId("exa:9d1f4c2a8b"),
    score: 0.61,
    fitsBudget: false,
    distanceMeters: 1100,
    travelTime: { mode: "walk", minutes: 14 },
    why: why("Held back: $60 breaks your daily ceiling unless Thursday goes cheap.", "orchestrator", [
      { kind: "budget", label: "$60 is above your remaining $86 comfort margin", weight: -0.6 },
      { kind: "weather", label: "Indoor, so the rain does not rule it out", weight: 0.4 },
    ]),
  },
];

/* ---------------- Now suggestion ---------------- */

export const NOW: NowSuggestion = {
  headline: "You have 3 hours before dinner.",
  narrative:
    "It is 21°C and dry for another twenty minutes, then rain until about five. Librairie Bertrand " +
    "is 400 m away, free and indoors, and it is the strongest match in your profile this trip. That " +
    "keeps you at $64 of $150 today and puts you six minutes from your 19:00 table at Damas.",
  options: RECOMMENDATIONS.slice(0, 2),
  constraints: {
    now: at("2026-09-16", "14:40"),
    freeUntil: at("2026-09-16", "19:00"),
    weather: SEP16_HOURS[14],
    remainingToday: cad(86),
    location: { lat: 45.5023, lng: -73.5542 },
  },
  generatedAt: at("2026-09-16", "14:40"),
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
    startedAt: at("2026-09-16", "14:28"),
    durationMs: status === "done" ? 1400 : undefined,
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  };
}

export const PLAN_AGENTS: AgentTrace["agent"][] = [
  "weather", "attractions", "food", "local", "transport", "personalizer", "itinerary",
];

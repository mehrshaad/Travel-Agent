/**
 * Screen data for the Waylo UI, ported from the design canvas.
 *
 * This is presentation data — pre-formatted strings, as the design specifies them.
 * It is deliberately NOT the same thing as `lib/mock/fixtures/`, which holds
 * contract-shaped (`types/index.ts`) payloads for `?mock=1` API responses.
 * Keeping them separate stops UI copy from leaking into the API contract.
 */

export const V = "#7A5AF8"; // Atlas   · orchestrator
export const T = "#1FA39A"; // Dash    · transport
export const C = "#F2724B"; // Morsel  · food
export const A = "#F2A93B"; // Muse    · attractions
export const P = "#EA5E9B"; // Echo    · personalization
export const S = "#C9A227"; // Nest    · stay
export const SKY = "#57C4E1"; // Nimbus · weather
export const SAND = "#B9A27A"; // Fixer · local needs

export interface CrewMember {
  name: string;
  role: string;
  color: string;
  line: string;
}

export const CREW: CrewMember[] = [
  { name: "Atlas", role: "orchestrator", color: V, line: "Splitting 4 days into 14 anchors" },
  { name: "Nest", role: "stay", color: S, line: "Ranked 38 stays by walkability" },
  { name: "Morsel", role: "food", color: C, line: "Found 6 Persian kitchens under $35" },
  { name: "Muse", role: "attractions", color: A, line: "History + bookstores, 22 candidates" },
  { name: "Dash", role: "transport", color: T, line: "Walking beats transit on 9 of 12 legs" },
  { name: "Nimbus", role: "weather", color: SKY, line: "Rain Tue 3–5 PM, clear Thursday" },
  { name: "Fixer", role: "local needs", color: SAND, line: "Pharmacy + laundromat near hotel" },
  { name: "Echo", role: "personalization", color: P, line: "Learning from 214 past signals" },
];

export interface Stop {
  time: string;
  title: string;
  meta: string;
  why: string;
  cost: string;
  color: string;
  swapped?: boolean;
}

export const TODAY: Stop[] = [
  { time: "08:45", title: "Café Olimpico", meta: "Mile End · 4.6 ★", why: "Morsel: your first stop is always coffee, never breakfast.", cost: "$6", color: C },
  { time: "09:30", title: "Old Montreal walk", meta: "2.1 km · self-guided", why: "Muse: 400 years of façades, and it beats the rain.", cost: "Free", color: A },
  { time: "11:15", title: "Notre-Dame Basilica", meta: "45 min · timed entry", why: "Booked for you — 11:15 avoids the cruise crowd.", cost: "$16", color: A },
  { time: "12:45", title: "Café Tehran", meta: "Persian · $$", why: "Morsel: the ghormeh sabzi is the one locals name.", cost: "$22", color: C },
  { time: "14:00", title: "Pointe-à-Callière", meta: "Archaeology · indoor", why: "Replaces Mount Royal — rain lands at 3 PM.", cost: "$26", color: T, swapped: true },
  { time: "16:30", title: "Librairie Bertrand", meta: "Bookstore · 400 m", why: "Echo: 7 bookstore searches this trip. Free, and dry.", cost: "Free", color: V },
  { time: "19:00", title: "Damas", meta: "Levantine · $$$", why: "Your one splurge — Thursday goes cheap to pay for it.", cost: "$38", color: C },
];

export interface DayPlan {
  title: string;
  items: Stop[];
}

export const PLANS: Record<number, DayPlan> = {
  1: {
    title: "Monday, Sep 15 · arrival + Old Port",
    items: [
      { time: "14:20", title: "Land at YUL → hotel", why: "Dash: 747 bus, $11, 45 min. Uber was $48.", meta: "Transit", cost: "$11", color: T },
      { time: "16:00", title: "Check in, Hôtel Nelligan", why: "Nest: walkable to 9 of your 14 stops.", meta: "Old Montreal", cost: "$186", color: S },
      { time: "17:30", title: "Old Port stroll", why: "Muse: gentle first evening, 1.4 km flat.", meta: "1.4 km", cost: "Free", color: A },
      { time: "19:30", title: "Byblos le Petit Café", why: "Morsel: Persian-ish, $24 average, 4.5 ★.", meta: "Persian · $$", cost: "$24", color: C },
    ],
  },
  2: { title: "Tuesday, Sep 16 · history, then rain", items: TODAY.map((t) => ({ ...t })) },
  3: {
    title: "Wednesday, Sep 17 · Mile End + books",
    items: [
      { time: "09:00", title: "Mount Royal lookout", why: "Moved here from Tuesday by Nimbus. Clear, 18°C.", meta: "3.1 km climb", cost: "Free", color: A },
      { time: "12:00", title: "St-Viateur Bagel", why: "Fixer: cash only, bring $10.", meta: "Snack", cost: "$8", color: C },
      { time: "13:30", title: "Drawn & Quarterly", why: "Echo: the independent bookstore you keep reopening.", meta: "Bookstore", cost: "$30", color: V },
      { time: "16:00", title: "Jean-Talon Market", why: "Muse: covered, so weather-proof either way.", meta: "Market", cost: "$14", color: A },
      { time: "19:00", title: "Le Petit Local", why: "Morsel: $29 tasting, under your $35 ceiling.", meta: "Local · $$", cost: "$29", color: C },
    ],
  },
  4: {
    title: "Thursday, Sep 18 · museums + departure eve",
    items: [
      { time: "09:30", title: "Musée des Beaux-Arts", why: "Muse: 4 of your saved artists are in the permanent wing.", meta: "2 h", cost: "$24", color: A },
      { time: "12:30", title: "Kem CoBa", why: "Cheap by design — Morsel is protecting tonight.", meta: "Café", cost: "$9", color: C },
      { time: "14:00", title: "Mile End record shops", why: "Echo: you lingered 4 min on this card yesterday.", meta: "Shopping", cost: "$20", color: V },
      { time: "18:00", title: "Notre-Dame AURA show", why: "Affordable because you finished $46 under budget.", meta: "Evening", cost: "$32", color: A },
    ],
  },
};

export interface ExplorePlace {
  name: string;
  meta: string;
  price: string;
  why: string;
  agent: string;
  agentColor: string;
  match: string;
  slot: string;
}

export const PLACES: ExplorePlace[] = [
  { name: "Pointe-à-Callière", meta: "Archaeology museum · 4.6 ★", price: "$26", why: "Indoor, 6 min from lunch, built on the actual founding site.", agent: "Muse", agentColor: A, match: "96%", slot: "museum exterior" },
  { name: "Librairie Bertrand", meta: "Independent bookstore · 4.7 ★", price: "Free", why: "Seven bookstore searches say this is the strongest signal you have.", agent: "Echo", agentColor: P, match: "94%", slot: "bookshelves" },
  { name: "Café Tehran", meta: "Persian · 4.5 ★", price: "$22", why: "The only Persian kitchen under $25 with a 4.5+ rating nearby.", agent: "Morsel", agentColor: C, match: "93%", slot: "restaurant table" },
  { name: "Château Ramezay", meta: "Historic house · 4.4 ★", price: "$13", why: "1705 governor’s residence, indoors, 3 min off your route.", agent: "Muse", agentColor: A, match: "88%", slot: "historic house" },
  { name: "Jean-Talon Market", meta: "Market · 4.7 ★", price: "$14", why: "Covered aisles — the one outdoor thing rain does not cancel.", agent: "Fixer", agentColor: SAND, match: "85%", slot: "market stalls" },
  { name: "Drawn & Quarterly", meta: "Bookstore · 4.8 ★", price: "Free", why: "Mile End, pairs with Wednesday’s bagel stop at no transport cost.", agent: "Echo", agentColor: P, match: "84%", slot: "bookstore front" },
  { name: "Bota Bota spa", meta: "Spa boat · 4.5 ★", price: "$60", why: "Held back: $60 breaks your daily ceiling unless Thursday goes cheap.", agent: "Atlas", agentColor: V, match: "61%", slot: "spa deck" },
  { name: "Casino de Montréal", meta: "Nightlife · 4.0 ★", price: "$0", why: "Ranked low — you have skipped every nightlife card twice now.", agent: "Echo", agentColor: P, match: "22%", slot: "night exterior" },
];

export const INTERESTS = [
  "History", "Cafés", "Bookstores", "Persian food", "Museums", "Walking",
  "Markets", "Architecture", "Parks", "Live music", "Shopping", "Nightlife",
];

export const CATEGORIES = ["All", "History", "Food", "Cafés", "Bookstores", "Indoor", "Free", "Nightlife"];

export interface Reply {
  who: string;
  role: string;
  color: string;
  text: string;
}

export const REPLIES: Record<string, Reply> = {
  "Is it still raining at 5?": { who: "Nimbus", role: "weather", color: SKY, text: "Radar thins it out by 16:40 and it is dry by 17:15. Your 16:30 bookstore is indoors anyway, so the walk to dinner should be fine without an umbrella." },
  "Cheapest dinner near the bookstore?": { who: "Morsel", role: "food", color: C, text: "Le Bremner is $44 — too much for today. Two streets over, Olive et Gourmando does a $19 plate until 18:00 and holds you $12 under. Want me to move dinner an hour earlier?" },
  "Can I afford the spa tomorrow?": { who: "Atlas", role: "orchestrator", color: V, text: "Only if Wednesday lunch stays under $15. Drop the market tasting and Bota Bota fits at $60 with $4 to spare. Say the word and I will rebuild Wednesday." },
  "Where is the nearest pharmacy?": { who: "Fixer", role: "local needs", color: SAND, text: "Pharmaprix, 120 m from the hotel on rue Saint-Jacques, open until 22:00. They stock the blister plasters you asked about in Toronto." },
};

export const STAYS = [
  { name: "Auberge du Vieux-Port", price: "$204", meta: "4.7 ★ · 350 m away", why: "Better breakfast, $18 more a night than you wanted to spend.", score: "91%", slotId: "wl-stay-auberge" },
  { name: "Hôtel Gault", price: "$219", meta: "4.8 ★ · 400 m away", why: "Highest rated of the six, but the price breaks your daily ceiling.", score: "86%", slotId: "wl-stay-gault" },
  { name: "Loft · Griffintown", price: "$148", meta: "4.4 ★ · 2.6 km away", why: "Cheapest, until Dash added four metro round trips a day.", score: "64%", slotId: "wl-stay-loft" },
  { name: "HI Montreal hostel", price: "$62", meta: "4.2 ★ · 1.9 km away", why: "Kept for the budget version of this trip — private room, shared kitchen.", score: "58%", slotId: "wl-stay-hostel" },
];

export const LEGS = [
  { from: "Hotel", to: "Café Olimpico", mode: "Metro", cost: "$3.35", note: "Too far to walk before coffee — Dash made the exception.", color: T },
  { from: "Olimpico", to: "Old Montreal", mode: "Walk", cost: "$0", note: "2.1 km, downhill, 26 min with photo stops.", color: A },
  { from: "Old Montreal", to: "Café Tehran", mode: "Walk", cost: "$0", note: "1.3 km. Saved $14 against the Uber estimate.", color: A },
  { from: "Café Tehran", to: "Pointe-à-Callière", mode: "Walk", cost: "$0", note: "Re-routed via the covered passage for the rain.", color: T },
  { from: "Bookstore", to: "Damas", mode: "Metro", cost: "$3.35", note: "4.1 km — over your walking rule, so transit wins.", color: T },
];

export const PASSES = [
  { name: "STM single fare ×2", status: "used today", tag: "$6.70 spent", bg: "#F7F3EC", fg: "#6B6458" },
  { name: "3-day unlimited pass", status: "not bought yet", tag: "Dash says wait", bg: "#FFF6EF", fg: "#A2542F" },
  { name: "BIXI bike share", status: "account linked", tag: "Idle in rain", bg: "#EAF4F2", fg: "#0F6F68" },
];

export const ESSENTIALS = [
  { kind: "pharmacy", name: "Pharmaprix Saint-Jacques", meta: "120 m · open to 22:00", note: "Has the blister plasters you searched for in Toronto.", status: "Open now", bg: "#EAF4F2", fg: "#0F6F68", color: T },
  { kind: "atm", name: "Desjardins ATM", meta: "210 m · 24 h", note: "No foreign fee with your card network.", status: "Open now", bg: "#EAF4F2", fg: "#0F6F68", color: V },
  { kind: "grocery", name: "IGA Express", meta: "340 m · open to 23:00", note: "Cheaper breakfast than the hotel’s $24 buffet.", status: "Open now", bg: "#EAF4F2", fg: "#0F6F68", color: A },
  { kind: "laundromat", name: "Buanderie Net", meta: "600 m · open to 21:00", note: "Day 3 is your usual laundry day on a 4-night trip.", status: "Open now", bg: "#EAF4F2", fg: "#0F6F68", color: C },
  { kind: "luggage", name: "Nannybag · Old Port", meta: "450 m · $8 per bag", note: "For Friday: your flight is 07:00, checkout is 11:00.", status: "Book Thursday", bg: "#FFF6EF", fg: "#A2542F", color: S },
  { kind: "sim / esim", name: "Fizz eSIM", meta: "instant · $18 / 5 GB", note: "Cheapest data plan that covers your remaining 3 days.", status: "Optional", bg: "#F7F3EC", fg: "#6B6458", color: P },
  { kind: "restroom", name: "Place d’Armes métro", meta: "90 m · free", note: "On the covered route Dash picked for the rain.", status: "Open now", bg: "#EAF4F2", fg: "#0F6F68", color: T },
  { kind: "washroom / parking", name: "Complexe Desjardins", meta: "1.1 km · $14 / day", note: "Only relevant if you rent a car for the Thursday trip.", status: "Not needed", bg: "#F7F3EC", fg: "#6B6458", color: SAND },
];

export const RECAP_STATS = [
  { label: "Spent", value: "$554", sub: "of $600 · $46 left" },
  { label: "Walked", value: "21.4 km", sub: "5.4 km/day average" },
  { label: "Stops made", value: "26", sub: "14 planned, 12 improvised" },
  { label: "Re-plans", value: "11", sub: "7 weather, 3 budget, 1 closure" },
];

export const HIGHLIGHTS = [
  { rank: "01", name: "Pointe-à-Callière", note: "the rain swap you rated 5★" },
  { rank: "02", name: "Café Tehran", note: "you went back twice" },
  { rank: "03", name: "Librairie Bertrand", note: "48 min, longest stop of the trip" },
  { rank: "04", name: "Notre-Dame AURA", note: "paid for by the $46 surplus" },
  { rank: "05", name: "Mount Royal, Thursday", note: "moved twice, worth it" },
];

export const LEARNED = [
  { text: "Rain-day museums rate higher for you than sunny-day parks. Nimbus will swap earlier next time, not at the last hour." },
  { text: "You walked 3 of 5 transit legs anyway. Dash is raising your walking default from 2.5 km to 3.2 km." },
  { text: "Dinner ceiling holds at $35, but you spend freely on evening events. Morsel and Muse will trade budget between them." },
  { text: "Second visits are a strong signal — Café Tehran is now pinned for any future Montreal trip." },
];

export const NEXT_TRIPS = [
  { city: "Lisbon, 5 days", why: "Walkable, café-dense, $140/day matches your band." },
  { city: "Istanbul, 6 days", why: "Persian and Levantine food, plus bookshop street in Kadıköy." },
  { city: "Quebec City, weekend", why: "Two hours by train, same history density, no flight." },
];

export const PARSED = [
  { label: "Destination", value: "Montreal, Canada", note: "read from your prompt" },
  { label: "Dates", value: "Sep 15 – 19", note: "4 days, 4 nights" },
  { label: "Budget", value: "$150 / day", note: "$600 total, food included" },
  { label: "Travellers", value: "2 adults", note: "one profile learned, one new" },
];

export const PICKERS = [
  { label: "Daily pace", key: "pace" as const, options: [["Easy", "2–3 stops"], ["Balanced", "4–5 stops"], ["Packed", "6+ stops"]] },
  { label: "Walking per day", key: "walk" as const, options: [["≤3 km", "transit-heavy"], ["~6 km", "mixed"], ["10 km+", "walk everything"]] },
  { label: "Dinner ceiling", key: "dinner" as const, options: [["$20", "street food"], ["$35", "local sit-down"], ["$50+", "one splurge nightly"]] },
];

export const STEP_COPY: Record<number, [string, string]> = {
  1: ["Here’s what I understood", "Correct anything that looks wrong — I built the rest of the plan on these four facts."],
  2: ["What should I chase?", "Pick as many as you like. These only set the starting weights; Echo takes over once you start tapping things."],
  3: ["How hard should I push you?", "Pace, walking tolerance and the dinner ceiling do most of the work in ranking."],
  4: ["Ready to dispatch", "Eight agents, four days, one plan that keeps rewriting itself."],
};

export const EXAMPLES = [
  "Three days in Toronto, $120/day, art and coffee",
  "Lisbon week — viewpoints, seafood, no early mornings",
  "Kyoto in November, temples and second-hand books",
];

export const DAY_TABS = [
  { day: 1, date: "Sep 15", label: "Arrival" },
  { day: 2, date: "Sep 16", label: "Today" },
  { day: 3, date: "Sep 17", label: "Mile End" },
  { day: 4, date: "Sep 18", label: "Museums" },
];

export const QUESTIONS = [
  { text: "Thursday has a 3-hour gap after the museum. Fill it with the record shops you lingered on, or leave it open?", yes: "Fill it", no: "Leave it open" },
  { text: "Bota Bota spa is $60 — over your daily ceiling. Want me to make Wednesday cheaper to fit it?", yes: "Make room", no: "Skip the spa" },
  { text: "Your flight home is 7 AM Friday. Book the 5:20 AM 747 bus for $11?", yes: "Book it", no: "I’ll decide later" },
];

export const TRANSPORT = [
  { mode: "Walk", time: "6 min", cost: "$0", tag: "Dash picks this", tagBg: "#EAF4F2", tagFg: "#0F6F68" },
  { mode: "Metro · Place-d’Armes", time: "9 min", cost: "$3.35", tag: "Rain-safe", tagBg: "#F4EBFB", tagFg: "#5B3FD6" },
  { mode: "Bike share", time: "4 min", cost: "$5", tag: "Wet roads", tagBg: "#FFF1E7", tagFg: "#A2542F" },
  { mode: "Uber", time: "5 min", cost: "$14", tag: "Over budget", tagBg: "#FDEDEA", tagFg: "#A83A22" },
];

export const ALTS = [
  { name: "Drawn & Quarterly", meta: "Bookstore · 4.8 ★ · 2.4 km", why: "Better stock, but it eats 22 minutes of transit.", slotId: "wl-alt-dq" },
  { name: "Château Ramezay", meta: "Historic house · $13", why: "History over books, same rain protection.", slotId: "wl-alt-ramezay" },
  { name: "Crew Collective café", meta: "Café · 4.5 ★ · $7", why: "A bank turned café. Closest thing to both.", slotId: "wl-alt-crew" },
];

export const SPEND_CATS = [
  { label: "Food", amount: "$131", color: C },
  { label: "Stay", amount: "$75", color: V },
  { label: "Attractions", amount: "$56", color: T },
  { label: "Transport", amount: "$50", color: A },
];

export const BUDGET_DAYS = [
  { label: "Mon · arrival", amount: "$142 / $150", pct: "95%", color: "#1FA39A" },
  { label: "Tue · today", amount: "$64 so far", pct: "43%", color: "#F2A93B" },
  { label: "Wed · projected", amount: "$118", pct: "79%", color: "#DDD3C2" },
  { label: "Thu · projected", amount: "$93", pct: "62%", color: "#DDD3C2" },
];

export const TXNS = [
  { name: "Café Olimpico", when: "today 08:52", amount: "$6", color: C },
  { name: "Notre-Dame entry ×2", when: "today 11:10", amount: "$32", color: A },
  { name: "Café Tehran", when: "today 13:04", amount: "$22", color: C },
  { name: "Metro day pass", when: "today 09:14", amount: "$4", color: T },
  { name: "Hôtel Nelligan · night 1", when: "yesterday", amount: "$186", color: V },
];

export const TRAITS = [
  { label: "Budget band", value: "Medium · $28 avg meal", pct: "92%" },
  { label: "Food", value: "Persian, Levantine, cafés", pct: "88%" },
  { label: "Activities", value: "History + culture", pct: "85%" },
  { label: "Transport", value: "Walk first, transit second", pct: "81%" },
  { label: "Walking ceiling", value: "~6 km per day", pct: "74%" },
  { label: "Nightlife", value: "Low — skipped 6 of 6", pct: "96%" },
];

export const SIGNALS = [
  { kind: "saved", text: "Saved 5 museums, rejected 0 — history is a hard preference, not a soft one." },
  { kind: "dwell", text: "Spent 4 min 12 s on the record-shop card without tapping it." },
  { kind: "rejected", text: "Declined three dinners over $45. Morsel dropped its price ceiling to $35." },
  { kind: "route", text: "Walked 3 legs Waylo had planned as transit. Dash now defaults to walking under 2.5 km." },
  { kind: "search", text: "Searched “bookstore” 7 times in 2 days — Echo promoted it to a top-3 interest." },
];

export const FEED = [
  { agent: "Nimbus → Atlas", when: "12 min ago", color: SKY, text: "Rain confidence for 3–5 PM went from 40% to 82%. Flagged two outdoor stops.", tag: "Perception", undo: false },
  { agent: "Atlas", when: "11 min ago", color: V, text: "Mount Royal moved to Wednesday 09:00. Pointe-à-Callière took the 2 PM slot — indoor, 6 min from lunch, $26 fits today’s remaining $86.", tag: "Re-plan", undo: true },
  { agent: "Dash", when: "11 min ago", color: T, text: "Route rebuilt: the 11 bus is no longer needed. You walk 400 m instead and save $3.35.", tag: "Action", undo: true },
  { agent: "Echo", when: "1 h ago", color: P, text: "You declined a $52 dinner. Restaurant ceiling lowered from $45 to $35 for the rest of the trip.", tag: "Learning", undo: true },
  { agent: "Morsel", when: "3 h ago", color: C, text: "Café Tehran confirmed open — their Tuesday closure was last month’s hours. Lunch stays at 12:45.", tag: "Verification", undo: false },
  { agent: "Fixer", when: "yesterday", color: SAND, text: "Pharmacy 120 m from the hotel, open until 22:00. Noted for the blister situation.", tag: "Local", undo: false },
];

export const BOOKINGS = [
  { name: "Hôtel Nelligan", meta: "Sep 15–19 · 4 nights · Old Montreal", status: "Confirmed", cost: "$744" },
  { name: "Notre-Dame Basilica", meta: "Tue 11:15 · 2 tickets", status: "Ticketed", cost: "$32" },
  { name: "Damas", meta: "Tue 19:00 · table for 2", status: "Reserved", cost: "—" },
  { name: "747 airport bus", meta: "Fri 05:20 · awaiting your yes", status: "Held", cost: "$11" },
];

export const SAVES = [
  { name: "Bota Bota spa", meta: "$60 · needs budget room" },
  { name: "Drawn & Quarterly", meta: "Bookstore · Mile End" },
  { name: "Schwartz’s Deli", meta: "Queue 25 min" },
  { name: "Habitat 67 walk", meta: "Outdoor · needs sun" },
  { name: "Crew Collective", meta: "Café · work-friendly" },
  { name: "Jean-Talon Market", meta: "Covered · Wed 16:00" },
].map((x) => ({ ...x, slotId: "wl-save-" + x.name.toLowerCase().replace(/[^a-z]+/g, "-") }));

export const INITIAL_CHAT = [
  { agent: "Atlas", role: "orchestrator", color: V, text: "Afternoon. You have three hours before the 19:00 table at Damas, and rain starts in about twenty minutes. Indoor, cheap, or close — what matters most right now?" },
  { user: true, text: "Cheap and dry. I don’t want to spend more today." },
  { agent: "Echo", role: "personalization", color: P, text: "Then the bookstore, not the spa. You are at $64 of $150, and Librairie Bertrand is free, indoors and six minutes away — plus bookstores are your strongest signal this trip." },
  { agent: "Dash", role: "transport", color: T, text: "Walk it: 400 m, six minutes, no metro fare. If the rain lands early I can reroute you through the covered passage at Place d’Armes." },
] as ChatMessage[];

export interface ChatMessage {
  user?: boolean;
  agent?: string;
  role?: string;
  color?: string;
  text: string;
}

export const NAV_ITEMS = [
  { key: "today", label: "Today", href: "/today" },
  { key: "now", label: "Now", href: "/now" },
  { key: "itinerary", label: "Plan", href: "/itinerary" },
  { key: "explore", label: "Explore", href: "/explore" },
  { key: "stay", label: "Stay", href: "/stay" },
  { key: "around", label: "Transport", href: "/around" },
  { key: "local", label: "Essentials", href: "/local" },
  { key: "chat", label: "Crew", href: "/chat" },
  { key: "budget", label: "Budget", href: "/budget" },
  { key: "profile", label: "You", href: "/profile" },
  { key: "saved", label: "Saved", href: "/saved" },
  { key: "recap", label: "Recap", href: "/recap" },
];

/**
 * Money on screen.
 *
 * The UI was written with a "$" typed straight into the string, so a Barcelona trip
 * quoted euros with a dollar sign and a Tokyo trip invented cents. Everything that
 * renders an amount goes through here instead.
 */
const SYMBOLS: Record<string, string> = {
  USD: "$", CAD: "$", AUD: "$", NZD: "$", SGD: "$", HKD: "$",
  EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", KRW: "₩",
  INR: "₹", TRY: "₺", RUB: "₽", ILS: "₪", PHP: "₱",
  THB: "฿", VND: "₫", NGN: "₦", UAH: "₴",
};

/** Currencies conventionally written without decimal places. */
const WHOLE = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "HUF", "TWD"]);

export function money(amount: number, currency = "USD"): string {
  const code = currency.toUpperCase();
  const rounded = WHOLE.has(code) ? Math.round(amount) : Math.round(amount * 100) / 100;
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  const symbol = SYMBOLS[code];
  // Ambiguous dollars get their code so a Canadian and a Singaporean price never look alike.
  if (symbol === "$" && code !== "USD") return `${symbol}${shown} ${code}`;
  return symbol ? `${symbol}${shown}` : `${shown} ${code}`;
}

/** Just the symbol, for input adornments and axis labels. */
export function symbolFor(currency = "USD"): string {
  return SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
}

/**
 * The currency a country actually spends, so a trip gets the right one before any
 * price is ever fetched. Falls back to USD, which is at least obviously a guess.
 */
const BY_COUNTRY: Record<string, string> = {
  ca: "CAD", us: "USD", mx: "MXN", gb: "GBP", ie: "EUR", fr: "EUR", es: "EUR",
  pt: "EUR", it: "EUR", de: "EUR", at: "EUR", nl: "EUR", be: "EUR", gr: "EUR",
  fi: "EUR", ee: "EUR", lv: "EUR", lt: "EUR", sk: "EUR", si: "EUR", hr: "EUR",
  cy: "EUR", mt: "EUR", lu: "EUR", ch: "CHF", no: "NOK", se: "SEK", dk: "DKK",
  is: "ISK", pl: "PLN", cz: "CZK", hu: "HUF", ro: "RON", bg: "BGN", tr: "TRY",
  ua: "UAH", ru: "RUB", jp: "JPY", kr: "KRW", cn: "CNY", hk: "HKD", tw: "TWD",
  sg: "SGD", my: "MYR", th: "THB", vn: "VND", id: "IDR", ph: "PHP", in: "INR",
  ae: "AED", sa: "SAR", qa: "QAR", il: "ILS", eg: "EGP", ma: "MAD", za: "ZAR",
  ng: "NGN", ke: "KES", au: "AUD", nz: "NZD", br: "BRL", ar: "ARS", cl: "CLP",
  co: "COP", pe: "PEN", uy: "UYU", cr: "CRC", pa: "PAB", do: "DOP", is_: "ISK",
};

const BY_COUNTRY_NAME: Record<string, string> = {
  canada: "CAD", "united states": "USD", usa: "USD", mexico: "MXN",
  "united kingdom": "GBP", england: "GBP", scotland: "GBP", wales: "GBP",
  ireland: "EUR", france: "EUR", spain: "EUR", portugal: "EUR", italy: "EUR",
  germany: "EUR", austria: "EUR", netherlands: "EUR", belgium: "EUR",
  greece: "EUR", finland: "EUR", croatia: "EUR", switzerland: "CHF",
  norway: "NOK", sweden: "SEK", denmark: "DKK", iceland: "ISK", poland: "PLN",
  czechia: "CZK", "czech republic": "CZK", hungary: "HUF", romania: "RON",
  turkey: "TRY", "türkiye": "TRY", ukraine: "UAH", japan: "JPY",
  "south korea": "KRW", china: "CNY", "hong kong": "HKD", taiwan: "TWD",
  singapore: "SGD", malaysia: "MYR", thailand: "THB", vietnam: "VND",
  indonesia: "IDR", philippines: "PHP", india: "INR",
  "united arab emirates": "AED", "saudi arabia": "SAR", qatar: "QAR",
  israel: "ILS", egypt: "EGP", morocco: "MAD", "south africa": "ZAR",
  nigeria: "NGN", kenya: "KES", australia: "AUD", "new zealand": "NZD",
  brazil: "BRL", argentina: "ARS", chile: "CLP", colombia: "COP", peru: "PEN",
};

export function currencyFor(country?: string, countryCode?: string): string {
  if (countryCode && BY_COUNTRY[countryCode.toLowerCase()]) return BY_COUNTRY[countryCode.toLowerCase()];
  if (country && BY_COUNTRY_NAME[country.toLowerCase().trim()]) return BY_COUNTRY_NAME[country.toLowerCase().trim()];
  return "USD";
}

/**
 * Units of each currency per 1 USD.
 *
 * Hand-entered approximate mid-market rates, vintage 2026, with no feed behind them —
 * they drift and nobody should read them as a quote. They exist for one job: the app's
 * modelled prices (category guesses in providers/normalize, fares in providers/osrm) are
 * all dollar-sized, and were being stamped with the destination's currency code without
 * being converted, so a Tokyo café came out at ¥7 and an 11 km taxi at ¥23. Converting a
 * guess does not make it precise — it stops the number being wrong by a factor of a
 * hundred. Every amount that passes through here still carries a low confidence and a
 * note saying it is modelled.
 */
const RATES_PER_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CHF: 0.88, CAD: 1.36, AUD: 1.52, NZD: 1.64, MXN: 18,
  NOK: 10.8, SEK: 10.5, DKK: 6.9, ISK: 138, PLN: 3.9, CZK: 23, HUF: 360, RON: 4.6,
  BGN: 1.8, TRY: 34, UAH: 41, RUB: 92,
  JPY: 150, KRW: 1350, CNY: 7.2, HKD: 7.8, TWD: 32, SGD: 1.34, MYR: 4.7, THB: 35,
  VND: 25000, IDR: 15800, PHP: 56, INR: 84,
  AED: 3.67, SAR: 3.75, QAR: 3.64, ILS: 3.7, EGP: 48, MAD: 9.9, ZAR: 18, NGN: 1550,
  KES: 129,
  BRL: 5.5, ARS: 1000, CLP: 950, COP: 4200, PEN: 3.8, UYU: 40, CRC: 520, PAB: 1, DOP: 60,
};

/**
 * Convert a modelled amount, rounded the way the target currency is written.
 *
 * An unknown code is returned untouched rather than converted at 1:1 and passed off as
 * money in another currency — a missing rate is a missing rate, not parity.
 */
export function convert(amount: number, from: string, to: string): number {
  const src = from.toUpperCase();
  const dst = to.toUpperCase();
  const rateFrom = RATES_PER_USD[src];
  const rateTo = RATES_PER_USD[dst];
  if (src !== dst && (!rateFrom || !rateTo)) return amount;
  const converted = src === dst ? amount : (amount / rateFrom) * rateTo;
  // Rounded even when nothing was converted, so the raw `amount` a screen adds up never
  // disagrees with the string `money()` printed from it.
  return WHOLE.has(dst) ? Math.round(converted) : Math.round(converted * 100) / 100;
}

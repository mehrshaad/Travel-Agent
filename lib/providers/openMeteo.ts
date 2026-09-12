import type { Cache, ProviderContext, WeatherProvider } from "@/types/providers";
import type { BadWeatherWindow, ISODate, LatLng, WeatherCode, WeatherDay, WeatherForecast, WeatherHour } from "@/types";
import { normalizeKey } from "@/lib/cache/key";
import { fetchJson } from "./http";

const TTL = 60 * 60; // 1 hour — a stale forecast defeats the whole feature.

interface MeteoResponse {
  timezone: string;
  utc_offset_seconds: number;
  hourly: {
    time: string[]; temperature_2m: number[]; apparent_temperature: number[];
    precipitation: number[]; precipitation_probability: number[];
    weathercode: number[]; windspeed_10m: number[];
  };
  daily: {
    time: string[]; weathercode: number[]; temperature_2m_max: number[];
    temperature_2m_min: number[]; precipitation_probability_max: number[];
    sunrise: string[]; sunset: string[];
  };
}

/** WMO code -> our vocabulary. */
function toCode(wmo: number): WeatherCode {
  if (wmo === 0) return "clear";
  if (wmo === 45 || wmo === 48) return "fog";
  if (wmo >= 95) return "storm";
  if ((wmo >= 71 && wmo <= 77) || wmo === 85 || wmo === 86 || wmo === 66 || wmo === 67) return "snow";
  if (wmo === 65 || wmo === 82) return "heavy_rain";
  if ((wmo >= 51 && wmo <= 67) || (wmo >= 80 && wmo <= 82)) return "rain";
  return "cloudy";
}

/** Open-Meteo returns naive local times ("2026-09-12T00:00"). Our ISODateTime needs an offset. */
function withOffset(naive: string, offsetSeconds: number): string {
  const sign = offsetSeconds < 0 ? "-" : "+";
  const abs = Math.abs(offsetSeconds);
  const hh = String(Math.floor(abs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  const stamp = naive.length === 16 ? `${naive}:00` : naive;
  return `${stamp}${sign}${hh}:${mm}`;
}

const THRESHOLDS = { chance: 50, mm: 0.5, minTempC: -5, maxTempC: 35, windKph: 40 };

function friendly(h: { precipitationChance: number; precipitationMm: number; tempC: number; windKph: number }) {
  return (
    h.precipitationChance < THRESHOLDS.chance &&
    h.precipitationMm < THRESHOLDS.mm &&
    h.tempC > THRESHOLDS.minTempC &&
    h.tempC < THRESHOLDS.maxTempC &&
    h.windKph < THRESHOLDS.windKph
  );
}

/** Merge consecutive hostile hours. Runs under 2h are ignored — a twitchy replanner reads as broken. */
function badWindows(hours: WeatherHour[]): BadWeatherWindow[] {
  const out: BadWeatherWindow[] = [];
  let run: WeatherHour[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const mm = run.reduce((s, h) => s + h.precipitationMm, 0);
      const peak = Math.max(...run.map((h) => h.precipitationChance));
      out.push({
        from: run[0].time,
        to: run[run.length - 1].time,
        code: run.find((h) => h.code === "storm")?.code ?? run[0].code,
        reason: `${run[0].code === "snow" ? "Snow" : "Rain"} ${run[0].time.slice(11, 16)}–${run[run.length - 1].time.slice(11, 16)}, ${peak}% confidence`,
        severity: mm > 6 || run.length >= 5 ? "severe" : mm > 1.5 ? "moderate" : "minor",
      });
    }
    run = [];
  };
  for (const h of hours) (h.outdoorFriendly ? flush() : run.push(h));
  flush();
  return out;
}

export function createWeatherProvider(cache: Cache): WeatherProvider {
  async function fetchRaw(coords: LatLng, start: ISODate, end: ISODate, ctx?: ProviderContext) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat.toFixed(4)}&longitude=${coords.lng.toFixed(4)}` +
      `&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weathercode,windspeed_10m` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
      `&timezone=auto&start_date=${start}&end_date=${end}`;
    return fetchJson<MeteoResponse>({ url, tool: "open_meteo", rateLimitKey: "open-meteo", minIntervalMs: 200, ctx });
  }

  return {
    async forecast(coords, start, end, ctx) {
      const key = normalizeKey(["meteo", coords.lat.toFixed(3), coords.lng.toFixed(3), start, end]);
      const cached = await cache.get<WeatherForecast>(key);
      if (cached) return cached;

      const d = await fetchRaw(coords, start, end, ctx);
      const off = d.utc_offset_seconds;

      const allHours: WeatherHour[] = d.hourly.time.map((t, i) => {
        const base = {
          tempC: d.hourly.temperature_2m[i],
          precipitationMm: d.hourly.precipitation[i] ?? 0,
          precipitationChance: d.hourly.precipitation_probability[i] ?? 0,
          windKph: d.hourly.windspeed_10m[i] ?? 0,
        };
        return {
          time: withOffset(t, off),
          feelsLikeC: d.hourly.apparent_temperature[i],
          code: toCode(d.hourly.weathercode[i]),
          outdoorFriendly: friendly(base),
          ...base,
        };
      });

      const days: WeatherDay[] = d.daily.time.map((date, i) => {
        const hours = allHours.filter((h) => h.time.startsWith(date));
        return {
          date,
          minTempC: d.daily.temperature_2m_min[i],
          maxTempC: d.daily.temperature_2m_max[i],
          code: toCode(d.daily.weathercode[i]),
          precipitationChance: d.daily.precipitation_probability_max[i] ?? 0,
          sunrise: withOffset(d.daily.sunrise[i], off),
          sunset: withOffset(d.daily.sunset[i], off),
          hours,
          badWindows: badWindows(hours),
        };
      });

      const forecast: WeatherForecast = { days, fetchedAt: new Date().toISOString(), source: "open_meteo" };
      await cache.set(key, forecast, TTL);
      return forecast;
    },

    /** timezone=auto gives us the IANA name for free — this is how geocoding gets its timezone. */
    async timezoneFor(coords, ctx) {
      const key = normalizeKey(["tz", coords.lat.toFixed(2), coords.lng.toFixed(2)]);
      const cached = await cache.get<string>(key);
      if (cached) return cached;
      const today = new Date().toISOString().slice(0, 10);
      const d = await fetchRaw(coords, today, today, ctx);
      await cache.set(key, d.timezone, 30 * 24 * 60 * 60);
      return d.timezone;
    },
  };
}

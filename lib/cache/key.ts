const coordinateKeys = new Set(["lat", "lng", "latitude", "longitude"]);

function normalizeValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }

  if (typeof value === "number" && key && coordinateKeys.has(key.toLowerCase())) {
    return Number(value.toFixed(4));
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([objectKey, objectValue]) => [
          objectKey.toLowerCase(),
          normalizeValue(objectValue, objectKey),
        ]),
    );
  }

  return value;
}

export function normalizeKey(parts: unknown): string {
  return JSON.stringify(normalizeValue(parts)) ?? "undefined";
}

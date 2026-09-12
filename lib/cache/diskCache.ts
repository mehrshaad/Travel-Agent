import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Cache, CacheStats } from "@/types/providers";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class DiskCache implements Cache {
  private hits = 0;
  private misses = 0;
  private readonly entries = new Set<string>();
  private readonly directory: string;

  constructor(namespace: string) {
    this.directory = join(".cache", namespace);
  }

  async get<T>(key: string): Promise<T | null> {
    const keyHash = this.hash(key);

    try {
      const contents = await readFile(this.pathFor(keyHash), "utf8");
      const entry = JSON.parse(contents) as CacheEntry<T>;

      if (typeof entry.expiresAt !== "number" || entry.expiresAt <= Date.now()) {
        this.misses += 1;
        this.entries.delete(keyHash);
        return null;
      }

      this.hits += 1;
      this.entries.add(keyHash);
      return entry.value;
    } catch {
      this.misses += 1;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const keyHash = this.hash(key);
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlSeconds * 1_000,
    };

    try {
      await mkdir(this.directory, { recursive: true });
      await writeFile(this.pathFor(keyHash), JSON.stringify(entry), "utf8");
      this.entries.add(keyHash);
    } catch {}
  }

  stats(): CacheStats {
    const total = this.hits + this.misses;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      entries: this.entries.size,
    };
  }

  private hash(key: string): string {
    return createHash("sha1").update(key).digest("hex");
  }

  private pathFor(keyHash: string): string {
    return join(this.directory, `${keyHash}.json`);
  }
}

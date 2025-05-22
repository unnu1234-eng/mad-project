import fs from "fs/promises";
import chalk from "chalk";
import { ObserveResult } from "@browserbasehq/stagehand";
import { log } from "./logging";

const CACHE_FILE = "cache/cache.json";

export async function simpleCache(
  instruction: string,
  actionToCache: ObserveResult,
) {
  try {
    let cache: Record<string, ObserveResult> = {};
    try {
      const existingCache = await fs.readFile(CACHE_FILE, "utf-8");
      cache = JSON.parse(existingCache);
    } catch (error) {}

    cache[instruction] = actionToCache;
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    log(chalk.red("Failed to save to cache:") + ` ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readCache(
  instruction: string,
): Promise<ObserveResult | null> {
  try {
    const existingCache = await fs.readFile(CACHE_FILE, "utf-8");
    const cache: Record<string, ObserveResult> = JSON.parse(existingCache);
    return cache[instruction] || null;
  } catch (error) {
    return null;
  }
}
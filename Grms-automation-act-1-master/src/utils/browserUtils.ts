import { ObserveResult, Page } from "@browserbasehq/stagehand";
import chalk from "chalk";
import { log } from "./logging";
import { drawObserveOverlay, clearOverlays } from "./overlay";
import { simpleCache, readCache } from "./cache";

export async function clickWithRetry(
  page: Page, 
  action: string, 
  options: { retries?: number; timeout?: number } = {}
): Promise<void> {
  const { retries = 3, timeout = 10000 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForSelector("body", { state: "visible" });
      await page.act(action);
      await page.waitForTimeout(1000);
      return;
    } catch (e) {
      log(`Attempt ${attempt} failed for action '${action}': ${e instanceof Error ? e.message : String(e)}`);
      if (attempt === retries) throw e;
      await page.waitForTimeout(1000 * attempt); // Exponential backoff
    }
  }
}

export async function typeWithRetry(
  page: Page, 
  action: string, 
  options: { retries?: number; timeout?: number } = {}
): Promise<void> {
  const { retries = 3, timeout = 10000 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForSelector("body", { state: "visible" });
      await page.act(action);
      await page.waitForTimeout(1000);
      return;
    } catch (e) {
      log(`Attempt ${attempt} failed for action '${action}': ${e instanceof Error ? e.message : String(e)}`);
      if (attempt === retries) throw e;
      await page.waitForTimeout(1000 * attempt); // Exponential backoff
    }
  }
}

export async function observeWithRetry(
  page: Page, 
  instruction: string, 
  options: { retries?: number; timeout?: number; selector?: string } = {}
): Promise<ObserveResult[] | null> {
  const { retries = 3, timeout = 10000, selector } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.waitForLoadState("domcontentloaded");
      
      if (selector) {
        // Poll for selector visibility
        await page.waitForFunction(
          (sel: string) => {
            const el = document.querySelector(sel);
            return !!el && el.isConnected && window.getComputedStyle(el).display !== "none";
          },
          selector,
          { polling: 500 }
        );
      }
      
      const observations = await page.observe(instruction);
      
      if (observations && observations.length > 0) {
        return observations;
      }
      
      log(`Attempt ${attempt} failed for observe '${instruction}' with selector '${selector || "none"}': No results`);
    } catch (e) {
      log(`Attempt ${attempt} failed for observe '${instruction}' with selector '${selector || "none"}': ${e instanceof Error ? e.message : String(e)}`);
    }
    
    if (attempt === retries) {
      return null;
    }
    
    await page.waitForTimeout(1000 * attempt); // Exponential backoff
  }
  
  return null;
}

export async function actWithCache(page: Page, instruction: string): Promise<void> {
  const cachedAction = await readCache(instruction);
  
  if (cachedAction) {
    log(chalk.blue("Using cached action for:") + ` ${instruction}`);
    await page.act(cachedAction);
    return;
  }
  
  const results = await page.observe(instruction);
  log(chalk.blue("Got results:") + ` ${JSON.stringify(results)}`);
  
  if (!results || results.length === 0) {
    throw new Error(`No observe results found for instruction: ${instruction}`);
  }
  
  const actionToCache = results[0];
  log(chalk.blue("Taking cacheable action:") + ` ${JSON.stringify(actionToCache)}`);
  await simpleCache(instruction, actionToCache);
  
  await drawObserveOverlay(page, results);
  await page.waitForTimeout(1000);
  await clearOverlays(page);
  
  await page.act(actionToCache);
}
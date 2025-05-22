import { Page, ObserveResult } from "@browserbasehq/stagehand";
import fs from "fs/promises";
import path from "path";

// Cache storage
const actionCache = new Map();

/**
 * Options for actWithCache function
 */
interface ActWithCacheOptions {
  /** Force cache invalidation and rerun the action */
  force?: boolean;
  /** Mark action as dynamic (won't be cached) */
  dynamic?: boolean;
  /** Cache duration in ms (default: 1 hour) */
  ttl?: number;
}

/**
 * Execute a browser action with caching capabilities
 * 
 * @param page - The Stagehand page instance
 * @param key - Unique key to identify this action
 * @param action - Async function that performs the browser action
 * @param options - Caching options
 * @returns The result from the observe call, if any
 */
export async function actWithCache<T>(
  page: Page,
  key: string,
  action: () => Promise<T>,
  options: ActWithCacheOptions = {}
): Promise<T> {
  const { force = false, dynamic = false, ttl = 3600000 } = options;
  
  // Don't use cache for dynamic actions
  if (dynamic) {
    return await action();
  }

  const cacheKey = `${page.url()}_${key}`;
  const now = Date.now();
  
  // Check if action is cached and not expired
  if (!force && actionCache.has(cacheKey)) {
    const cached = actionCache.get(cacheKey);
    if (cached && (now - cached.timestamp < ttl)) {
      return cached.result;
    }
  }

  // Execute action and cache result
  try {
    const result = await action();
    actionCache.set(cacheKey, {
      result,
      timestamp: now
    });
    return result;
  } catch (error) {
    // Clear cache on error
    actionCache.delete(cacheKey);
    throw error;
  }
}

/**
 * Clear all cached actions
 */
export function clearCache(): void {
  actionCache.clear();
}

/**
 * Save cache to disk
 * 
 * @param filePath - Path to save cache
 */
export async function saveCacheToDisk(filePath: string): Promise<void> {
  try {
    // Convert Map to serializable object
    const serializable = Array.from(actionCache.entries()).reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, any>);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
}

/**
 * Load cache from disk
 * 
 * @param filePath - Path to load cache from
 */
export async function loadCacheFromDisk(filePath: string): Promise<void> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Convert object back to Map
    Object.entries(parsed).forEach(([key, value]) => {
      actionCache.set(key, value);
    });
  } catch (error) {
    // Ignore if file doesn't exist
    if (error.code !== 'ENOENT') {
      console.error("Failed to load cache:", error);
    }
  }
}

/**
 * Take a screenshot and save it
 * 
 * @param page - The Stagehand page instance 
 * @param name - Screenshot name
 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}_${timestamp}.png`;
  const filePath = path.join(screenshotsDir, filename);
  
  await page.screenshot({ path: filePath });
  return filePath;
}

/**
 * Wait for an element to be visible on the page
 * 
 * @param page - The Stagehand page instance
 * @param instruction - Instruction to observe
 * @param timeout - Timeout in milliseconds
 * @returns The observe result
 */
export async function waitForElement(
  page: Page, 
  instruction: string, 
  timeout: number = 5000
): Promise<ObserveResult[]> {
  const startTime = Date.now();
  let result: ObserveResult[] | null = [];
  
  while (Date.now() - startTime < timeout) {
    result = await page.observe({ instruction });
    if (result && result.length > 0) {
      return result;
    }
    await page.waitForTimeout(500);
  }
  
  throw new Error(`Element not found within timeout: ${instruction}`);
}
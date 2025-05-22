import { Page, BrowserContext } from "@browserbasehq/stagehand";
import { clickWithRetry, observeWithRetry } from "../utils/browserUtils";
import { log } from "../utils/logging";
import { drawObserveOverlay, clearOverlays } from "../utils/overlay";

export async function navigateToAssessment(page: Page, context: BrowserContext) {
  log("Navigating to academic functions");
  try {
    // Wait for dashboard to load with increased timeout
    await page.waitForLoadState("networkidle", { timeout: 30000 });
    
    // Add a fixed delay to ensure UI is fully rendered
    await page.waitForTimeout(5000);

    // Poll for menu visibility with increased timeout
    await page.waitForFunction(
      () => {
        const menu = document.querySelector(".navbar, [role='navigation'], #menu, .nav, .menu, [id*='nav'], [class*='nav']");
        return !!menu && menu.isConnected && window.getComputedStyle(menu).display !== "none";
      },
      { timeout: 30000, polling: 1000 }
    );

    // Try multiple selectors for academic functions
    const academicSelectors = [
      "a:has-text('Academic Functions')", 
      "a:has-text('Academics')",
      "button:has-text('Academic')",
      ".nav-item:has-text('Academic')"
    ];
    
    // Try each selector
    let clicked = false;
    for (const selector of academicSelectors) {
      try {
        if (await page.$(selector)) {
          log(`Found academic functions using selector: ${selector}`);
          await page.click(selector, { timeout: 5000 });
          clicked = true;
          break;
        }
      } catch (err) {
        log(`Selector ${selector} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    if (!clicked) {
      // Fall back to the original approach if none of the selectors worked
      await clickWithRetry(page, "Click the 'Academic Functions', 'Academics', 'Academic', or 'Menu' link or button in the navigation bar or dashboard", {
        retries: 5,  // Increased retries
        timeout: 20000, // Increased timeout
      });
    }
    
    await page.waitForTimeout(5000); // Increased for dropdown rendering
  } catch (e) {
    log("Could not click academic functions, trying alternative approach");
    const observations = await observeWithRetry(page, "Identify the 'Academic Functions', 'Academics', 'Academic', or 'Menu' link or button in the navigation bar or dashboard", {
      retries: 3,
      timeout: 15000,
      selector: ".navbar, [role='navigation'], #menu, .nav, .menu, [id*='nav'], [class*='nav']"
    });

    if (observations?.length) {
      await drawObserveOverlay(page, observations);
      await page.waitForTimeout(1000);
      await clearOverlays(page);
      await page.act(observations[0]);
      await page.waitForTimeout(4000);
    } else {
      // Debug: Log visible navigation elements
      const navElements = await page.evaluate(() => {
        const elements = document.querySelectorAll(".navbar, [role='navigation'], #menu, .nav, .menu, [id*='nav'], [class*='nav'], a, button");
        return Array.from(elements).map(el => ({
          text: el.textContent?.trim() || "",
          tag: el.tagName,
          class: el.className,
          id: el.id,
          role: el.getAttribute("role"),
          visible: window.getComputedStyle(el).display !== "none"
        }));
      });
      log(`ERROR: Could not find academic functions menu. Current URL: ${page.url()}`);
      log(`Visible navigation elements: ${JSON.stringify(navElements, null, 2)}`);
      throw new Error("Could not find academic functions menu");
    }
  }

  // Validate menu opened (check for dropdown)
  const isDropdownVisible = await page.evaluate(() => !!document.querySelector('.dropdown-menu, [role="menu"], .dropdown.show, .nav-item.show'));
  if (!isDropdownVisible) {
    log(`ERROR: Academic functions menu did not open. Current URL: ${page.url()}`);
    throw new Error("Academic functions menu did not open");
  }

  log("Clicking online assessment option");
  try {
    await clickWithRetry(page, "Click the 'Online Assessment', 'Assessments', or 'Online Tests' link or button in the dropdown menu", {
      retries: 3,
      timeout: 15000,
    });
    await page.waitForTimeout(5000); // Increased for page load
  } catch (e) {
    log("Could not click online assessment, trying alternative approach");
    const observations = await observeWithRetry(page, "Identify the 'Online Assessment', 'Assessments', or 'Online Tests' link or button in the dropdown menu", {
      retries: 3,
      timeout: 15000,
      selector: ".dropdown-menu, [role='menu'], .dropdown-item, .nav-item, .menu-item"
    });
    if (observations?.length) {
      await drawObserveOverlay(page, observations);
      await page.waitForTimeout(1000);
      await clearOverlays(page);
      await page.act(observations[0]);
      await page.waitForTimeout(5000);
    } else {
      log(`ERROR: Could not find online assessment option. Current URL: ${page.url()}`);
      throw new Error("Could not find online assessment option");
    }
  }

  // Validate navigation to assessment page
  const currentUrl = page.url();
  log(`Navigated to: ${currentUrl}`);
  if (currentUrl.includes("home.htm")) {
    log(`ERROR: Still on home page after navigation attempt`);
    throw new Error("Failed to navigate to assessment page");
  }

  // Wait for assessment page to load
  await page.waitForTimeout(6000);
  try {
    // Add this where navigation elements can't be found
    const pageContent = await page.evaluate(() => document.body.innerHTML);
    log(`Page content structure: ${pageContent.substring(0, 500)}...`);
    const screenshot = await page.screenshot({ fullPage: true });
    log("Took screenshot of failed navigation");
    // Save screenshot to file if needed
  } catch (screenshotError) {
    log(`Failed to take screenshot: ${screenshotError}`);
}
// Add this in the catch block where navigation fails
}

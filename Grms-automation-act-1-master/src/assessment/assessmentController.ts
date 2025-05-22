import { Stagehand, Page, BrowserContext, ObserveResult } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays } from "../utils/overlay.js";
import { actWithCache } from "../utils/aseessUtils.js";
import{ answerQuestions} from "./answerQuestions.js";

// Initialize Stagehand with config
const stagehand = new Stagehand(StagehandConfig);
const DEBUG = process.env.DEBUG === "true";

export async function manageAssessment(
  page: Page,
  context: BrowserContext,
  questionCount: number = 10,
  assessmentKey: string = process.env.ASSESSMENT_KEY || "1234"
): Promise<void> {
  const logMessage = (msg: string, type: "info" | "error" | "success" = "info") => {
    const color = type === "error" ? chalk.red : type === "success" ? chalk.green : chalk.cyan;
    console.log(boxen(color(msg), { padding: 1, margin: 1, borderStyle: "round" }));
  };

  logMessage(`Starting assessment with ${questionCount} questions`);

  // Validate current page
  const currentUrl = await page.url();
  if (!currentUrl.includes("studentTest.htm")) {
    logMessage(`Not on test page. Current URL: ${currentUrl}`, "error");

    // Navigate to test page from home page
    if (currentUrl.includes("home.htm")) {
      logMessage("Attempting to navigate to test page from home page");
      try {
        const observeResult = await actWithCache(page, "navigate_assessment", async () => {
          const result = await page.observe({ instruction: "Observe the Internal Online Assessment link" });
          if (!result?.length) throw new Error("Internal Online Assessment link not found");
          await page.act({ action: "Click on Internal Online Assessment" });
          await page.waitForNavigation({ timeout: 10000 });
        });
        if (DEBUG && observeResult?.length) {
          await drawObserveOverlay(page, observeResult);
          await clearOverlays(page);
        }
      } catch (e) {
        logMessage(`Failed to navigate to assessment: ${e instanceof Error ? e.message : String(e)}`, "error");
        throw new Error("Unable to navigate to assessment page");
      }
    }
  }

  // Check if assessment needs to be started
  let observeResult: ObserveResult[] | null = await page.observe({ instruction: "Observe if a Start button is visible on the page" });
  if (DEBUG && observeResult?.length) {
    await drawObserveOverlay(page, observeResult);
    await clearOverlays(page);
  }
  const needsStart = observeResult?.length > 0;
  if (needsStart) {
    logMessage("Selecting an uncompleted assessment and clicking Start");
    try {
      observeResult = await actWithCache(page, "start_assessment", async () => {
        const result = await page.observe({ instruction: "Observe the Start button" });
        if (!result?.length) throw new Error("Start button not found");
        await page.act({ action: "Click the Start button" });
        await page.waitForNavigation({ timeout: 10000 });
      });
      if (DEBUG && observeResult?.length) {
        await drawObserveOverlay(page, observeResult);
        await clearOverlays(page);
      }

      // Handle key verification if needed
      observeResult = await page.observe({ instruction: "Observe if there is an input field for an assessment key" });
      if (DEBUG && observeResult?.length) {
        await drawObserveOverlay(page, observeResult);
        await clearOverlays(page);
      }
      const hasKeyInput = observeResult?.length > 0;
      if (hasKeyInput) {
        logMessage("Entering assessment key");
        observeResult = await actWithCache(page, "enter_key", async () => {
          const result = await page.observe({ instruction: "Observe the assessment key input field" });
          if (!result?.length) throw new Error("Assessment key input not found");
          await page.act({ action: `Type ${assessmentKey} into the assessment key input field` });
          await page.waitForTimeout(1000);
        });
        if (DEBUG && observeResult?.length) {
          await drawObserveOverlay(page, observeResult);
          await clearOverlays(page);
        }

        logMessage("Clicking Verify button");
        observeResult = await actWithCache(page, "verify_key", async () => {
          const result = await page.observe({ instruction: "Observe the Verify button" });
          if (!result?.length) throw new Error("Verify button not found");
          await page.act({ action: "Click the Verify button" });
          await page.waitForNavigation({ timeout: 10000 });
        });
        if (DEBUG && observeResult?.length) {
          await drawObserveOverlay(page, observeResult);
          await clearOverlays(page);
        }
      }

      // Check for Start Assessment button
      observeResult = await page.observe({ instruction: "Observe if a Start Assessment button is visible" });
      if (DEBUG && observeResult?.length) {
        await drawObserveOverlay(page, observeResult);
        await clearOverlays(page);
      }
      const hasStartAssessment = observeResult?.length > 0;
      if (hasStartAssessment) {
        logMessage("Clicking Start Assessment button");
        observeResult = await actWithCache(page, "start_assessment_button", async () => {
          const result = await page.observe({ instruction: "Observe the Start Assessment button" });
          if (!result?.length) throw new Error("Start Assessment button not found");
          await page.act({ action: "Click the Start Assessment button" });
          await page.waitForNavigation({ timeout: 10000 });
        });
        if (DEBUG && observeResult?.length) {
          await drawObserveOverlay(page, observeResult);
          await clearOverlays(page);
        }
      }
    } catch (e) {
      logMessage(`Error starting assessment: ${e instanceof Error ? e.message : String(e)}`, "error");
      throw new Error("Failed to start assessment");
    }
  }

  // Answer questions
  try {
    await answerQuestions(page, stagehand, questionCount, logMessage);
  } catch (e) {
    logMessage(`Error answering questions: ${e instanceof Error ? e.message : String(e)}`, "error");
    throw new Error("Failed to answer questions");
  }

  // End assessment (use dynamic option to avoid caching)
  logMessage("Attempting to end assessment");
  try {
    observeResult = await actWithCache(page, "end_assessment", async () => {
      const result = await page.observe({ instruction: "Observe the End Test button" });
      if (!result?.length) throw new Error("End Test button not found");
      await page.act({ action: "Click the End Test button" });
      await page.waitForTimeout(2000);
    }, { dynamic: true });
    if (DEBUG && observeResult?.length) {
      await drawObserveOverlay(page, observeResult);
      await clearOverlays(page);
    }

    // Handle confirmation prompt
    observeResult = await page.observe({ instruction: "Observe if a confirmation prompt with a Yes or OK button is visible" });
    if (DEBUG && observeResult?.length) {
      await drawObserveOverlay(page, observeResult);
      await clearOverlays(page);
    }
    const confirmPrompt = observeResult?.length > 0;
    if (confirmPrompt) {
      observeResult = await actWithCache(page, "confirm_end", async () => {
        const result = await page.observe({ instruction: "Observe the Yes button in the confirmation prompt" });
        if (!result?.length) throw new Error("Yes button not found");
        await page.act({ action: "Click the Yes button in the confirmation prompt" });
      }, { dynamic: true });
      if (DEBUG && observeResult?.length) {
        await drawObserveOverlay(page, observeResult);
        await clearOverlays(page);
      }
    }

    logMessage("Assessment completed successfully", "success");
  } catch (e) {
    logMessage(`Error ending assessment: ${e instanceof Error ? e.message : String(e)}`, "error");
    throw new Error("Failed to end assessment");
  }
}
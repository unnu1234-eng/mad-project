import { Page, Stagehand, ObserveResult } from "@browserbasehq/stagehand";
import chalk from "chalk";
import boxen from "boxen";
import { drawObserveOverlay, clearOverlays } from "../utils/overlay.js";
import { answerQuestion } from "./questionHandler.js";

const DEBUG = process.env.DEBUG === "true";

export async function answerQuestions(
  page: Page,
  stagehand: Stagehand,
  questionCount: number,
  logMessage: (msg: string, type?: "info" | "error" | "success") => void
): Promise<void> {
  logMessage("Starting to answer questions");

  let failedAttempts = 0;
  for (let i = 1; i <= questionCount; i++) {
    const success = await answerQuestion(page, i, stagehand);
    if (!success) {
      failedAttempts++;
      logMessage(`Failed to answer question ${i}`, "error");

      if (failedAttempts >= 3) {
        logMessage("Failed multiple questions in a row, aborting", "error");
        throw new Error("Failed too many questions, aborting");
      }

      // Try to continue to next question (avoid caching due to dynamic nature)
      try {
        logMessage("Attempting to advance to next question");
        const observeResult: ObserveResult[] | null = await page.observe({ instruction: "Observe the Save & Next button" });
        if (!observeResult?.length) throw new Error("Save & Next button not found");
        if (DEBUG && observeResult?.length) {
          await drawObserveOverlay(page, observeResult);
          await clearOverlays(page);
        }
        await page.act({ action: "Click the Save & Next button" });
        await page.waitForTimeout(2000);
      } catch (e) {
        logMessage(`Error advancing to next question: ${e instanceof Error ? e.message : String(e)}`, "error");
      }
    } else {
      failedAttempts = 0;
    }
  }
}
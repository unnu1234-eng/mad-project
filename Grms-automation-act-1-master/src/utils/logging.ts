import { Stagehand } from "@browserbasehq/stagehand";
import chalk from "chalk";

// Store the stagehand instance
let stagehandInstance: Stagehand;

// Set the stagehand instance
export function setStagehand(stagehand: Stagehand): void {
  stagehandInstance = stagehand;
}

// Get the stagehand instance
export function getStagehand(): Stagehand {
  if (!stagehandInstance) {
    throw new Error("Stagehand instance not set. Call setStagehand first.");
  }
  return stagehandInstance;
}

// Log function
export function log(message: string): void {
  console.log(chalk.blue("[GRMS]"), message);
  if (stagehandInstance) {
    stagehandInstance.log({
      category: "grms-automation",
      message,
    });
  }
}

// Announce function for important messages
export function announce(message: string, category: string = "GRMS"): void {
  console.log(chalk.green(`[${category}]`), message);
  if (stagehandInstance) {
    stagehandInstance.log({
      category: "grms-automation",
      message: `[${category}] ${message}`,
      level: 0,
    });
  }
}
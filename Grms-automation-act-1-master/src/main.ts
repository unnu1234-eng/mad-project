import { Stagehand } from "@browserbasehq/stagehand";
import * as dotenv from "dotenv";
import chalk from "chalk";
import { login } from "./auth/login";
import { navigateToAssessment } from "./navigation/assessmentNavigation";
import { manageAssessment } from "./assessment/assessmentController";
import { config } from "./config/stagehandConfig";
import { announce, setStagehand } from "./utils/logging";

dotenv.config();

async function run() {
  const stagehand = new Stagehand(config);
  await stagehand.init();
  setStagehand(stagehand);

  if (config.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    announce(
      `View this session live: \n${chalk.blue(
        `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`
      )}`,
      "Browserbase"
    );
  }

  const page = stagehand.page;
  const context = stagehand.context;

  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
    await login(page, context, { username: "22BTAI153@gcu.edu.in", password: "Iluusman1234" });
    await navigateToAssessment(page, context);
    await manageAssessment(page, context, 10);
  } catch (e) {
    console.error(`Automation failed: ${e instanceof Error ? e.message : String(e)}`);
    throw e; // Ensure script stops on failure
  } finally {
    await stagehand.close();
    announce(
      `GRMS automation completed! Feedback: ${chalk.blue("https://stagehand.dev/slack")}`,
      "Stagehand"
    );
  }
}

run();
import { Page, Stagehand } from "@browserbasehq/stagehand";
import { clickWithRetry } from "../utils/browserUtils";
import { log } from "../utils/logging";
import { getAIAnswer, AIAnswerResponse } from "../ai/aiAnswer";

export async function answerQuestion(page: Page, questionNumber: number, stagehand: Stagehand): Promise<boolean> {
  stagehand.log({
    category: "grms-automation",
    message: `Processing question ${questionNumber}`,
  });

  // Validate quiz page
  const currentUrl = await page.url();
  if (currentUrl.includes("home.htm")) {
    stagehand.log({
      category: "grms-automation",
      message: `ERROR: Cannot process question ${questionNumber} from home page: ${currentUrl}`,
    });
    return false;
  }

  try {
    // Wait for quiz interface to load
    await page.waitForFunction(
      () => {
        return document.querySelector('body')?.textContent?.includes("Question") &&
               document.querySelectorAll('input[type="radio"]').length > 0;
      },
      { timeout: 10000 }
    );

    // Extract question text using Stagehand's observe
    stagehand.log({
      category: "grms-automation",
      message: "Extracting question text",
    });
    const questionResult = await page.observe({ instruction: "Observe the question text on the quiz page" });
    let questionText = "";
    if (questionResult?.length) {
      const selector = questionResult[0].selector;
      questionText = await page.evaluate((sel: string) => {
        const element = sel.startsWith('/')
          ? document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
          : document.querySelector(sel);
        return element?.textContent?.trim().replace(/Question \d+ of \d+\s+/i, "") || "";
      }, selector);
    }
    if (!questionText) {
      stagehand.log({
        category: "grms-automation",
        message: `Failed to extract question text for question ${questionNumber}`,
      });
      return false;
    }

    // Extract options using Stagehand's observe
    stagehand.log({
      category: "grms-automation",
      message: "Extracting answer options",
    });
    const optionsResult = await page.observe({ instruction: "Observe all radio button options on the quiz page" });
    const options = optionsResult?.length
      ? await page.evaluate((selectors: string[]) => {
          return selectors
            .map(sel => {
              const element = sel.startsWith('/')
                ? document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
                : document.querySelector(sel);
              return element?.textContent?.trim();
            })
            .filter((opt): opt is string => !!opt && !opt.match(/^Option \d+$/i));
        }, optionsResult.map(el => el.selector))
      : [];
    if (options.length === 0) {
      stagehand.log({
        category: "grms-automation",
        message: `Failed to extract options for question ${questionNumber}`,
      });
      return false;
    }

    // Get AI answer from Gemini
    stagehand.log({
      category: "grms-automation",
      message: `Fetching AI answer for question: ${questionText.substring(0, 100)}...`,
    });
    const aiResponse: AIAnswerResponse = await getAIAnswer(questionText, options, stagehand);
    if (!aiResponse?.answer) {
      stagehand.log({
        category: "grms-automation",
        message: `No valid AI answer received for question ${questionNumber}`,
      });
      return false;
    }

    // Find and select the matching option
    let selectedOption = options.find(opt => opt.toLowerCase().includes(aiResponse.answer.toLowerCase()));
    if (!selectedOption) {
      stagehand.log({
        category: "grms-automation",
        message: `No direct match found for answer: ${aiResponse.answer}, using first option as fallback`,
      });
      selectedOption = options[0];
    }

    stagehand.log({
      category: "grms-automation",
      message: `Selecting option: ${selectedOption}`,
    });

    // Click the selected option using Stagehand
    try {
      await page.act({ action: `Click the radio button option containing "${selectedOption}"` });
    } catch (e) {
      stagehand.log({
        category: "grms-automation",
        message: `Stagehand act failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      await clickWithRetry(page, `Click the option containing "${selectedOption}"`, { timeout: 5000 });
    }

    // Click "Save & Next" button using Stagehand
    stagehand.log({
      category: "grms-automation",
      message: "Clicking Save & Next button",
    });
    try {
      await page.act({ action: "Click the Save & Next button" });
    } catch (e) {
      stagehand.log({
        category: "grms-automation",
        message: `Stagehand act on Save & Next failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      await clickWithRetry(page, "Click the Save & Next button", { retries: 2, timeout: 5000 });
    }

    // Wait for page transition
    await page.waitForTimeout(2000);

    stagehand.log({
      category: "grms-automation",
      message: `Question ${questionNumber} processed successfully`,
    });
    return true;
  } catch (e) {
    stagehand.log({
      category: "grms-automation",
      message: `Error processing question ${questionNumber}: ${e instanceof Error ? e.message : String(e)}. Current URL: ${currentUrl}`,
    });
    return false;
  }
}
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { Stagehand } from "@browserbasehq/stagehand";

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "AIzaSyBtl8q8OPzQwhO0V55xw21mcKzVbEhot1Q");
const model: GenerativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Define interface for AI answer response
export interface AIAnswerResponse {
  answer: string;
  confidence?: number;
  exactMatch: boolean;
}

/**
 * Get the correct answer using Google Generative AI
 * Enhanced for JUNO Campus quiz interface
 */
export async function getAIAnswer(questionText: string, options: string[], stagehand: Stagehand): Promise<AIAnswerResponse> {
  try {
    // Clean up options - sometimes JUNO interface includes option numbers in the text
    const cleanOptions = options.map(opt => opt.replace(/^(?:Option\s*\d+:?\s*)/i, "").trim());
    
    // For quiz questions about programming/development (like the one in screenshot),
    // provide additional technical context
    let contextHint = "";
    if (
      questionText.toLowerCase().includes("calculator") || 
      questionText.toLowerCase().includes("component") ||
      questionText.toLowerCase().includes("display") ||
      questionText.toLowerCase().includes("application")
    ) {
      contextHint = `
      Note: This appears to be a technical question about software development or UI components.
      - TextView is used to display text
      - EditText is used to display and edit text
      - Button is a clickable UI element
      - Spinner is a dropdown selection widget
      `;
    }

    const prompt = `
    You are an expert assistant helping with educational quizzes. Given the following multiple-choice question and options, identify the correct answer.
    
    ${contextHint}
    
    Return ONLY the exact text of the correct option as it appears in the options list. Do not include any option numbering or prefixes.
    
    Question: ${questionText}
    Options:
    ${cleanOptions.map((opt, index) => `${index + 1}. ${opt}`).join("\n")}
    
    Correct Answer:
    `;
    
    stagehand.log({
      category: "grms-automation",
      message: `Querying AI for question: ${questionText.substring(0, 100)}...`,
    });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let answer = response.text().trim();
    
    stagehand.log({
      category: "grms-automation",
      message: `AI returned answer: ${answer}`,
    });
    
    // First, check for direct match with options (ignoring case)
    for (const option of cleanOptions) {
      if (option.toLowerCase() === answer.toLowerCase()) {
        return { answer: option, exactMatch: true };
      }
    }
    
    // Check for partial matches where AI answer is contained in option or vice versa
    for (const option of cleanOptions) {
      if (option.toLowerCase().includes(answer.toLowerCase()) || 
          answer.toLowerCase().includes(option.toLowerCase())) {
        return { answer: option, exactMatch: false };
      }
    }
    
    // If no match found, perform simple keyword matching
    const answerWords = answer.toLowerCase().split(/\s+/);
    let bestMatch = cleanOptions[0];
    let maxMatches = 0;
    
    for (const option of cleanOptions) {
      const optionLower = option.toLowerCase();
      let matches = 0;
      
      for (const word of answerWords) {
        if (word.length > 3 && optionLower.includes(word)) {
          matches++;
        }
      }
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = option;
      }
    }
    
    // For technical questions about UI components (like in screenshot),
    // adjust the answer based on domain knowledge if needed
    if (questionText.toLowerCase().includes("display") && 
        questionText.toLowerCase().includes("result")) {
      // For calculator display questions, TextView or EditText are commonly correct
      if (cleanOptions.some(opt => opt.toLowerCase().includes("textview") || 
                                   opt.toLowerCase().includes("edittext"))) {
        const displayOption = cleanOptions.find(opt => 
          opt.toLowerCase().includes("textview") || opt.toLowerCase().includes("edittext")
        );
        if (displayOption) {
          stagehand.log({
            category: "grms-automation",
            message: `Domain knowledge suggests ${displayOption} for calculator display`,
          });
          return { answer: displayOption, exactMatch: false };
        }
      }
    }
    
    return { 
      answer: bestMatch, 
      confidence: maxMatches / answerWords.length,
      exactMatch: false
    };
    
  } catch (error) {
    stagehand.log({
      category: "grms-automation",
      message: `Error querying AI: ${error instanceof Error ? error.message : String(error)}`,
    });
    
    // Fallback to first option if AI fails
    return { answer: options[0], exactMatch: false };
  }
}
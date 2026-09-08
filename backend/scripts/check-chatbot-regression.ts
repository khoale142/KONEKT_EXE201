import "dotenv/config";
import { detectIntent } from "../src/modules/chat/intents/intent-detector";
import { intentHandlerRegistry } from "../src/modules/chat/intents/intent-handler-registry";
import { tryBuildSpecificProductResponse } from "../src/modules/chat/intents/product-catalog.service";

type IntentCase = {
  message: string;
  expectedIntentCode: string;
};

type ResponseCase = {
  message: string;
  expectedIntentCode: string;
  expectedSubstrings: string[];
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assertIncludesAll(text: string, expectedSubstrings: string[]): void {
  const normalizedText = normalizeText(text);
  for (const expected of expectedSubstrings) {
    const normalizedExpected = normalizeText(expected);
    if (!normalizedText.includes(normalizedExpected)) {
      throw new Error(`Missing expected text "${expected}" in answer: ${text}`);
    }
  }
}

async function runIntentCases(cases: IntentCase[]): Promise<void> {
  for (const testCase of cases) {
    const detectedIntent = await detectIntent(testCase.message);
    if (!detectedIntent) {
      throw new Error(`No intent detected for message: ${testCase.message}`);
    }

    if (detectedIntent.intent.code !== testCase.expectedIntentCode) {
      throw new Error(
        `Unexpected intent for "${testCase.message}". Expected ${testCase.expectedIntentCode}, received ${detectedIntent.intent.code}`
      );
    }
  }
}

async function runResponseCases(cases: ResponseCase[]): Promise<void> {
  for (const testCase of cases) {
    const detectedIntent = await detectIntent(testCase.message);
    if (!detectedIntent) {
      throw new Error(`No intent detected for message: ${testCase.message}`);
    }

    const directProductResponse = await tryBuildSpecificProductResponse(
      testCase.message,
      detectedIntent.intent.code
    );

    if (directProductResponse) {
      if (directProductResponse.intentCode !== testCase.expectedIntentCode) {
        throw new Error(
          `Unexpected direct response intent for "${testCase.message}". Expected ${testCase.expectedIntentCode}, received ${directProductResponse.intentCode}`
        );
      }
      assertIncludesAll(directProductResponse.answer, testCase.expectedSubstrings);
      continue;
    }

    const handler = intentHandlerRegistry.getHandler(detectedIntent.intent);
    if (!handler) {
      throw new Error(`No handler for intent ${detectedIntent.intent.code}`);
    }

    const response = await handler.handle({
      customerId: 0,
      message: testCase.message,
      detectedIntent,
      conversationId: 0,
    });

    if (response.intentCode !== testCase.expectedIntentCode) {
      throw new Error(
        `Unexpected response intent for "${testCase.message}". Expected ${testCase.expectedIntentCode}, received ${response.intentCode}`
      );
    }

    assertIncludesAll(response.answer, testCase.expectedSubstrings);
  }
}

async function main(): Promise<void> {
  const intentCases: IntentCase[] = [
    { message: "gio mo cua", expectedIntentCode: "faq" },
    { message: "cho toi biet gio mo cua", expectedIntentCode: "faq" },
    { message: "phindi choco", expectedIntentCode: "phindi_recommendation" },
    { message: "combo ca phe co gi", expectedIntentCode: "combo_recommendation" },
    { message: "chi nhanh o dau", expectedIntentCode: "nearest_store" },
  ];

  const responseCases: ResponseCase[] = [
    {
      message: "gio mo cua",
      expectedIntentCode: "faq",
      expectedSubstrings: ["gio", "coffee"],
    },
    {
      message: "phindi choco",
      expectedIntentCode: "phindi_recommendation",
      expectedSubstrings: ["phindi choco", "gia"],
    },
    {
      message: "combo ca phe co gi",
      expectedIntentCode: "combo_recommendation",
      expectedSubstrings: ["combo", "ca phe"],
    },
    {
      message: "chi nhanh da nang",
      expectedIntentCode: "nearest_store",
      expectedSubstrings: ["da nang", "dia chi"],
    },
    {
      message: "mon nay an kem gi",
      expectedIntentCode: "drink_pairing_combo_and_cake",
      expectedSubstrings: ["mon nao"],
    },
  ];

  await runIntentCases(intentCases);
  await runResponseCases(responseCases);

  console.log("chatbot regression checks passed");
}

void main().catch((error) => {
  console.error("chatbot regression checks failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

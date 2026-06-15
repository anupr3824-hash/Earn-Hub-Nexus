import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export interface FraudAnalysisResult {
  riskScore: number;
  reasons: string[];
  recommendation: "allow" | "flag" | "ban";
}

export async function analyzeUserFraud(userData: {
  telegramId: string;
  username?: string;
  completedTasksCount: number;
  withdrawalAmount?: number;
  referralCount: number;
  accountAgeDays: number;
  ipAddress?: string;
}): Promise<FraudAnalysisResult> {
  try {
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a fraud detection AI for a Telegram earning platform.
Analyze this user's activity and return a JSON fraud risk assessment.

User Data:
- Telegram ID: ${userData.telegramId}
- Username: ${userData.username ?? "unknown"}
- Completed Tasks: ${userData.completedTasksCount}
- Withdrawal Amount: ${userData.withdrawalAmount ?? 0}
- Referral Count: ${userData.referralCount}
- Account Age (days): ${userData.accountAgeDays}

Rules for fraud detection:
- New account (<7 days) with many referrals (>10) = high risk
- Very high task completion in short time = suspicious
- Large withdrawal from new account = high risk
- Normal gradual earning patterns = low risk

Return ONLY valid JSON in this exact format:
{
  "riskScore": <0-100 integer>,
  "reasons": ["reason1", "reason2"],
  "recommendation": "allow" | "flag" | "ban"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    return JSON.parse(jsonMatch[0]) as FraudAnalysisResult;
  } catch (err) {
    logger.error({ err }, "Gemini fraud analysis failed, using default");
    return { riskScore: 0, reasons: [], recommendation: "allow" };
  }
}

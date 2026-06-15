import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import { analyzeUserFraud } from "../lib/gemini";
import { requireAdmin } from "../middlewares/adminAuth";
import {
  GetUserRiskScoreParams,
  GetUserRiskScoreResponse,
  GetFraudReportsQueryParams,
  GetFraudReportsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/fraud/risk/:telegramId", requireAdmin, async (req, res): Promise<void> => {
  const params = GetUserRiskScoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const userDoc = await db.collection("users").doc(params.data.telegramId).get();
  if (!userDoc.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userData = userDoc.data()!;
  const accountCreated = new Date((userData.createdAt as string | undefined) ?? Date.now());
  const accountAgeDays = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));

  const analysis = await analyzeUserFraud({
    telegramId: params.data.telegramId,
    username: (userData.username as string | undefined) ?? undefined,
    completedTasksCount: (userData.taskCompletionCount as number | undefined) ?? 0,
    referralCount: (userData.referralCount as number | undefined) ?? 0,
    accountAgeDays,
  });

  await userDoc.ref.update({ riskScore: analysis.riskScore });

  if (analysis.riskScore > 70) {
    const now = new Date().toISOString();
    await db.collection("fraudReports").add({
      telegramId: params.data.telegramId,
      type: "ai_detection",
      description: analysis.reasons.join(", "),
      riskScore: analysis.riskScore,
      status: analysis.recommendation === "ban" ? "actioned" : "pending",
      createdAt: now,
    });
  }

  res.json(GetUserRiskScoreResponse.parse({
    telegramId: params.data.telegramId,
    riskScore: analysis.riskScore,
    reasons: analysis.reasons,
    recommendation: analysis.recommendation,
  }));
});

router.get("/fraud/reports", requireAdmin, async (req, res): Promise<void> => {
  const params = GetFraudReportsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const snap = await db.collection("fraudReports")
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));

  res.json(GetFraudReportsResponse.parse({
    reports,
    total: snap.size,
    page: params.data.page ?? 1,
  }));
});

export default router;

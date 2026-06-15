import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import { GetSettingsResponse, VerifyForceJoinBody, VerifyForceJoinResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const db = getFirestore();
  const doc = await db.collection("settings").doc("global").get();
  const data = doc.exists ? (doc.data() as Record<string, unknown>) : {};

  res.json(GetSettingsResponse.parse({
    dailyBonusAmount: (data.dailyBonusAmount as number | undefined) ?? 10,
    referralBonusAmount: (data.referralBonusAmount as number | undefined) ?? 50,
    minWithdrawalAmount: (data.minWithdrawalAmount as number | undefined) ?? 100,
    maxWithdrawalAmount: (data.maxWithdrawalAmount as number | undefined) ?? 10000,
    maintenanceMode: (data.maintenanceMode as boolean | undefined) ?? false,
    appName: (data.appName as string | undefined) ?? "EarnBot",
    welcomeMessage: (data.welcomeMessage as string | undefined) ?? "Welcome! Complete tasks to earn coins.",
  }));
});

router.post("/settings/verify-force-join", async (req, res): Promise<void> => {
  const parsed = VerifyForceJoinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const db = getFirestore();
  const channelsSnap = await db.collection("forceJoinChannels").get();
  const channels = channelsSnap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));

  if (channels.length === 0) {
    res.json(VerifyForceJoinResponse.parse({ verified: true, pendingChannels: [] }));
    return;
  }

  res.json(VerifyForceJoinResponse.parse({
    verified: false,
    pendingChannels: channels.map((c) => ({
      channelId: (c as Record<string, unknown>).channelId as string,
      channelName: (c as Record<string, unknown>).channelName as string,
      channelUrl: (c as Record<string, unknown>).channelUrl as string,
    })),
  }));
});

export default router;

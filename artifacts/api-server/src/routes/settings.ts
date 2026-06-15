import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import { GetSettingsResponse, VerifyForceJoinBody, VerifyForceJoinResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const db = getFirestore();
  const [settingsDoc, channelsSnap] = await Promise.all([
    db.collection("settings").doc("global").get(),
    db.collection("forceJoinChannels").where("isActive", "==", true).get(),
  ]);

  const data = settingsDoc.exists ? (settingsDoc.data() as Record<string, unknown>) : {};
  const forceJoinChannels = channelsSnap.docs.map((d) => {
    const c = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: (c.name as string | undefined) ?? "",
      username: (c.username as string | undefined) ?? "",
      url: (c.url as string | undefined) ?? "",
      type: (c.type as string | undefined) ?? "channel",
      isActive: (c.isActive as boolean | undefined) ?? true,
    };
  });

  res.json(GetSettingsResponse.parse({
    botUsername: (data.botUsername as string | undefined) ?? process.env.BOT_USERNAME ?? "earnbot",
    dailyBonusAmount: (data.dailyBonusAmount as number | undefined) ?? 10,
    referralBonusAmount: (data.referralBonusAmount as number | undefined) ?? 50,
    minWithdrawalAmount: (data.minWithdrawalAmount as number | undefined) ?? 100,
    maintenanceMode: (data.maintenanceMode as boolean | undefined) ?? false,
    forceJoinChannels,
  }));
});

router.post("/settings/verify-force-join", async (req, res): Promise<void> => {
  const parsed = VerifyForceJoinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const db = getFirestore();
  const channelsSnap = await db.collection("forceJoinChannels").where("isActive", "==", true).get();

  if (channelsSnap.empty) {
    res.json(VerifyForceJoinResponse.parse({ verified: true, pendingChannels: [] }));
    return;
  }

  const channels = channelsSnap.docs.map((d) => {
    const c = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: (c.name as string | undefined) ?? "",
      username: (c.username as string | undefined) ?? "",
      url: (c.url as string | undefined) ?? "",
      type: (c.type as string | undefined) ?? "channel",
      isActive: true,
    };
  });

  const telegramId = parsed.data.telegramId;
  const pendingChannels: typeof channels = [];

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.json(VerifyForceJoinResponse.parse({ verified: true, pendingChannels: [] }));
    return;
  }

  for (const channel of channels) {
    try {
      const chatId = channel.username.startsWith("@")
        ? channel.username
        : `@${channel.username}`;

      const apiUrl = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${telegramId}`;
      const response = await fetch(apiUrl);
      const json = await response.json() as { ok: boolean; result?: { status: string } };

      if (!json.ok || !json.result) {
        pendingChannels.push(channel);
        continue;
      }

      const status = json.result.status;
      if (!["member", "administrator", "creator"].includes(status)) {
        pendingChannels.push(channel);
      }
    } catch (err) {
      logger.warn({ err, channelId: channel.id }, "Force join check failed for channel, assuming joined");
    }
  }

  res.json(VerifyForceJoinResponse.parse({
    verified: pendingChannels.length === 0,
    pendingChannels,
  }));
});

export default router;

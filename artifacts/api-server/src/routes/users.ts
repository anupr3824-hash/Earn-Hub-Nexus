import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import { analyzeUserFraud } from "../lib/gemini";
import {
  RegisterUserBody,
  RegisterUserResponse,
  GetUserProfileQueryParams,
  GetUserProfileResponse,
  ClaimDailyBonusParams,
  ClaimDailyBonusResponse,
  GetUserStatsQueryParams,
  GetUserStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toUserResponse(data: Record<string, unknown>) {
  return {
    id: (data.id as number | undefined) ?? 0,
    telegramId: data.telegramId as string,
    username: (data.username as string | undefined) ?? null,
    firstName: (data.firstName as string | undefined) ?? "",
    lastName: (data.lastName as string | undefined) ?? null,
    coins: (data.balance as number | undefined) ?? 0,
    totalEarnings: (data.totalEarned as number | undefined) ?? 0,
    referralCode: (data.referralCode as string | undefined) ?? `REF${data.telegramId as string}`,
    referredBy: (data.referredBy as string | undefined) ?? null,
    rank: "0",
    isBanned: (data.isBanned as boolean | undefined) ?? false,
    dailyBonusLastClaimed: (data.dailyBonusLastClaimed as string | undefined) ?? null,
    streakDays: (data.streakDays as number | undefined) ?? 0,
    tasksCompleted: (data.taskCompletionCount as number | undefined) ?? 0,
    createdAt: (data.createdAt as string | undefined) ?? new Date().toISOString(),
    lastActive: (data.lastActiveAt as string | undefined) ?? new Date().toISOString(),
  };
}

function getStreakBonus(streakDays: number, baseBonus: number): number {
  if (streakDays >= 30) return baseBonus + 20;
  if (streakDays >= 14) return baseBonus + 10;
  if (streakDays >= 7) return baseBonus + 5;
  return baseBonus;
}

router.post("/users/register", async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { telegramId, username, firstName, lastName, referralCode } = parsed.data;
  const db = getFirestore();
  const userRef = db.collection("users").doc(telegramId);
  const existing = await userRef.get();

  if (existing.exists) {
    res.json(RegisterUserResponse.parse(toUserResponse(existing.data()!)));
    return;
  }

  const settingsDoc = await db.collection("settings").doc("global").get();
  const referralBonus = settingsDoc.exists
    ? ((settingsDoc.data()!.referralBonusAmount as number | undefined) ?? 50)
    : 50;

  const newReferralCode = `REF${telegramId}`;
  const now = new Date().toISOString();
  const userData: Record<string, unknown> = {
    telegramId,
    username: username ?? null,
    firstName: firstName ?? "",
    lastName: lastName ?? null,
    balance: 0,
    totalEarned: 0,
    referralCode: newReferralCode,
    referredBy: null,
    isBanned: false,
    banReason: null,
    riskScore: 0,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    dailyBonusLastClaimed: null,
    streakDays: 0,
    taskCompletionCount: 0,
    referralCount: 0,
  };

  if (referralCode && referralCode !== newReferralCode) {
    const referrerSnap = await db.collection("users")
      .where("referralCode", "==", referralCode)
      .limit(1)
      .get();
    if (!referrerSnap.empty) {
      const referrerDoc = referrerSnap.docs[0];
      userData.referredBy = referrerDoc.id;
      await referrerDoc.ref.update({
        balance: ((referrerDoc.data().balance as number | undefined) ?? 0) + referralBonus,
        totalEarned: ((referrerDoc.data().totalEarned as number | undefined) ?? 0) + referralBonus,
        referralCount: ((referrerDoc.data().referralCount as number | undefined) ?? 0) + 1,
        updatedAt: now,
      });
      await db.collection("transactions").doc().set({
        telegramId: referrerDoc.id,
        type: "referral",
        amount: referralBonus,
        description: `Referral bonus from ${username ?? telegramId}`,
        status: "completed",
        createdAt: now,
      });

      try {
        const { getTelegramBot } = await import("../lib/bot.js");
        const bot = getTelegramBot();
        await bot.telegram.sendMessage(
          referrerDoc.id,
          `🎉 You earned <b>${referralBonus} coins</b> from a referral!\n👤 <b>${firstName ?? telegramId}</b> just joined using your link.`,
          { parse_mode: "HTML" }
        );
      } catch { }
    }
  }

  await userRef.set(userData);

  const fraud = await analyzeUserFraud({
    telegramId,
    username: username ?? undefined,
    completedTasksCount: 0,
    referralCount: 0,
    accountAgeDays: 0,
  });
  if (fraud.riskScore > 0) {
    await userRef.update({ riskScore: fraud.riskScore });
  }

  req.log.info({ telegramId }, "New user registered");
  res.status(201).json(RegisterUserResponse.parse(toUserResponse(userData)));
});

router.get("/users/profile", async (req, res): Promise<void> => {
  const params = GetUserProfileQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const doc = await db.collection("users").doc(params.data.telegramId).get();
  if (!doc.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const data = doc.data()!;
  if (data.isBanned) {
    res.status(403).json({ error: "User is banned", reason: data.banReason });
    return;
  }

  await doc.ref.update({ lastActiveAt: new Date().toISOString() });
  res.json(GetUserProfileResponse.parse(toUserResponse(data)));
});

router.post("/users/:telegramId/daily-bonus", async (req, res): Promise<void> => {
  const params = ClaimDailyBonusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(params.data.telegramId);
  const doc = await userRef.get();
  if (!doc.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const data = doc.data()!;
  const now = new Date();
  const lastClaimed = data.dailyBonusLastClaimed ? new Date(data.dailyBonusLastClaimed as string) : null;

  if (lastClaimed) {
    const diffHours = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) {
      const nextClaim = new Date(lastClaimed.getTime() + 24 * 60 * 60 * 1000);
      res.status(400).json({ error: "Already claimed today", nextClaimAt: nextClaim.toISOString() });
      return;
    }
  }

  const settingsDoc = await db.collection("settings").doc("global").get();
  const baseBonus = settingsDoc.exists
    ? ((settingsDoc.data()!.dailyBonusAmount as number | undefined) ?? 10)
    : 10;

  let currentStreak = (data.streakDays as number | undefined) ?? 0;

  if (lastClaimed) {
    const diffHours = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);
    if (diffHours > 48) {
      currentStreak = 0;
    }
  }

  const newStreak = currentStreak + 1;
  const bonus = getStreakBonus(newStreak, baseBonus);

  const nowIso = now.toISOString();
  const newBalance = ((data.balance as number | undefined) ?? 0) + bonus;

  await userRef.update({
    balance: newBalance,
    totalEarned: ((data.totalEarned as number | undefined) ?? 0) + bonus,
    dailyBonusLastClaimed: nowIso,
    streakDays: newStreak,
    updatedAt: nowIso,
  });

  await db.collection("transactions").doc().set({
    telegramId: params.data.telegramId,
    type: "bonus",
    amount: bonus,
    description: `Daily bonus (day ${newStreak} streak)`,
    status: "completed",
    createdAt: nowIso,
  });

  const streakMsg = newStreak >= 7
    ? ` 🔥 ${newStreak}-day streak bonus!`
    : "";

  res.json(ClaimDailyBonusResponse.parse({
    success: true,
    coinsEarned: bonus,
    streakDays: newStreak,
    totalCoins: newBalance,
    message: `Daily bonus claimed!${streakMsg} +${bonus} coins`,
  }));
});

router.get("/users/stats", async (req, res): Promise<void> => {
  const params = GetUserStatsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const doc = await db.collection("users").doc(params.data.telegramId).get();
  if (!doc.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const data = doc.data()!;
  const tasksSnap = await db.collection("taskCompletions")
    .where("telegramId", "==", params.data.telegramId)
    .get();
  const withdrawalsSnap = await db.collection("withdrawals")
    .where("telegramId", "==", params.data.telegramId)
    .where("status", "==", "pending")
    .get();

  const now = new Date();
  const lastClaimed = data.dailyBonusLastClaimed ? new Date(data.dailyBonusLastClaimed as string) : null;
  const dailyBonusAvailable = !lastClaimed || (now.getTime() - lastClaimed.getTime()) >= 24 * 60 * 60 * 1000;
  const nextDailyBonusIn = dailyBonusAvailable ? 0 : lastClaimed
    ? Math.ceil((lastClaimed.getTime() + 24 * 60 * 60 * 1000 - now.getTime()) / 1000)
    : 0;

  res.json(GetUserStatsResponse.parse({
    coins: (data.balance as number | undefined) ?? 0,
    totalEarnings: (data.totalEarned as number | undefined) ?? 0,
    tasksCompleted: tasksSnap.size,
    referralCount: (data.referralCount as number | undefined) ?? 0,
    rank: "0",
    streakDays: (data.streakDays as number | undefined) ?? 0,
    pendingWithdrawals: withdrawalsSnap.size,
    dailyBonusAvailable,
    nextDailyBonusIn: dailyBonusAvailable ? null : nextDailyBonusIn,
  }));
});

export default router;

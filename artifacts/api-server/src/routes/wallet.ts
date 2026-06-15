import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import { analyzeUserFraud } from "../lib/gemini";
import {
  GetWalletParams,
  GetWalletResponse,
  GetTransactionHistoryQueryParams,
  GetTransactionHistoryResponse,
  RequestWithdrawalBody,
  GetUserWithdrawalsParams,
  GetUserWithdrawalsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/wallet/:telegramId", async (req, res): Promise<void> => {
  const params = GetWalletParams.safeParse(req.params);
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
  const withdrawSnap = await db.collection("withdrawals")
    .where("telegramId", "==", params.data.telegramId)
    .get();
  const withdrawals = withdrawSnap.docs.map((d) => d.data());
  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;
  const approvedCount = withdrawals.filter((w) => w.status === "approved").length;
  const rejectedCount = withdrawals.filter((w) => w.status === "rejected").length;

  const pendingAmount = withdrawSnap.docs
    .filter((d) => d.data().status === "pending")
    .reduce((acc, d) => acc + ((d.data().amount as number | undefined) ?? 0), 0);

  const balance = (data.balance as number | undefined) ?? 0;

  res.json(GetWalletResponse.parse({
    telegramId: params.data.telegramId,
    coins: balance,
    totalEarnings: (data.totalEarned as number | undefined) ?? 0,
    pendingWithdrawals: pendingCount,
    approvedWithdrawals: approvedCount,
    rejectedWithdrawals: rejectedCount,
    withdrawableBalance: Math.max(0, balance - pendingAmount),
  }));
});

router.get("/wallet/transactions", async (req, res): Promise<void> => {
  const params = GetTransactionHistoryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const page = params.data.page ?? 1;
  const limit = params.data.limit ?? 20;
  const offset = (page - 1) * limit;

  const snap = await db.collection("transactions")
    .where("telegramId", "==", params.data.telegramId)
    .orderBy("createdAt", "desc")
    .limit(limit + offset)
    .get();

  const all = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      telegramId: (data.telegramId as string | undefined) ?? params.data.telegramId,
      type: (data.type as string | undefined) ?? "unknown",
      amount: (data.amount as number | undefined) ?? 0,
      description: (data.description as string | undefined) ?? "",
      createdAt: (data.createdAt as string | undefined) ?? new Date().toISOString(),
    };
  });
  const paginated = all.slice(offset, offset + limit);

  res.json(GetTransactionHistoryResponse.parse({
    transactions: paginated,
    total: snap.size,
    page,
    limit,
  }));
});

router.post("/wallet/withdraw", async (req, res): Promise<void> => {
  const parsed = RequestWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { telegramId, amount, method, accountDetails } = parsed.data;
  const db = getFirestore();

  const settingsDoc = await db.collection("settings").doc("global").get();
  const minWithdrawal = settingsDoc.exists ? ((settingsDoc.data()!.minWithdrawalAmount as number | undefined) ?? 100) : 100;
  const maxWithdrawal = settingsDoc.exists ? ((settingsDoc.data()!.maxWithdrawalAmount as number | undefined) ?? 10000) : 10000;

  if (amount < minWithdrawal) {
    res.status(400).json({ error: `Minimum withdrawal is ${minWithdrawal} coins` });
    return;
  }

  if (amount > maxWithdrawal) {
    res.status(400).json({ error: `Maximum withdrawal is ${maxWithdrawal} coins` });
    return;
  }

  const userRef = db.collection("users").doc(telegramId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userData = userDoc.data()!;
  if (userData.isBanned) {
    res.status(403).json({ error: "User is banned" });
    return;
  }

  const balance = (userData.balance as number | undefined) ?? 0;
  if (balance < amount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const existingPending = await db.collection("withdrawals")
    .where("telegramId", "==", telegramId)
    .where("status", "==", "pending")
    .get();
  if (!existingPending.empty) {
    res.status(400).json({ error: "You already have a pending withdrawal. Wait for it to be processed." });
    return;
  }

  const accountCreated = new Date((userData.createdAt as string | undefined) ?? Date.now());
  const accountAgeDays = Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));

  const fraud = await analyzeUserFraud({
    telegramId,
    username: (userData.username as string | undefined) ?? undefined,
    completedTasksCount: (userData.taskCompletionCount as number | undefined) ?? 0,
    withdrawalAmount: amount,
    referralCount: (userData.referralCount as number | undefined) ?? 0,
    accountAgeDays,
  });

  if (fraud.recommendation === "ban" && fraud.riskScore >= 90) {
    const now2 = new Date().toISOString();
    await userRef.update({
      isBanned: true,
      banReason: `Auto-banned: fraud detected during withdrawal (risk ${fraud.riskScore})`,
      updatedAt: now2,
    });
    res.status(403).json({ error: "Your account has been flagged for suspicious activity." });
    return;
  }

  if (fraud.riskScore > 70) {
    const now2 = new Date().toISOString();
    await db.collection("fraudReports").add({
      telegramId,
      type: "withdrawal_fraud",
      description: fraud.reasons.join(", "),
      riskScore: fraud.riskScore,
      status: "pending",
      createdAt: now2,
    });
    await userRef.update({ riskScore: fraud.riskScore });
  }

  const now = new Date().toISOString();
  const withdrawalRef = db.collection("withdrawals").doc();
  await withdrawalRef.set({
    telegramId,
    amount,
    method,
    accountDetails,
    status: "pending",
    riskScore: fraud.riskScore,
    createdAt: now,
    updatedAt: now,
  });

  await userRef.update({
    balance: balance - amount,
    updatedAt: now,
  });

  await db.collection("activityLogs").add({
    type: "withdrawal_requested",
    description: `Withdrawal requested: ${amount} coins via ${method}`,
    telegramId,
    createdAt: now,
  });

  try {
    const { getTelegramBot } = await import("../lib/bot.js");
    const bot = getTelegramBot();
    await bot.telegram.sendMessage(
      telegramId,
      `⏳ <b>Withdrawal Submitted!</b>\n\n💰 Amount: <b>${amount} coins</b>\n💳 Method: ${method}\n📋 Account: <code>${accountDetails}</code>\n\nYour request is under review. You'll be notified once processed.`,
      { parse_mode: "HTML" }
    );
  } catch { }

  req.log.info({ telegramId, amount, method }, "Withdrawal requested");
  res.status(201).json({ id: withdrawalRef.id, status: "pending", amount, message: "Withdrawal request submitted" });
});

router.get("/wallet/:telegramId/withdrawals", async (req, res): Promise<void> => {
  const params = GetUserWithdrawalsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const snap = await db.collection("withdrawals")
    .where("telegramId", "==", params.data.telegramId)
    .orderBy("createdAt", "desc")
    .get();

  const withdrawals = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      telegramId: (data.telegramId as string | undefined) ?? params.data.telegramId,
      amount: (data.amount as number | undefined) ?? 0,
      method: (data.method as string | undefined) ?? "",
      accountDetails: (data.accountDetails as string | undefined) ?? "",
      status: (data.status as string | undefined) ?? "pending",
      rejectionReason: (data.rejectionReason as string | undefined) ?? null,
      createdAt: (data.createdAt as string | undefined) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string | undefined) ?? new Date().toISOString(),
    };
  });

  res.json(GetUserWithdrawalsResponse.parse(withdrawals));
});

export default router;

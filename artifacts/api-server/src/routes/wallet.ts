import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
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
  res.json(GetWalletResponse.parse({
    telegramId: data.telegramId,
    balance: (data.balance as number | undefined) ?? 0,
    totalEarned: (data.totalEarned as number | undefined) ?? 0,
    pendingWithdrawals: 0,
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

  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));
  const paginated = all.slice(offset, offset + limit);

  res.json(GetTransactionHistoryResponse.parse({
    transactions: paginated,
    total: snap.size,
    page,
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

  if (amount < minWithdrawal) {
    res.status(400).json({ error: `Minimum withdrawal is ${minWithdrawal} coins` });
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

  const now = new Date().toISOString();
  const withdrawalRef = db.collection("withdrawals").doc();
  await withdrawalRef.set({
    telegramId,
    amount,
    method,
    accountDetails,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  await userRef.update({
    balance: balance - amount,
    updatedAt: now,
  });

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

  const withdrawals = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));
  res.json(GetUserWithdrawalsResponse.parse(withdrawals));
});

export default router;

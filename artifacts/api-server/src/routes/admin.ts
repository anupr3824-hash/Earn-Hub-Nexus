import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import { requireAdmin } from "../middlewares/adminAuth";
import { signAdminToken } from "../lib/jwt";
import { getTelegramBot } from "../lib/bot";
import {
  AdminLoginBody,
  AdminLoginResponse,
  GetAdminDashboardResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  BanUserParams,
  BanUserBody,
  BanUserResponse,
  UnbanUserParams,
  UnbanUserResponse,
  EditUserBalanceParams,
  EditUserBalanceBody,
  EditUserBalanceResponse,
  ListAdminWithdrawalsQueryParams,
  ListAdminWithdrawalsResponse,
  ApproveWithdrawalParams,
  ApproveWithdrawalResponse,
  RejectWithdrawalParams,
  RejectWithdrawalBody,
  RejectWithdrawalResponse,
  AdminBroadcastBody,
  AdminBroadcastResponse,
  GetAdminSettingsResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  ListForceJoinChannelsResponse,
  AddForceJoinChannelBody,
  DeleteForceJoinChannelParams,
  GetActivityLogsQueryParams,
  GetActivityLogsResponse,
  GetRevenueAnalyticsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin";

  if (username !== adminUsername || password !== adminPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signAdminToken({ username });
  res.json(AdminLoginResponse.parse({ token, expiresIn: 28800 }));
});

router.get("/admin/dashboard", requireAdmin, async (_req, res): Promise<void> => {
  const db = getFirestore();
  const [usersSnap, tasksSnap, withdrawalsSnap, txSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("tasks").where("isActive", "==", true).get(),
    db.collection("withdrawals").where("status", "==", "pending").get(),
    db.collection("transactions").get(),
  ]);

  const totalRevenue = txSnap.docs
    .filter((d) => d.data().type === "task")
    .reduce((acc, d) => acc + ((d.data().amount as number | undefined) ?? 0), 0);

  res.json(GetAdminDashboardResponse.parse({
    totalUsers: usersSnap.size,
    activeUsers: usersSnap.docs.filter((d) => !d.data().isBanned).length,
    bannedUsers: usersSnap.docs.filter((d) => d.data().isBanned).length,
    totalTasks: tasksSnap.size,
    pendingWithdrawals: withdrawalsSnap.size,
    totalRevenue,
    todayRevenue: 0,
    totalTransactions: txSnap.size,
  }));
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListAdminUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  let query = db.collection("users") as FirebaseFirestore.Query;

  const snap = await query.limit(50).get();
  const users = snap.docs.map((d) => ({ ...d.data() as Record<string, unknown> }));

  res.json(ListAdminUsersResponse.parse({ users, total: snap.size, page: params.data.page ?? 1 }));
});

router.post("/admin/users/:telegramId/ban", requireAdmin, async (req, res): Promise<void> => {
  const params = BanUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = BanUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const db = getFirestore();
  const ref = db.collection("users").doc(params.data.telegramId);
  const doc = await ref.get();
  if (!doc.exists) { res.status(404).json({ error: "User not found" }); return; }

  await ref.update({ isBanned: true, banReason: parsed.data.reason, updatedAt: new Date().toISOString() });
  req.log.info({ telegramId: params.data.telegramId }, "User banned");
  res.json(BanUserResponse.parse({ success: true, message: "User banned" }));
});

router.post("/admin/users/:telegramId/unban", requireAdmin, async (req, res): Promise<void> => {
  const params = UnbanUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const db = getFirestore();
  const ref = db.collection("users").doc(params.data.telegramId);
  const doc = await ref.get();
  if (!doc.exists) { res.status(404).json({ error: "User not found" }); return; }

  await ref.update({ isBanned: false, banReason: null, updatedAt: new Date().toISOString() });
  res.json(UnbanUserResponse.parse({ success: true, message: "User unbanned" }));
});

router.patch("/admin/users/:telegramId/balance", requireAdmin, async (req, res): Promise<void> => {
  const params = EditUserBalanceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = EditUserBalanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const db = getFirestore();
  const ref = db.collection("users").doc(params.data.telegramId);
  const doc = await ref.get();
  if (!doc.exists) { res.status(404).json({ error: "User not found" }); return; }

  const now = new Date().toISOString();
  const oldBalance = (doc.data()!.balance as number | undefined) ?? 0;
  const newCoins = parsed.data.coins;
  await ref.update({ balance: newCoins, updatedAt: now });

  const txRef = db.collection("transactions").doc();
  await txRef.set({
    telegramId: params.data.telegramId,
    type: "admin_adjustment",
    amount: newCoins - oldBalance,
    description: parsed.data.reason,
    status: "completed",
    createdAt: now,
  });

  res.json(EditUserBalanceResponse.parse({ success: true, message: "Balance updated" }));
});

router.get("/admin/withdrawals", requireAdmin, async (req, res): Promise<void> => {
  const params = ListAdminWithdrawalsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const db = getFirestore();
  let query = db.collection("withdrawals").orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (params.data.status) query = query.where("status", "==", params.data.status);

  const snap = await query.limit(50).get();
  const withdrawals = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));
  res.json(ListAdminWithdrawalsResponse.parse({ withdrawals, total: snap.size, page: params.data.page ?? 1 }));
});

router.post("/admin/withdrawals/:withdrawalId/approve", requireAdmin, async (req, res): Promise<void> => {
  const params = ApproveWithdrawalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const db = getFirestore();
  const ref = db.collection("withdrawals").doc(params.data.withdrawalId);
  const doc = await ref.get();
  if (!doc.exists) { res.status(404).json({ error: "Withdrawal not found" }); return; }
  if (doc.data()!.status !== "pending") { res.status(400).json({ error: "Withdrawal not pending" }); return; }

  await ref.update({ status: "approved", updatedAt: new Date().toISOString() });
  req.log.info({ withdrawalId: params.data.withdrawalId }, "Withdrawal approved");
  res.json(ApproveWithdrawalResponse.parse({ success: true, message: "Withdrawal approved" }));
});

router.post("/admin/withdrawals/:withdrawalId/reject", requireAdmin, async (req, res): Promise<void> => {
  const params = RejectWithdrawalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = RejectWithdrawalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const db = getFirestore();
  const ref = db.collection("withdrawals").doc(params.data.withdrawalId);
  const doc = await ref.get();
  if (!doc.exists) { res.status(404).json({ error: "Withdrawal not found" }); return; }

  const wData = doc.data()!;
  if (wData.status !== "pending") { res.status(400).json({ error: "Withdrawal not pending" }); return; }

  const now = new Date().toISOString();
  await ref.update({ status: "rejected", rejectionReason: parsed.data.reason, updatedAt: now });

  const userRef = db.collection("users").doc(wData.telegramId as string);
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    await userRef.update({
      balance: ((userDoc.data()!.balance as number | undefined) ?? 0) + (wData.amount as number),
      updatedAt: now,
    });
  }

  res.json(RejectWithdrawalResponse.parse({ success: true, message: "Withdrawal rejected and balance refunded" }));
});

router.post("/admin/broadcast", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AdminBroadcastBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const db = getFirestore();
  const snap = await db.collection("users").where("isBanned", "==", false).get();
  const targetUsers = snap.docs.map((d) => d.data().telegramId as string);

  const bot = getTelegramBot();
  let sent = 0;
  let failed = 0;

  for (const uid of targetUsers) {
    try {
      await bot.telegram.sendMessage(uid, parsed.data.message, { parse_mode: "HTML" });
      sent++;
    } catch {
      failed++;
    }
  }

  const now = new Date().toISOString();
  await db.collection("broadcasts").add({
    title: parsed.data.title,
    message: parsed.data.message,
    type: parsed.data.type,
    targetCount: targetUsers.length,
    sent,
    failed,
    createdAt: now,
  });

  req.log.info({ sent, failed }, "Broadcast sent");
  res.json(AdminBroadcastResponse.parse({ success: true, message: `Sent to ${sent} users` }));
});

router.get("/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  const db = getFirestore();
  const doc = await db.collection("settings").doc("global").get();
  const data = doc.exists ? (doc.data() as Record<string, unknown>) : {};

  res.json(GetAdminSettingsResponse.parse({
    dailyBonusAmount: (data.dailyBonusAmount as number | undefined) ?? 10,
    referralBonusAmount: (data.referralBonusAmount as number | undefined) ?? 50,
    minWithdrawalAmount: (data.minWithdrawalAmount as number | undefined) ?? 100,
    maxWithdrawalAmount: (data.maxWithdrawalAmount as number | undefined) ?? 10000,
    botUsername: (data.botUsername as string | undefined) ?? process.env.BOT_USERNAME ?? "earnbot",
    maintenanceMode: (data.maintenanceMode as boolean | undefined) ?? false,
    withdrawMethods: (data.withdrawMethods as string[] | undefined) ?? ["TON", "USDT", "BTC"],
  }));
});

router.patch("/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const db = getFirestore();
  await db.collection("settings").doc("global").set(parsed.data, { merge: true });

  const updated = await db.collection("settings").doc("global").get();
  const data = updated.data() as Record<string, unknown>;
  res.json(UpdateAdminSettingsResponse.parse({
    dailyBonusAmount: (data.dailyBonusAmount as number | undefined) ?? 10,
    referralBonusAmount: (data.referralBonusAmount as number | undefined) ?? 50,
    minWithdrawalAmount: (data.minWithdrawalAmount as number | undefined) ?? 100,
    maxWithdrawalAmount: (data.maxWithdrawalAmount as number | undefined) ?? 10000,
    botUsername: (data.botUsername as string | undefined) ?? "earnbot",
    maintenanceMode: (data.maintenanceMode as boolean | undefined) ?? false,
    withdrawMethods: (data.withdrawMethods as string[] | undefined) ?? ["TON", "USDT", "BTC"],
  }));
});

router.get("/admin/force-join", requireAdmin, async (_req, res): Promise<void> => {
  const db = getFirestore();
  const snap = await db.collection("forceJoinChannels").get();
  const channels = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));
  res.json(ListForceJoinChannelsResponse.parse(channels));
});

router.post("/admin/force-join", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AddForceJoinChannelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const db = getFirestore();
  const now = new Date().toISOString();
  const ref = await db.collection("forceJoinChannels").add({ ...parsed.data, createdAt: now });
  res.status(201).json({ id: ref.id, ...parsed.data });
});

router.delete("/admin/force-join/:channelId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteForceJoinChannelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const db = getFirestore();
  await db.collection("forceJoinChannels").doc(params.data.channelId).delete();
  res.sendStatus(204);
});

router.get("/admin/activity-logs", requireAdmin, async (req, res): Promise<void> => {
  const params = GetActivityLogsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const db = getFirestore();
  const snap = await db.collection("activityLogs")
    .orderBy("createdAt", "desc")
    .limit(params.data.limit ?? 50)
    .get();

  const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));
  res.json(GetActivityLogsResponse.parse({ logs, total: snap.size, page: params.data.page ?? 1 }));
});

router.get("/admin/analytics/revenue", requireAdmin, async (_req, res): Promise<void> => {
  const db = getFirestore();
  const txSnap = await db.collection("transactions").get();
  const total = txSnap.docs.reduce((acc, d) => acc + ((d.data().amount as number | undefined) ?? 0), 0);

  const byType: Record<string, number> = {};
  txSnap.docs.forEach((d) => {
    const t = (d.data().type as string | undefined) ?? "unknown";
    byType[t] = (byType[t] ?? 0) + ((d.data().amount as number | undefined) ?? 0);
  });

  res.json(GetRevenueAnalyticsResponse.parse({
    totalRevenue: total,
    taskRevenue: byType.task ?? 0,
    referralRevenue: byType.referral ?? 0,
    bonusRevenue: byType.bonus ?? 0,
    withdrawalTotal: 0,
    netRevenue: total,
  }));
});

export default router;

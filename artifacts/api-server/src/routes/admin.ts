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

function toAdminUserRecord(d: Record<string, unknown>) {
  return {
    id: 0,
    telegramId: (d.telegramId as string | undefined) ?? "",
    username: (d.username as string | undefined) ?? null,
    firstName: (d.firstName as string | undefined) ?? "",
    lastName: (d.lastName as string | undefined) ?? null,
    coins: (d.balance as number | undefined) ?? 0,
    totalEarnings: (d.totalEarned as number | undefined) ?? 0,
    referralCode: (d.referralCode as string | undefined) ?? `REF${d.telegramId as string}`,
    referredBy: (d.referredBy as string | undefined) ?? null,
    rank: "0",
    isBanned: (d.isBanned as boolean | undefined) ?? false,
    dailyBonusLastClaimed: (d.dailyBonusLastClaimed as string | undefined) ?? null,
    streakDays: (d.streakDays as number | undefined) ?? 0,
    tasksCompleted: (d.taskCompletionCount as number | undefined) ?? 0,
    createdAt: (d.createdAt as string | undefined) ?? new Date().toISOString(),
    lastActive: (d.lastActiveAt as string | undefined) ?? new Date().toISOString(),
  };
}

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
  res.json(AdminLoginResponse.parse({
    success: true,
    token,
    admin: {
      id: 1,
      username,
      role: "admin",
      lastLogin: new Date().toISOString(),
    },
  }));
});

router.get("/admin/dashboard", requireAdmin, async (_req, res): Promise<void> => {
  const db = getFirestore();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [usersSnap, tasksSnap, withdrawalsSnap, txSnap, allWithdrawalsSnap, highRiskSnap, recentTxSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("tasks").where("isActive", "==", true).get(),
    db.collection("withdrawals").where("status", "==", "pending").get(),
    db.collection("transactions").get(),
    db.collection("withdrawals").where("status", "==", "pending").get(),
    db.collection("users").where("riskScore", ">=", 70).get(),
    db.collection("transactions").orderBy("createdAt", "desc").limit(5).get(),
  ]);

  const totalCoins = txSnap.docs
    .filter((d) => d.data().type !== "withdrawal")
    .reduce((acc, d) => acc + ((d.data().amount as number | undefined) ?? 0), 0);

  const totalTasksCompleted = txSnap.docs.filter((d) => d.data().type === "task").length;
  const totalReferrals = txSnap.docs.filter((d) => d.data().type === "referral").length;

  const todayUsers = usersSnap.docs.filter((d) => {
    const created = (d.data().createdAt as string | undefined) ?? "";
    return created >= todayStart;
  }).length;

  const pendingWithdrawalAmount = allWithdrawalsSnap.docs.reduce(
    (acc, d) => acc + ((d.data().amount as number | undefined) ?? 0),
    0
  );

  const recentActivity = recentTxSnap.docs.map((d) => ({
    id: d.id,
    type: (d.data().type as string | undefined) ?? "unknown",
    description: (d.data().description as string | undefined) ?? "",
    telegramId: (d.data().telegramId as string | undefined) ?? null,
    createdAt: (d.data().createdAt as string | undefined) ?? now.toISOString(),
  }));

  res.json(GetAdminDashboardResponse.parse({
    totalUsers: usersSnap.size,
    activeUsers: usersSnap.docs.filter((d) => !d.data().isBanned).length,
    todayUsers,
    totalCoinsDistributed: totalCoins,
    totalTasksCompleted,
    pendingWithdrawals: withdrawalsSnap.size,
    pendingWithdrawalAmount,
    totalReferrals,
    bannedUsers: usersSnap.docs.filter((d) => d.data().isBanned).length,
    highRiskUsers: highRiskSnap.size,
    recentActivity,
  }));
});

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListAdminUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const limit = params.data.limit ?? 50;
  const page = params.data.page ?? 1;

  let query = db.collection("users").limit(limit) as FirebaseFirestore.Query;

  if (params.data.status === "banned") {
    query = db.collection("users").where("isBanned", "==", true).limit(limit);
  } else if (params.data.status === "active") {
    query = db.collection("users").where("isBanned", "==", false).limit(limit);
  }

  const snap = await query.get();
  let users = snap.docs.map((d) => toAdminUserRecord(d.data() as Record<string, unknown>));

  if (params.data.search) {
    const s = params.data.search.toLowerCase();
    users = users.filter(
      (u) =>
        u.telegramId.includes(s) ||
        (u.username ?? "").toLowerCase().includes(s) ||
        u.firstName.toLowerCase().includes(s)
    );
  }

  res.json(ListAdminUsersResponse.parse({ users, total: snap.size, page, limit }));
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

  const now = new Date().toISOString();
  await ref.update({ isBanned: true, banReason: parsed.data.reason, updatedAt: now });

  await db.collection("activityLogs").add({
    type: "user_banned",
    description: `User ${params.data.telegramId} banned: ${parsed.data.reason}`,
    telegramId: params.data.telegramId,
    createdAt: now,
  });

  try {
    const bot = getTelegramBot();
    await bot.telegram.sendMessage(
      params.data.telegramId,
      `⛔ Your account has been banned.\nReason: ${parsed.data.reason}\n\nContact support if you believe this is a mistake.`
    );
  } catch { }

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

  const now = new Date().toISOString();
  await ref.update({ isBanned: false, banReason: null, updatedAt: now });

  await db.collection("activityLogs").add({
    type: "user_unbanned",
    description: `User ${params.data.telegramId} unbanned`,
    telegramId: params.data.telegramId,
    createdAt: now,
  });

  try {
    const bot = getTelegramBot();
    await bot.telegram.sendMessage(
      params.data.telegramId,
      "✅ Your account has been unbanned! You can now use the app again."
    );
  } catch { }

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

  await db.collection("transactions").doc().set({
    telegramId: params.data.telegramId,
    type: "admin_adjustment",
    amount: newCoins - oldBalance,
    description: parsed.data.reason,
    status: "completed",
    createdAt: now,
  });

  await db.collection("activityLogs").add({
    type: "balance_edit",
    description: `Balance adjusted for ${params.data.telegramId}: ${oldBalance} → ${newCoins} (${parsed.data.reason})`,
    telegramId: params.data.telegramId,
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
  const withdrawals = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      telegramId: (data.telegramId as string | undefined) ?? "",
      amount: (data.amount as number | undefined) ?? 0,
      method: (data.method as string | undefined) ?? "",
      accountDetails: (data.accountDetails as string | undefined) ?? "",
      status: (data.status as string | undefined) ?? "pending",
      rejectionReason: (data.rejectionReason as string | undefined) ?? null,
      createdAt: (data.createdAt as string | undefined) ?? new Date().toISOString(),
      updatedAt: (data.updatedAt as string | undefined) ?? new Date().toISOString(),
    };
  });

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

  const now = new Date().toISOString();
  const wData = doc.data()!;
  await ref.update({ status: "approved", updatedAt: now });

  await db.collection("activityLogs").add({
    type: "withdrawal_approved",
    description: `Withdrawal ${params.data.withdrawalId} approved (${wData.amount} coins)`,
    telegramId: wData.telegramId as string,
    createdAt: now,
  });

  try {
    const bot = getTelegramBot();
    await bot.telegram.sendMessage(
      wData.telegramId as string,
      `✅ <b>Withdrawal Approved!</b>\n\n💰 Amount: <b>${wData.amount as number} coins</b>\n💳 Method: ${wData.method as string}\n\nYour payment will be processed shortly.`,
      { parse_mode: "HTML" }
    );
  } catch { }

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
    await db.collection("transactions").doc().set({
      telegramId: wData.telegramId as string,
      type: "refund",
      amount: wData.amount as number,
      description: `Withdrawal refund: ${parsed.data.reason}`,
      status: "completed",
      createdAt: now,
    });
  }

  await db.collection("activityLogs").add({
    type: "withdrawal_rejected",
    description: `Withdrawal ${params.data.withdrawalId} rejected: ${parsed.data.reason}`,
    telegramId: wData.telegramId as string,
    createdAt: now,
  });

  try {
    const bot = getTelegramBot();
    await bot.telegram.sendMessage(
      wData.telegramId as string,
      `❌ <b>Withdrawal Rejected</b>\n\n💰 Amount: <b>${wData.amount as number} coins</b> (refunded to your balance)\nReason: ${parsed.data.reason}\n\nYour coins have been returned.`,
      { parse_mode: "HTML" }
    );
  } catch { }

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
  const channels = snap.docs.map((d) => {
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
  res.json(ListForceJoinChannelsResponse.parse(channels));
});

router.post("/admin/force-join", requireAdmin, async (req, res): Promise<void> => {
  const parsed = AddForceJoinChannelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const db = getFirestore();
  const now = new Date().toISOString();
  const ref = await db.collection("forceJoinChannels").add({
    ...parsed.data,
    isActive: true,
    createdAt: now,
  });
  const doc = await ref.get();
  const c = doc.data() as Record<string, unknown>;
  res.status(201).json({
    id: ref.id,
    name: c.name,
    username: c.username,
    url: c.url,
    type: c.type,
    isActive: c.isActive,
  });
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

  const logs = snap.docs.map((d) => ({
    id: d.id,
    type: (d.data().type as string | undefined) ?? "unknown",
    description: (d.data().description as string | undefined) ?? "",
    telegramId: (d.data().telegramId as string | undefined) ?? null,
    createdAt: (d.data().createdAt as string | undefined) ?? new Date().toISOString(),
  }));

  res.json(GetActivityLogsResponse.parse({ logs, total: snap.size, page: params.data.page ?? 1 }));
});

router.get("/admin/analytics/revenue", requireAdmin, async (_req, res): Promise<void> => {
  const db = getFirestore();
  const now = new Date();

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  const [txSnap, usersSnap, withdrawalsSnap] = await Promise.all([
    db.collection("transactions").get(),
    db.collection("users").get(),
    db.collection("withdrawals").get(),
  ]);

  const dailyUsers: Record<string, number> = {};
  usersSnap.docs.forEach((d) => {
    const date = ((d.data().createdAt as string | undefined) ?? "").split("T")[0];
    if (date) dailyUsers[date] = (dailyUsers[date] ?? 0) + 1;
  });

  const dailyCompletions: Record<string, number> = {};
  const dailyCoins: Record<string, number> = {};
  const taskTypes: Record<string, number> = {};
  txSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const date = ((data.createdAt as string | undefined) ?? "").split("T")[0];
    const amount = (data.amount as number | undefined) ?? 0;
    if (data.type === "task") {
      if (date) dailyCompletions[date] = (dailyCompletions[date] ?? 0) + 1;
    }
    if (date) dailyCoins[date] = (dailyCoins[date] ?? 0) + amount;

    const type = (data.type as string | undefined) ?? "other";
    taskTypes[type] = (taskTypes[type] ?? 0) + 1;
  });

  const withdrawalsByStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  withdrawalsSnap.docs.forEach((d) => {
    const status = (d.data().status as string | undefined) ?? "pending";
    withdrawalsByStatus[status] = (withdrawalsByStatus[status] ?? 0) + 1;
  });

  res.json(GetRevenueAnalyticsResponse.parse({
    dailyNewUsers: last7Days.map((label) => ({ label, value: dailyUsers[label] ?? 0 })),
    dailyTaskCompletions: last7Days.map((label) => ({ label, value: dailyCompletions[label] ?? 0 })),
    withdrawalsByStatus: Object.entries(withdrawalsByStatus).map(([label, value]) => ({ label, value })),
    topTaskTypes: Object.entries(taskTypes).map(([label, value]) => ({ label, value })),
    coinsDistributedOverTime: last7Days.map((label) => ({ label, value: dailyCoins[label] ?? 0 })),
  }));
});

export default router;

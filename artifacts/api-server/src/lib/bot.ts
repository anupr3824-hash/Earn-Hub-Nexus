import { Telegraf } from "telegraf";
import { getFirestore } from "./firebase";
import { logger } from "./logger";

let bot: Telegraf | null = null;

export function getTelegramBot(): Telegraf {
  if (bot) return bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  bot = new Telegraf(token);
  return bot;
}

async function registerUser(
  telegramId: string,
  user: { username?: string; first_name?: string; last_name?: string },
  referralCode?: string
) {
  const db = getFirestore();
  const userRef = db.collection("users").doc(telegramId);
  const existing = await userRef.get();

  if (existing.exists) {
    await userRef.update({ lastActiveAt: new Date().toISOString() });
    return existing.data();
  }

  const settingsDoc = await db.collection("settings").doc("global").get();
  const referralBonus = settingsDoc.exists
    ? ((settingsDoc.data()!.referralBonusAmount as number | undefined) ?? 50)
    : 50;

  const newReferralCode = `REF${telegramId}`;
  const now = new Date().toISOString();
  const userData = {
    telegramId,
    username: user.username ?? null,
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? null,
    balance: 0,
    totalEarned: 0,
    referralCode: newReferralCode,
    referredBy: null as string | null,
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
      const referrer = referrerSnap.docs[0];
      userData.referredBy = referrer.id;
      const now2 = new Date().toISOString();
      await referrer.ref.update({
        balance: (referrer.data().balance ?? 0) + referralBonus,
        totalEarned: (referrer.data().totalEarned ?? 0) + referralBonus,
        referralCount: (referrer.data().referralCount ?? 0) + 1,
        updatedAt: now2,
      });
      await db.collection("transactions").doc().set({
        telegramId: referrer.id,
        type: "referral",
        amount: referralBonus,
        description: `Referral bonus from ${user.username ?? telegramId}`,
        status: "completed",
        createdAt: now2,
      });
      try {
        const b = getTelegramBot();
        await b.telegram.sendMessage(
          referrer.id,
          `🎉 You earned <b>${referralBonus} coins</b> from a referral!\n👤 <b>${user.first_name ?? telegramId}</b> just joined using your link.`,
          { parse_mode: "HTML" }
        );
      } catch { }
    }
  }

  await userRef.set(userData);
  return userData;
}

function getStreakBonus(streakDays: number, baseBonus: number): number {
  if (streakDays >= 30) return baseBonus + 20;
  if (streakDays >= 14) return baseBonus + 10;
  if (streakDays >= 7) return baseBonus + 5;
  return baseBonus;
}

export async function initBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  const b = getTelegramBot();

  b.start(async (ctx) => {
    const user = ctx.from;
    if (!user) return;
    const telegramId = String(user.id);
    const referralCode = ctx.startPayload ?? undefined;

    try {
      const db = getFirestore();
      await registerUser(telegramId, user, referralCode);

      const settingsDoc = await db.collection("settings").doc("global").get();
      const welcomeMsg = settingsDoc.exists
        ? (settingsDoc.data()!.welcomeMessage ?? "Welcome to EarnBot!")
        : "Welcome to EarnBot!";

      const miniAppUrl = process.env.MINI_APP_URL ?? "https://t.me/your_bot/app";

      await ctx.reply(
        `${welcomeMsg}\n\n🎯 Earn coins by:\n• ✅ Completing tasks\n• 👥 Inviting friends\n• 🔥 Daily check-in streaks\n\n💰 Open the app to get started:`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: "🚀 Open EarnBot App", web_app: { url: miniAppUrl } },
            ]],
          },
        }
      );
    } catch (err) {
      logger.error({ err }, "Bot start handler error");
      await ctx.reply("Welcome! Something went wrong, please try again.");
    }
  });

  b.command("balance", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    try {
      const db = getFirestore();
      const doc = await db.collection("users").doc(telegramId).get();
      if (!doc.exists) {
        await ctx.reply("You are not registered. Send /start to register.");
        return;
      }
      const data = doc.data()!;
      const streak = (data.streakDays as number | undefined) ?? 0;
      await ctx.reply(
        `💰 <b>Your Wallet</b>\n\n` +
        `Balance: <b>${data.balance ?? 0} coins</b>\n` +
        `Total Earned: ${data.totalEarned ?? 0} coins\n` +
        `🔥 Streak: ${streak} day${streak !== 1 ? "s" : ""}`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.error({ err }, "Balance command error");
      await ctx.reply("Error fetching balance.");
    }
  });

  b.command("checkin", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    try {
      const db = getFirestore();
      const userRef = db.collection("users").doc(telegramId);
      const doc = await userRef.get();
      if (!doc.exists) {
        await ctx.reply("Please /start first to register.");
        return;
      }

      const data = doc.data()!;
      const now = new Date();
      const lastClaimed = data.dailyBonusLastClaimed ? new Date(data.dailyBonusLastClaimed as string) : null;

      if (lastClaimed) {
        const diffHours = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);
        if (diffHours < 24) {
          const nextClaim = new Date(lastClaimed.getTime() + 24 * 60 * 60 * 1000);
          const hoursLeft = Math.ceil((nextClaim.getTime() - now.getTime()) / (1000 * 60 * 60));
          await ctx.reply(`⏰ Already claimed today!\nCome back in <b>${hoursLeft}h</b> for your next bonus.`, { parse_mode: "HTML" });
          return;
        }
      }

      const settingsDoc = await db.collection("settings").doc("global").get();
      const baseBonus = settingsDoc.exists ? ((settingsDoc.data()!.dailyBonusAmount as number | undefined) ?? 10) : 10;

      let currentStreak = (data.streakDays as number | undefined) ?? 0;
      if (lastClaimed) {
        const diffHours = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);
        if (diffHours > 48) currentStreak = 0;
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
        telegramId,
        type: "bonus",
        amount: bonus,
        description: `Daily check-in bonus (day ${newStreak} streak)`,
        status: "completed",
        createdAt: nowIso,
      });

      const streakEmoji = newStreak >= 30 ? "🏆" : newStreak >= 14 ? "💎" : newStreak >= 7 ? "🔥" : "⭐";
      const milestoneMsg = newStreak === 7 ? "\n🎉 <b>7-day streak bonus unlocked!</b>"
        : newStreak === 14 ? "\n🎉 <b>14-day streak bonus unlocked!</b>"
          : newStreak === 30 ? "\n🏆 <b>30-day streak bonus unlocked!</b>"
            : "";

      await ctx.reply(
        `${streakEmoji} <b>Daily Bonus Claimed!</b>\n\n` +
        `+<b>${bonus} coins</b> added to your balance\n` +
        `💰 New balance: ${newBalance} coins\n` +
        `🔥 Streak: ${newStreak} day${newStreak !== 1 ? "s" : ""}${milestoneMsg}`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.error({ err }, "Check-in command error");
      await ctx.reply("Error claiming daily bonus. Please try again.");
    }
  });

  b.command("referral", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    try {
      const db = getFirestore();
      const doc = await db.collection("users").doc(telegramId).get();
      if (!doc.exists) {
        await ctx.reply("You are not registered. Send /start to register.");
        return;
      }
      const data = doc.data()!;
      const code = (data.referralCode as string | undefined) ?? `REF${telegramId}`;
      const botUsername = process.env.BOT_USERNAME ?? "earnbot";
      const link = `https://t.me/${botUsername}?start=${code}`;
      const referralCount = (data.referralCount as number | undefined) ?? 0;

      await ctx.reply(
        `👥 <b>Your Referral Info</b>\n\n` +
        `Code: <code>${code}</code>\n` +
        `Link: ${link}\n\n` +
        `Friends invited: <b>${referralCount}</b>\n\n` +
        `💰 Earn bonus coins for each friend who joins!`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.error({ err }, "Referral command error");
    }
  });

  b.command("tasks", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    try {
      const db = getFirestore();
      const [tasksSnap, completionsSnap] = await Promise.all([
        db.collection("tasks").where("isActive", "==", true).get(),
        db.collection("taskCompletions").where("telegramId", "==", telegramId).get(),
      ]);

      const completedIds = new Set(completionsSnap.docs.map((d) => d.data().taskId as string));
      const available = tasksSnap.docs.filter((d) => !completedIds.has(d.id));

      if (available.length === 0) {
        await ctx.reply("✅ You've completed all available tasks! Check back later for new ones.");
        return;
      }

      const miniAppUrl = process.env.MINI_APP_URL ?? "https://t.me/your_bot/app";
      const taskList = available.slice(0, 5).map((d) => {
        const t = d.data();
        return `• ${t.title as string} — <b>+${t.reward as number} coins</b>`;
      }).join("\n");

      await ctx.reply(
        `📋 <b>Available Tasks (${available.length})</b>\n\n${taskList}\n\nOpen the app to complete them:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [[
              { text: "📱 Open App", web_app: { url: miniAppUrl } },
            ]],
          },
        }
      );
    } catch (err) {
      logger.error({ err }, "Tasks command error");
      await ctx.reply("Error fetching tasks.");
    }
  });

  b.command("withdraw", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    try {
      const db = getFirestore();
      const [userDoc, pendingSnap, settingsDoc] = await Promise.all([
        db.collection("users").doc(telegramId).get(),
        db.collection("withdrawals").where("telegramId", "==", telegramId).where("status", "==", "pending").get(),
        db.collection("settings").doc("global").get(),
      ]);

      if (!userDoc.exists) {
        await ctx.reply("Please /start first to register.");
        return;
      }

      const data = userDoc.data()!;
      const balance = (data.balance as number | undefined) ?? 0;
      const minWithdrawal = settingsDoc.exists
        ? ((settingsDoc.data()!.minWithdrawalAmount as number | undefined) ?? 100)
        : 100;

      const miniAppUrl = process.env.MINI_APP_URL ?? "https://t.me/your_bot/app";

      if (pendingSnap.size > 0) {
        const pw = pendingSnap.docs[0].data();
        await ctx.reply(
          `⏳ <b>Pending Withdrawal</b>\n\n` +
          `Amount: <b>${pw.amount as number} coins</b>\n` +
          `Method: ${pw.method as string}\n\n` +
          `Your request is being processed. You'll be notified once approved.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      await ctx.reply(
        `💸 <b>Withdrawal Info</b>\n\n` +
        `Balance: <b>${balance} coins</b>\n` +
        `Minimum: ${minWithdrawal} coins\n\n` +
        `${balance >= minWithdrawal ? "✅ You can withdraw! Open the app:" : `❌ Need ${minWithdrawal - balance} more coins to withdraw.`}`,
        {
          parse_mode: "HTML",
          reply_markup: balance >= minWithdrawal ? {
            inline_keyboard: [[
              { text: "💸 Withdraw Now", web_app: { url: miniAppUrl } },
            ]],
          } : undefined,
        }
      );
    } catch (err) {
      logger.error({ err }, "Withdraw command error");
      await ctx.reply("Error fetching withdrawal info.");
    }
  });

  b.command("stats", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    try {
      const db = getFirestore();
      const [userDoc, tasksSnap] = await Promise.all([
        db.collection("users").doc(telegramId).get(),
        db.collection("taskCompletions").where("telegramId", "==", telegramId).get(),
      ]);

      if (!userDoc.exists) {
        await ctx.reply("Please /start first to register.");
        return;
      }

      const data = userDoc.data()!;
      const streak = (data.streakDays as number | undefined) ?? 0;
      const referrals = (data.referralCount as number | undefined) ?? 0;

      const now = new Date();
      const lastClaimed = data.dailyBonusLastClaimed ? new Date(data.dailyBonusLastClaimed as string) : null;
      const dailyAvailable = !lastClaimed || (now.getTime() - lastClaimed.getTime()) >= 24 * 60 * 60 * 1000;

      await ctx.reply(
        `📊 <b>Your Stats</b>\n\n` +
        `💰 Balance: <b>${data.balance ?? 0} coins</b>\n` +
        `⭐ Total Earned: ${data.totalEarned ?? 0} coins\n` +
        `✅ Tasks Done: ${tasksSnap.size}\n` +
        `👥 Referrals: ${referrals}\n` +
        `🔥 Streak: ${streak} day${streak !== 1 ? "s" : ""}\n` +
        `🎁 Daily Bonus: ${dailyAvailable ? "✅ Available! Use /checkin" : "⏰ Claimed"}`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      logger.error({ err }, "Stats command error");
      await ctx.reply("Error fetching stats.");
    }
  });

  b.command("help", async (ctx) => {
    await ctx.reply(
      "📋 <b>Commands</b>\n\n" +
      "/start — Start the bot & register\n" +
      "/balance — Check your balance\n" +
      "/checkin — Claim daily bonus 🔥\n" +
      "/tasks — View available tasks\n" +
      "/withdraw — Withdrawal info\n" +
      "/referral — Get your referral link\n" +
      "/stats — View all your stats\n" +
      "/help — Show this help\n\n" +
      "💡 Open the mini app for full features!",
      { parse_mode: "HTML" }
    );
  });

  // Start polling for messages
  b.launch({
    dropPendingUpdates: true,
  }).catch((err) => logger.error({ err }, "Bot launch failed"));

  // Graceful shutdown
  process.once("SIGINT", () => b.stop("SIGINT"));
  process.once("SIGTERM", () => b.stop("SIGTERM"));

  logger.info("Telegram bot initialized with all commands");
}

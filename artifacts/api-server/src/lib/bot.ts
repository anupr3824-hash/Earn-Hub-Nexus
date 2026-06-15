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

export async function initBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  const b = getTelegramBot();
  const db = getFirestore();

  b.start(async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const telegramId = String(user.id);
    const referralCode = ctx.startPayload ?? null;

    try {
      const userRef = db.collection("users").doc(telegramId);
      const existing = await userRef.get();

      if (!existing.exists) {
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
            const bonus = 50;
            const now2 = new Date().toISOString();
            await referrer.ref.update({
              balance: (referrer.data().balance ?? 0) + bonus,
              totalEarned: (referrer.data().totalEarned ?? 0) + bonus,
              referralCount: (referrer.data().referralCount ?? 0) + 1,
              updatedAt: now2,
            });
          }
        }

        await userRef.set(userData);
      } else {
        await userRef.update({ lastActiveAt: new Date().toISOString() });
      }

      const settingsDoc = await db.collection("settings").doc("global").get();
      const welcomeMsg = settingsDoc.exists
        ? (settingsDoc.data()!.welcomeMessage ?? "Welcome to EarnBot!")
        : "Welcome to EarnBot!";

      const miniAppUrl = process.env.MINI_APP_URL ?? "https://t.me/your_bot/app";

      await ctx.reply(
        `${welcomeMsg}\n\nEarn coins by completing tasks, inviting friends, and claiming daily bonuses!\n\n💰 Open the app to get started:`,
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
      const doc = await db.collection("users").doc(telegramId).get();
      if (!doc.exists) {
        await ctx.reply("You are not registered. Send /start to register.");
        return;
      }
      const data = doc.data()!;
      await ctx.reply(`💰 Your balance: ${data.balance ?? 0} coins\n📊 Total earned: ${data.totalEarned ?? 0} coins`);
    } catch (err) {
      logger.error({ err }, "Balance command error");
      await ctx.reply("Error fetching balance.");
    }
  });

  b.command("referral", async (ctx) => {
    const telegramId = String(ctx.from!.id);
    try {
      const doc = await db.collection("users").doc(telegramId).get();
      if (!doc.exists) {
        await ctx.reply("You are not registered. Send /start to register.");
        return;
      }
      const data = doc.data()!;
      const code = data.referralCode ?? `REF${telegramId}`;
      const botUsername = process.env.BOT_USERNAME ?? "earnbot";
      await ctx.reply(
        `👥 Your referral code: ${code}\n🔗 Share link: https://t.me/${botUsername}?start=${code}\n\n💰 Earn 50 coins for each friend you invite!`
      );
    } catch (err) {
      logger.error({ err }, "Referral command error");
    }
  });

  b.command("help", async (ctx) => {
    await ctx.reply(
      "📋 Commands:\n/start - Start the bot\n/balance - Check your balance\n/referral - Get your referral link\n/help - Show this help\n\nOpen the mini app to complete tasks and earn more!"
    );
  });

  logger.info("Telegram bot initialized");
}

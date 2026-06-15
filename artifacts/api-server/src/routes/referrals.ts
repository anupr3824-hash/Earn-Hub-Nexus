import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import {
  GetReferralInfoParams,
  GetReferralInfoResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/referrals/:telegramId", async (req, res): Promise<void> => {
  const params = GetReferralInfoParams.safeParse(req.params);
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
  const referralsSnap = await db.collection("users")
    .where("referredBy", "==", params.data.telegramId)
    .get();

  const referrals = referralsSnap.docs.map((d) => {
    const r = d.data();
    return {
      telegramId: r.telegramId as string,
      username: (r.username as string | undefined) ?? null,
      firstName: (r.firstName as string | undefined) ?? "User",
      joinedAt: (r.createdAt as string | undefined) ?? new Date().toISOString(),
      coinsEarned: 50,
    };
  });

  const referralCode = (userData.referralCode as string | undefined) ?? `REF${params.data.telegramId}`;
  res.json(GetReferralInfoResponse.parse({
    referralCode,
    referralLink: `https://t.me/${process.env.BOT_USERNAME ?? "earnbot"}?start=${referralCode}`,
    totalReferrals: referrals.length,
    totalEarnedFromReferrals: referrals.length * 50,
    referrals,
  }));
});

export default router;

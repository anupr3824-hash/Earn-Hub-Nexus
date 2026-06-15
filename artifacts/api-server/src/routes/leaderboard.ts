import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import {
  GetLeaderboardQueryParams,
  GetLeaderboardResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leaderboard", async (req, res): Promise<void> => {
  const params = GetLeaderboardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const limit = params.data.limit ?? 50;

  const snap = await db.collection("users")
    .where("isBanned", "==", false)
    .orderBy("totalEarned", "desc")
    .limit(limit)
    .get();

  const users = snap.docs.map((doc, idx) => {
    const u = doc.data();
    return {
      rank: idx + 1,
      telegramId: u.telegramId as string,
      username: (u.username as string | undefined) ?? null,
      firstName: (u.firstName as string | undefined) ?? "",
      coins: (u.balance as number | undefined) ?? 0,
      totalEarnings: (u.totalEarned as number | undefined) ?? 0,
      badge: idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🏅",
    };
  });

  res.json(GetLeaderboardResponse.parse(users));
});

export default router;

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import tasksRouter from "./tasks";
import walletRouter from "./wallet";
import referralsRouter from "./referrals";
import leaderboardRouter from "./leaderboard";
import notificationsRouter from "./notifications";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import fraudRouter from "./fraud";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(walletRouter);
router.use(referralsRouter);
router.use(leaderboardRouter);
router.use(notificationsRouter);
router.use(settingsRouter);
router.use(adminRouter);
router.use(fraudRouter);
router.use(botRouter);

export default router;

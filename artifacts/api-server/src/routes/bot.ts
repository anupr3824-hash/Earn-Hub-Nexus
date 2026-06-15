import { Router, type IRouter } from "express";
import { getTelegramBot } from "../lib/bot";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/bot/webhook", async (req, res): Promise<void> => {
  try {
    const bot = getTelegramBot();
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    logger.error({ err }, "Webhook handler error");
    res.sendStatus(200);
  }
});

export default router;

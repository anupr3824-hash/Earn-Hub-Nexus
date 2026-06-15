import { Router, type IRouter } from "express";
import { getFirestore } from "../lib/firebase";
import {
  GetUserNotificationsParams,
  GetUserNotificationsResponse,
  MarkAllNotificationsReadParams,
  MarkAllNotificationsReadResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notifications/:telegramId", async (req, res): Promise<void> => {
  const params = GetUserNotificationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const snap = await db.collection("notifications")
    .where("telegramId", "==", params.data.telegramId)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }));
  res.json(GetUserNotificationsResponse.parse(notifications));
});

router.post("/notifications/:telegramId/read-all", async (req, res): Promise<void> => {
  const params = MarkAllNotificationsReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const snap = await db.collection("notifications")
    .where("telegramId", "==", params.data.telegramId)
    .where("isRead", "==", false)
    .get();

  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();

  res.json(MarkAllNotificationsReadResponse.parse({ updated: snap.size }));
});

export default router;

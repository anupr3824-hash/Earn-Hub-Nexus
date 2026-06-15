import { Router, type IRouter } from "express";
import type { Query } from "firebase-admin/firestore";
import { getFirestore } from "../lib/firebase";
import { requireAdmin } from "../middlewares/adminAuth";
import {
  ListTasksQueryParams,
  ListTasksResponse,
  CreateTaskBody,
  GetTaskResponse,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
  CompleteTaskParams,
  CompleteTaskBody,
  CompleteTaskResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tasks", async (req, res): Promise<void> => {
  const params = ListTasksQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const snap = await db.collection("tasks").where("isActive", "==", true).get();
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  res.json(ListTasksResponse.parse(tasks));
});

router.post("/tasks", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const db = getFirestore();
  const now = new Date().toISOString();
  const taskData = {
    ...parsed.data,
    isActive: true,
    completionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await db.collection("tasks").add(taskData);
  const doc = await ref.get();
  res.status(201).json(GetTaskResponse.parse({ id: doc.id, ...doc.data() }));
});

router.get("/tasks/:taskId", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const doc = await db.collection("tasks").doc(params.data.taskId).get();
  if (!doc.exists) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(GetTaskResponse.parse({ id: doc.id, ...doc.data() }));
});

router.patch("/tasks/:taskId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const db = getFirestore();
  const ref = db.collection("tasks").doc(params.data.taskId);
  const doc = await ref.get();
  if (!doc.exists) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await ref.update({ ...parsed.data, updatedAt: new Date().toISOString() });
  const updated = await ref.get();
  res.json(UpdateTaskResponse.parse({ id: updated.id, ...updated.data() }));
});

router.delete("/tasks/:taskId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const db = getFirestore();
  const ref = db.collection("tasks").doc(params.data.taskId);
  const doc = await ref.get();
  if (!doc.exists) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await ref.update({ isActive: false, updatedAt: new Date().toISOString() });
  res.sendStatus(204);
});

router.post("/tasks/:taskId/complete", async (req, res): Promise<void> => {
  const params = CompleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CompleteTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { telegramId, proof } = parsed.data;
  const db = getFirestore();

  const userDoc = await db.collection("users").doc(telegramId).get();
  if (!userDoc.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (userDoc.data()!.isBanned) {
    res.status(403).json({ error: "User is banned" });
    return;
  }

  const taskDoc = await db.collection("tasks").doc(params.data.taskId).get();
  if (!taskDoc.exists || !taskDoc.data()!.isActive) {
    res.status(404).json({ error: "Task not found or inactive" });
    return;
  }

  const completionId = `${telegramId}_${params.data.taskId}`;
  const existingCompletion = await db.collection("taskCompletions").doc(completionId).get();
  if (existingCompletion.exists) {
    res.status(409).json({ error: "Task already completed" });
    return;
  }

  const taskData = taskDoc.data()!;
  const reward = taskData.reward as number;
  const now = new Date().toISOString();

  await db.collection("taskCompletions").doc(completionId).set({
    telegramId,
    taskId: params.data.taskId,
    proof: proof ?? null,
    reward,
    completedAt: now,
  });

  const userData = userDoc.data()!;
  await userDoc.ref.update({
    balance: (userData.balance ?? 0) + reward,
    totalEarned: (userData.totalEarned ?? 0) + reward,
    taskCompletionCount: (userData.taskCompletionCount ?? 0) + 1,
    updatedAt: now,
  });

  await taskDoc.ref.update({
    completionCount: (taskData.completionCount ?? 0) + 1,
    updatedAt: now,
  });

  const txRef = db.collection("transactions").doc();
  await txRef.set({
    telegramId,
    type: "task",
    amount: reward,
    description: `Task completed: ${taskData.title as string}`,
    status: "completed",
    taskId: params.data.taskId,
    createdAt: now,
  });

  req.log.info({ telegramId, taskId: params.data.taskId, reward }, "Task completed");
  res.json(CompleteTaskResponse.parse({
    success: true,
    coinsEarned: reward,
    totalCoins: (userData.balance ?? 0) + reward,
    message: `Earned ${reward} coins!`,
  }));
});

export default router;

import { Router, type IRouter } from "express";
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
  const [tasksSnap, completionsSnap] = await Promise.all([
    db.collection("tasks").where("isActive", "==", true).get(),
    params.data.telegramId
      ? db.collection("taskCompletions").where("telegramId", "==", params.data.telegramId).get()
      : Promise.resolve(null),
  ]);

  const completedTaskIds = new Set(
    completionsSnap?.docs.map((d) => (d.data().taskId as string | undefined) ?? "") ?? []
  );

  const tasks = tasksSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: (data.title as string | undefined) ?? "",
      description: (data.description as string | undefined) ?? "",
      type: (data.type as string | undefined) ?? "general",
      reward: (data.reward as number | undefined) ?? 0,
      url: (data.url as string | undefined) ?? null,
      icon: (data.icon as string | undefined) ?? null,
      isActive: (data.isActive as boolean | undefined) ?? true,
      isCompleted: completedTaskIds.has(d.id),
      totalCompletions: (data.completionCount as number | undefined) ?? 0,
      createdAt: (data.createdAt as string | undefined) ?? new Date().toISOString(),
    };
  });

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
  const data = doc.data() as Record<string, unknown>;
  res.status(201).json(GetTaskResponse.parse({
    id: doc.id,
    title: data.title as string,
    description: data.description as string,
    type: data.type as string,
    reward: data.reward as number,
    url: (data.url as string | undefined) ?? null,
    icon: (data.icon as string | undefined) ?? null,
    isActive: data.isActive as boolean,
    isCompleted: false,
    totalCompletions: 0,
    createdAt: data.createdAt as string,
  }));
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
  const data = doc.data() as Record<string, unknown>;
  res.json(GetTaskResponse.parse({
    id: doc.id,
    title: data.title as string,
    description: data.description as string,
    type: data.type as string,
    reward: data.reward as number,
    url: (data.url as string | undefined) ?? null,
    icon: (data.icon as string | undefined) ?? null,
    isActive: (data.isActive as boolean | undefined) ?? true,
    isCompleted: false,
    totalCompletions: (data.completionCount as number | undefined) ?? 0,
    createdAt: (data.createdAt as string | undefined) ?? new Date().toISOString(),
  }));
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
  const data = updated.data() as Record<string, unknown>;
  res.json(UpdateTaskResponse.parse({
    id: updated.id,
    title: data.title as string,
    description: data.description as string,
    type: data.type as string,
    reward: data.reward as number,
    url: (data.url as string | undefined) ?? null,
    icon: (data.icon as string | undefined) ?? null,
    isActive: (data.isActive as boolean | undefined) ?? true,
    isCompleted: false,
    totalCompletions: (data.completionCount as number | undefined) ?? 0,
    createdAt: (data.createdAt as string | undefined) ?? new Date().toISOString(),
  }));
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
  const newBalance = (userData.balance ?? 0) + reward;
  await userDoc.ref.update({
    balance: newBalance,
    totalEarned: (userData.totalEarned ?? 0) + reward,
    taskCompletionCount: (userData.taskCompletionCount ?? 0) + 1,
    updatedAt: now,
  });

  await taskDoc.ref.update({
    completionCount: (taskData.completionCount ?? 0) + 1,
    updatedAt: now,
  });

  await db.collection("transactions").doc().set({
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
    totalCoins: newBalance,
    message: `Earned ${reward} coins!`,
  }));
});

export default router;

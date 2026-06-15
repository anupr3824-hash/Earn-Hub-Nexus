import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { CheckCircle, Clock, ExternalLink, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: string;
  url: string | null;
  isActive: boolean;
  isCompleted?: boolean;
}

interface TasksResponse {
  tasks: Task[];
  completedTaskIds: string[];
}

export default function TasksPage() {
  const telegramId = localStorage.getItem("tg_user_id") ?? "demo";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery<TasksResponse>({
    queryKey: ["tasks", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/tasks?telegramId=${telegramId}`);
      return res.data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await axiosInstance.post("/tasks/complete", {
        telegramId,
        taskId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast({ title: `+${data.coinsEarned} coins earned!`, description: data.message ?? "Task completed!" });
      qc.invalidateQueries({ queryKey: ["tasks", telegramId] });
      qc.invalidateQueries({ queryKey: ["stats", telegramId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed to complete task";
      toast({ title: "Error", description: msg, variant: "destructive" });
      refetch();
    },
  });

  const tasks = data?.tasks ?? [];
  const completedIds = new Set(data?.completedTaskIds ?? []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.isActive && !completedIds.has(t.id));
  const doneTasks = tasks.filter((t) => completedIds.has(t.id));

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="bg-gradient-to-br from-primary/20 to-accent/10 px-4 pt-8 pb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">Complete tasks to earn coins</p>
      </div>

      <div className="px-4 mt-5 space-y-4">
        {activeTasks.length === 0 && doneTasks.length === 0 && (
          <div className="text-center text-muted-foreground py-12">No tasks available right now.</div>
        )}

        {activeTasks.length > 0 && (
          <>
            <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Available Tasks</h2>
            {activeTasks.map((task) => (
              <div key={task.id} className="bg-card border border-card-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium capitalize">
                        {task.type}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm">{task.title}</h3>
                    <p className="text-muted-foreground text-xs mt-1">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm whitespace-nowrap">
                    <Coins className="w-4 h-4" />
                    +{task.reward}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  {task.url && (
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        if (window.Telegram?.WebApp?.openLink) {
                          window.Telegram.WebApp.openLink(task.url!);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1 bg-secondary text-secondary-foreground rounded-xl py-2 text-sm font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </a>
                  )}
                  <button
                    onClick={() => completeMutation.mutate(task.id)}
                    disabled={completeMutation.isPending}
                    className="flex-1 bg-primary text-primary-foreground rounded-xl py-2 text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {completeMutation.isPending ? "..." : "Claim"}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {doneTasks.length > 0 && (
          <>
            <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider mt-4">Completed</h2>
            {doneTasks.map((task) => (
              <div key={task.id} className="bg-muted border border-border rounded-2xl p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{task.title}</h3>
                    <p className="text-muted-foreground text-xs mt-0.5">{task.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-green-500 font-bold text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Done
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

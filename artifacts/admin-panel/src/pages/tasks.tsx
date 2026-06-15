import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Plus, Trash2, Edit3, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: string;
  url: string | null;
  isActive: boolean;
  completionCount: number;
  createdAt: string;
}

const emptyForm = { title: "", description: "", reward: 10, type: "social", url: "", isActive: true };

export default function TasksPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const res = await axiosInstance.get("/tasks/admin");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/tasks", {
        ...form,
        url: form.url || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Task created!" });
      setShowForm(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to create task", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editTask) return;
      await axiosInstance.put(`/tasks/${editTask.id}`, { ...form, url: form.url || null });
    },
    onSuccess: () => {
      toast({ title: "Task updated!" });
      setEditTask(null);
      qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Task deleted" });
      qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    },
  });

  const tasks: Task[] = data?.tasks ?? [];

  const TaskForm = ({ onSubmit, onCancel, loading }: { onSubmit: () => void; onCancel: () => void; loading: boolean }) => (
    <div className="bg-card border border-card-border rounded-2xl p-5 mb-5 shadow-sm">
      <h3 className="font-bold mb-4">{editTask ? "Edit Task" : "Create New Task"}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="Follow our Twitter" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm resize-none" placeholder="Task description..." />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm">
            <option value="social">Social</option>
            <option value="telegram">Telegram</option>
            <option value="youtube">YouTube</option>
            <option value="partner">Partner</option>
            <option value="daily">Daily</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Reward (coins)</label>
          <input type="number" value={form.reward} onChange={(e) => setForm({ ...form, reward: parseInt(e.target.value) || 0 })} className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">URL (optional)</label>
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm" placeholder="https://..." />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded" />
          <label htmlFor="isActive" className="text-sm">Active</label>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="flex-1 bg-muted text-muted-foreground rounded-xl py-2.5 text-sm font-medium">Cancel</button>
        <button onClick={onSubmit} disabled={loading || !form.title} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
          {loading ? "Saving..." : editTask ? "Update Task" : "Create Task"}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">{tasks.length} tasks total</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditTask(null); setForm(emptyForm); }}
          className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {(showForm || editTask) && (
        <TaskForm
          onSubmit={() => editTask ? updateMutation.mutate() : createMutation.mutate()}
          onCancel={() => { setShowForm(false); setEditTask(null); }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {isLoading && <p className="text-center text-muted-foreground py-12">Loading...</p>}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="bg-card border border-card-border rounded-2xl p-4 shadow-sm flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${task.isActive ? "bg-green-500/10" : "bg-muted"}`}>
              {task.isActive ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 capitalize">{task.type}</span>
                    <span className="text-xs text-yellow-500 font-bold">+{task.reward} coins</span>
                    <span className="text-xs text-muted-foreground">{task.completionCount} completions</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditTask(task); setShowForm(false); setForm({ title: task.title, description: task.description, reward: task.reward, type: task.type, url: task.url ?? "", isActive: task.isActive }); }}
                    className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
                    disabled={deleteMutation.isPending}
                    className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

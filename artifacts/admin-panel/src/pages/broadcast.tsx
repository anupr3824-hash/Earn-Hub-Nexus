import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Send, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BroadcastPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", message: "", type: "info" });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/admin/broadcast", form);
      return res.data;
    },
    onSuccess: (data) => {
      toast({ title: "Broadcast sent!", description: `Sent to ${data.sentCount ?? 0} users` });
      setForm({ title: "", message: "", type: "info" });
    },
    onError: () => toast({ title: "Error", description: "Failed to send broadcast", variant: "destructive" }),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-primary" />
          Broadcast
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Send notifications to all users</p>
      </div>

      <div className="max-w-xl">
        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Notification Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm"
            >
              <option value="info">Info</option>
              <option value="task">New Task</option>
              <option value="bonus">Bonus</option>
              <option value="warning">Warning</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Notification title"
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={5}
              placeholder="Write your message here..."
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400">
            This will send a Telegram notification to ALL registered users.
          </div>

          <button
            onClick={() => broadcastMutation.mutate()}
            disabled={broadcastMutation.isPending || !form.title || !form.message}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {broadcastMutation.isPending ? "Sending..." : "Send Broadcast"}
          </button>
        </div>
      </div>
    </div>
  );
}

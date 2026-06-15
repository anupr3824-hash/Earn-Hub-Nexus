import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Search, Ban, CheckCircle, Edit3, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  coins: number;
  totalEarnings: number;
  isBanned: boolean;
  tasksCompleted: number;
  referralCount: number;
  riskScore: number;
  createdAt: string;
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editCoins, setEditCoins] = useState("");
  const [editReason, setEditReason] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (search) params.set("search", search);
      const res = await axiosInstance.get(`/admin/users?${params}`);
      return res.data;
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({ telegramId, ban, reason }: { telegramId: string; ban: boolean; reason?: string }) => {
      if (ban) {
        await axiosInstance.post(`/admin/users/${telegramId}/ban`, { reason: reason ?? "Violation of rules" });
      } else {
        await axiosInstance.post(`/admin/users/${telegramId}/unban`);
      }
    },
    onSuccess: (_, { ban }) => {
      toast({ title: ban ? "User banned" : "User unbanned" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Action failed", variant: "destructive" });
    },
  });

  const editBalanceMutation = useMutation({
    mutationFn: async ({ telegramId, coins, reason }: { telegramId: string; coins: number; reason: string }) => {
      await axiosInstance.put(`/admin/users/${telegramId}/balance`, { coins, reason });
    },
    onSuccess: () => {
      toast({ title: "Balance updated!" });
      setEditUser(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update balance", variant: "destructive" });
    },
  });

  const users: AdminUser[] = data?.users ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} total users</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="pl-9 pr-4 py-2 bg-input border border-border rounded-xl text-sm w-52 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold mb-4">Edit Balance — {editUser.firstName}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">New Coin Balance</label>
                <input
                  type="number"
                  value={editCoins}
                  onChange={(e) => setEditCoins(e.target.value)}
                  placeholder={`Current: ${editUser.coins}`}
                  className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Reason</label>
                <input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Admin adjustment"
                  className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditUser(null)} className="flex-1 bg-muted text-muted-foreground rounded-xl py-2.5 text-sm font-medium">Cancel</button>
              <button
                onClick={() => editBalanceMutation.mutate({ telegramId: editUser.telegramId, coins: parseFloat(editCoins), reason: editReason || "Admin adjustment" })}
                disabled={editBalanceMutation.isPending || !editCoins}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {editBalanceMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading && (
          <div className="py-12 text-center text-muted-foreground">Loading users...</div>
        )}
        {!isLoading && users.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">No users found</div>
        )}
        {users.map((user) => (
          <div key={user.telegramId} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
              {user.firstName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{user.firstName}</p>
                {user.isBanned && <span className="text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">Banned</span>}
                {user.riskScore > 50 && <span className="text-xs bg-orange-500/10 text-orange-500 rounded-full px-2 py-0.5">Risk:{user.riskScore}</span>}
              </div>
              {user.username && <p className="text-xs text-muted-foreground">@{user.username}</p>}
              <p className="text-xs text-muted-foreground">{user.telegramId}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-yellow-500">{user.coins.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">coins</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => { setEditUser(user); setEditCoins(String(user.coins)); setEditReason(""); }}
                className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20"
                title="Edit balance"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => banMutation.mutate({ telegramId: user.telegramId, ban: !user.isBanned })}
                disabled={banMutation.isPending}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${user.isBanned ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20"}`}
                title={user.isBanned ? "Unban" : "Ban"}
              >
                {user.isBanned ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

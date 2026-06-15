import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Users, CheckSquare, Coins, TrendingUp, AlertTriangle, Clock } from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  totalTasks: number;
  totalCompletions: number;
  totalCoinsDistributed: number;
  pendingWithdrawals: number;
  pendingWithdrawalAmount: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/stats");
      return res.data;
    },
  });

  const cards = [
    { icon: Users, label: "Total Users", value: stats?.totalUsers ?? 0, sub: `${stats?.activeUsers ?? 0} active`, color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: AlertTriangle, label: "Banned Users", value: stats?.bannedUsers ?? 0, sub: "accounts suspended", color: "text-red-500", bg: "bg-red-500/10" },
    { icon: CheckSquare, label: "Task Completions", value: stats?.totalCompletions ?? 0, sub: `${stats?.totalTasks ?? 0} total tasks`, color: "text-green-500", bg: "bg-green-500/10" },
    { icon: Coins, label: "Coins Distributed", value: (stats?.totalCoinsDistributed ?? 0).toLocaleString(), sub: "all time", color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { icon: Clock, label: "Pending Withdrawals", value: stats?.pendingWithdrawals ?? 0, sub: `${(stats?.pendingWithdrawalAmount ?? 0).toLocaleString()} coins`, color: "text-orange-500", bg: "bg-orange-500/10" },
    { icon: TrendingUp, label: "Completion Rate", value: stats && stats.totalUsers > 0 ? `${Math.round((stats.totalCompletions / stats.totalUsers) * 100)}%` : "0%", sub: "completions / users", color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`text-3xl font-extrabold mt-1 ${isLoading ? "opacity-30" : ""}`}>
                  {isLoading ? "—" : value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

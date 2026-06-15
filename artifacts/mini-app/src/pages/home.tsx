import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { getTelegramUser } from "@/lib/telegram";
import { Coins, Star, Users, Trophy, CheckSquare, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserStats {
  coins: number;
  totalEarnings: number;
  tasksCompleted: number;
  referralCount: number;
  rank: string;
  streakDays: number;
  pendingWithdrawals: number;
  dailyBonusAvailable: boolean;
  nextDailyBonusIn: number | null;
}

interface UserProfile {
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  coins: number;
  totalEarnings: number;
  referralCode: string;
  isBanned: boolean;
  streakDays: number;
}

export default function HomePage() {
  const tgUser = getTelegramUser();
  const telegramId = tgUser?.id?.toString() ?? localStorage.getItem("tg_user_id") ?? "demo";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (telegramId && telegramId !== "demo") {
      localStorage.setItem("tg_user_id", telegramId);
    }
  }, [telegramId]);

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["profile", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/users/profile?telegramId=${telegramId}`);
      return res.data;
    },
    enabled: !!telegramId && registered,
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["stats", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/users/stats?telegramId=${telegramId}`);
      return res.data;
    },
    enabled: !!telegramId && registered,
    retry: false,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const startParam = new URLSearchParams(window.location.search).get("ref") ??
        window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      const res = await axiosInstance.post("/users/register", {
        telegramId,
        username: tgUser?.username,
        firstName: tgUser?.first_name ?? "User",
        lastName: tgUser?.last_name,
        referralCode: startParam,
        initData: window.Telegram?.WebApp?.initData ?? "",
      });
      return res.data;
    },
    onSuccess: () => {
      setRegistered(true);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      setRegistered(true);
    },
  });

  useEffect(() => {
    if (telegramId) {
      registerMutation.mutate();
    }
  }, [telegramId]);

  const dailyBonusMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post(`/users/${telegramId}/daily-bonus`);
      return res.data;
    },
    onSuccess: (data) => {
      toast({ title: `+${data.coinsEarned} coins!`, description: data.message });
      qc.invalidateQueries({ queryKey: ["stats", telegramId] });
      qc.invalidateQueries({ queryKey: ["profile", telegramId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Already claimed";
      toast({ title: "Already claimed", description: msg, variant: "destructive" });
    },
  });

  const loading = profileLoading || statsLoading || registerMutation.isPending;

  const displayName = profile?.firstName ?? tgUser?.first_name ?? "User";
  const coins = stats?.coins ?? profile?.coins ?? 0;
  const totalEarnings = stats?.totalEarnings ?? profile?.totalEarnings ?? 0;

  const statCards = [
    { icon: Coins, label: "Coins", value: coins.toLocaleString(), color: "text-yellow-500" },
    { icon: Star, label: "Total Earned", value: totalEarnings.toLocaleString(), color: "text-blue-400" },
    { icon: Users, label: "Referrals", value: stats?.referralCount ?? 0, color: "text-green-400" },
    { icon: Trophy, label: "Rank", value: `#${stats?.rank ?? "—"}`, color: "text-purple-400" },
    { icon: CheckSquare, label: "Tasks Done", value: stats?.tasksCompleted ?? 0, color: "text-cyan-400" },
    { icon: Zap, label: "Streak", value: `${stats?.streakDays ?? 0}d`, color: "text-orange-400" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="bg-gradient-to-br from-primary/20 to-accent/10 px-4 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary border-2 border-primary/30">
            {displayName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Welcome back,</p>
            <h1 className="text-xl font-bold">{displayName}</h1>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-md">
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Balance</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-extrabold text-yellow-500">{loading ? "..." : coins.toLocaleString()}</span>
            <span className="text-muted-foreground mb-1 text-sm">coins</span>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {statCards.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-card border border-card-border rounded-xl p-3 text-center shadow-sm">
              <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-bold text-sm">{loading ? "—" : value}</p>
            </div>
          ))}
        </div>

        {stats?.dailyBonusAvailable ? (
          <button
            onClick={() => dailyBonusMutation.mutate()}
            disabled={dailyBonusMutation.isPending}
            className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
          >
            <Zap className="w-5 h-5" />
            {dailyBonusMutation.isPending ? "Claiming..." : "Claim Daily Bonus +10 coins"}
          </button>
        ) : (
          <div className="w-full bg-muted rounded-2xl py-4 text-center text-muted-foreground text-sm">
            Daily bonus claimed — come back tomorrow!
          </div>
        )}

        {profile?.referralCode && (
          <div className="mt-4 bg-card border border-card-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono font-bold">{profile.referralCode}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://t.me/?start=${profile.referralCode}`);
                  toast({ title: "Copied!", description: "Referral link copied to clipboard" });
                }}
                className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Earn 50 coins for each friend you refer!</p>
          </div>
        )}
      </div>
    </div>
  );
}

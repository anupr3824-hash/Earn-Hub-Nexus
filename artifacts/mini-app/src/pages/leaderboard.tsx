import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Trophy, Medal, Crown } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  telegramId: string;
  username: string | null;
  firstName: string;
  coins: number;
  totalEarnings: number;
}

export default function LeaderboardPage() {
  const telegramId = localStorage.getItem("tg_user_id") ?? "demo";

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await axiosInstance.get("/leaderboard?limit=50");
      return res.data;
    },
  });

  const entries: LeaderboardEntry[] = data?.leaderboard ?? [];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 text-center text-xs font-bold text-muted-foreground">{rank}</span>;
  };

  const isCurrentUser = (entry: LeaderboardEntry) => entry.telegramId === telegramId;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="bg-gradient-to-br from-primary/20 to-accent/10 px-4 pt-8 pb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Top earners this week</p>
      </div>

      {entries.length > 0 && (
        <div className="px-4 mt-5 grid grid-cols-3 gap-3">
          {entries.slice(0, 3).map((entry, i) => (
            <div
              key={entry.telegramId}
              className={`bg-card border rounded-2xl p-3 text-center ${
                i === 0 ? "border-yellow-400/50 shadow-lg shadow-yellow-500/10" :
                i === 1 ? "border-gray-400/50" : "border-amber-600/50"
              }`}
            >
              <div className="text-2xl mb-1">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
              </div>
              <p className="text-xs font-bold truncate">{entry.firstName}</p>
              <p className="text-yellow-500 font-extrabold text-sm mt-1">{entry.coins.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 mt-4 space-y-2">
        {isLoading && (
          <p className="text-center text-muted-foreground py-8">Loading leaderboard...</p>
        )}

        {!isLoading && entries.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No data yet. Be the first!</p>
        )}

        {entries.slice(3).map((entry) => (
          <div
            key={entry.telegramId}
            className={`flex items-center gap-3 bg-card border rounded-xl p-3 ${
              isCurrentUser(entry) ? "border-primary/50 bg-primary/5" : "border-card-border"
            }`}
          >
            <div className="w-8 flex items-center justify-center flex-shrink-0">
              {getRankIcon(entry.rank)}
            </div>
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
              {entry.firstName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isCurrentUser(entry) ? "text-primary" : ""}`}>
                {entry.firstName}
                {isCurrentUser(entry) && <span className="text-xs ml-1 text-muted-foreground">(You)</span>}
              </p>
              {entry.username && (
                <p className="text-xs text-muted-foreground truncate">@{entry.username}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-bold text-yellow-500 text-sm">{entry.coins.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">coins</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

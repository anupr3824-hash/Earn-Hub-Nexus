import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Users, Gift, Share2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Referral {
  telegramId: string;
  firstName: string;
  username: string | null;
  coinsEarned: number;
  joinedAt: string;
}

interface ReferralData {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  totalEarnedFromReferrals: number;
  referrals: Referral[];
}

export default function ReferralsPage() {
  const telegramId = localStorage.getItem("tg_user_id") ?? "demo";
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ReferralData>({
    queryKey: ["referrals", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/referrals/${telegramId}`);
      return res.data;
    },
  });

  const referralLink = data?.referralLink ?? `https://t.me/earnbot?start=${data?.referralCode ?? ""}`;

  const share = () => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("🎉 Join EarnBot and earn coins completing tasks! Use my referral link:")}`
      );
    } else {
      navigator.clipboard.writeText(referralLink);
      toast({ title: "Copied!", description: "Referral link copied to clipboard" });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="bg-gradient-to-br from-primary/20 to-accent/10 px-4 pt-8 pb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Referrals
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Invite friends, earn coins together</p>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-card-border rounded-2xl p-4 text-center shadow-sm">
            <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-extrabold">{isLoading ? "—" : (data?.totalReferrals ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Friends Invited</p>
          </div>
          <div className="bg-card border border-card-border rounded-2xl p-4 text-center shadow-sm">
            <Gift className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-extrabold">{isLoading ? "—" : (data?.totalEarnedFromReferrals ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Coins Earned</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-2">Your Referral Link</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs font-mono truncate">
              {data?.referralCode ? referralLink : "Loading..."}
            </code>
            <button
              onClick={copyLink}
              className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </div>
          <button
            onClick={share}
            className="w-full mt-3 bg-primary text-primary-foreground rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Share2 className="w-4 h-4" />
            Share with Friends
          </button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            You earn coins for every friend who joins using your link
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider mb-3">
            Your Referrals ({isLoading ? "..." : (data?.totalReferrals ?? 0)})
          </h2>

          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-card-border rounded-xl p-3 h-14 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && (data?.referrals?.length ?? 0) === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No referrals yet</p>
              <p className="text-xs mt-1">Share your link to start earning!</p>
            </div>
          )}

          <div className="space-y-2">
            {(data?.referrals ?? []).map((ref) => (
              <div key={ref.telegramId} className="flex items-center gap-3 bg-card border border-card-border rounded-xl p-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0">
                  {ref.firstName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{ref.firstName}</p>
                  {ref.username && <p className="text-xs text-muted-foreground">@{ref.username}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-yellow-500">+{ref.coinsEarned}</p>
                  <p className="text-xs text-muted-foreground">{new Date(ref.joinedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

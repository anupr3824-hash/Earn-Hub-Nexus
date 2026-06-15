import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Users, Gift, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Referral {
  telegramId: string;
  firstName: string;
  username: string | null;
  coins: number;
  joinedAt: string;
}

interface ReferralData {
  referralCode: string;
  referralCount: number;
  totalEarned: number;
  referrals: Referral[];
}

export default function ReferralsPage() {
  const telegramId = localStorage.getItem("tg_user_id") ?? "demo";
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ReferralData>({
    queryKey: ["referrals", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/referrals?telegramId=${telegramId}`);
      return res.data;
    },
  });

  const referralLink = `https://t.me/?start=${data?.referralCode ?? ""}`;

  const share = () => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join and earn coins!")}`
      );
    } else {
      navigator.clipboard.writeText(referralLink);
      toast({ title: "Copied!", description: "Referral link copied" });
    }
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
            <p className="text-2xl font-extrabold">{isLoading ? "—" : (data?.referralCount ?? 0)}</p>
            <p className="text-xs text-muted-foreground">Friends Invited</p>
          </div>
          <div className="bg-card border border-card-border rounded-2xl p-4 text-center shadow-sm">
            <Gift className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-extrabold">{isLoading ? "—" : (data?.totalEarned ?? 0)}</p>
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
              onClick={() => {
                navigator.clipboard.writeText(referralLink);
                toast({ title: "Copied!" });
              }}
              className="bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-xs font-medium"
            >
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
            You earn <strong>50 coins</strong> for every friend who joins
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider mb-2">
            Your Referrals ({data?.referralCount ?? 0})
          </h2>

          {isLoading && <p className="text-center text-muted-foreground py-6">Loading...</p>}

          {!isLoading && (data?.referrals?.length ?? 0) === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No referrals yet. Share your link!</p>
            </div>
          )}

          {(data?.referrals ?? []).map((ref) => (
            <div key={ref.telegramId} className="flex items-center gap-3 bg-card border border-card-border rounded-xl p-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                {ref.firstName[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{ref.firstName}</p>
                {ref.username && <p className="text-xs text-muted-foreground">@{ref.username}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{new Date(ref.joinedAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

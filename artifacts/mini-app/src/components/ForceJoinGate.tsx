import { useQuery, useMutation } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { ExternalLink, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Channel {
  channelId: string;
  channelName: string;
  channelUrl: string;
}

interface ForceJoinStatus {
  verified: boolean;
  pendingChannels: Channel[];
}

interface ForceJoinGateProps {
  telegramId: string;
  children: React.ReactNode;
}

export default function ForceJoinGate({ telegramId, children }: ForceJoinGateProps) {
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<ForceJoinStatus>({
    queryKey: ["force-join", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.post("/settings/verify-force-join", { telegramId });
      return res.data;
    },
    enabled: !!telegramId && telegramId !== "demo",
    retry: false,
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/settings/verify-force-join", { telegramId });
      return res.data;
    },
    onSuccess: (result: ForceJoinStatus) => {
      if (result.verified) {
        toast({ title: "✅ Verified!", description: "You have joined all required channels." });
        refetch();
      } else {
        toast({
          title: "Not yet joined",
          description: `Please join all ${result.pendingChannels.length} channel(s) first.`,
          variant: "destructive",
        });
      }
    },
  });

  const openChannel = (url: string) => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  if (isLoading) return <>{children}</>;
  if (!data || data.verified || data.pendingChannels.length === 0) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm px-4">
      <div className="bg-card border border-card-border rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📢</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Join Required Channels</h2>
          <p className="text-sm text-muted-foreground">
            You need to join the following channels to use this app.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {data.pendingChannels.map((ch) => (
            <button
              key={ch.channelId}
              onClick={() => openChannel(ch.channelUrl)}
              className="w-full flex items-center justify-between bg-muted hover:bg-muted/80 rounded-2xl px-4 py-3 text-left transition-colors active:scale-98"
            >
              <span className="font-medium text-sm">{ch.channelName}</span>
              <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>

        <button
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending}
          className="w-full bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <CheckCircle className="w-4 h-4" />
          {verifyMutation.isPending ? "Checking…" : "I've Joined — Verify"}
        </button>
      </div>
    </div>
  );
}

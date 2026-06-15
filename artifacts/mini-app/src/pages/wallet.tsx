import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { Coins, ArrowUpRight, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  accountDetails: string;
  status: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
}

export default function WalletPage() {
  const telegramId = localStorage.getItem("tg_user_id") ?? "demo";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [method, setMethod] = useState("usdt");
  const [accountDetails, setAccountDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [tab, setTab] = useState<"transactions" | "withdrawals">("transactions");

  const { data: stats } = useQuery({
    queryKey: ["stats", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/users/stats?telegramId=${telegramId}`);
      return res.data;
    },
  });

  const { data: txData } = useQuery({
    queryKey: ["transactions", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/wallet/transactions?telegramId=${telegramId}`);
      return res.data;
    },
  });

  const { data: wdData } = useQuery({
    queryKey: ["withdrawals", telegramId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/wallet/withdrawals?telegramId=${telegramId}`);
      return res.data;
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/wallet/withdraw", {
        telegramId,
        amount: parseFloat(amount),
        method,
        accountDetails,
      });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Withdrawal requested!", description: "Your withdrawal is being processed." });
      setAmount("");
      setAccountDetails("");
      qc.invalidateQueries({ queryKey: ["stats", telegramId] });
      qc.invalidateQueries({ queryKey: ["withdrawals", telegramId] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Withdrawal failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const coins = stats?.coins ?? 0;
  const transactions: Transaction[] = txData?.transactions ?? [];
  const withdrawals: Withdrawal[] = wdData?.withdrawals ?? [];

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="bg-gradient-to-br from-primary/20 to-accent/10 px-4 pt-8 pb-6">
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your earnings</p>

        <div className="bg-card border border-card-border rounded-2xl p-5 mt-4 shadow-md">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-4xl font-extrabold text-yellow-500">{coins.toLocaleString()}</span>
            <span className="text-muted-foreground mb-1 text-sm">coins</span>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5">
        <div className="bg-card border border-card-border rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-primary" />
            Request Withdrawal
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="usdt">USDT (TRC20)</option>
                <option value="ton">TON</option>
                <option value="btc">Bitcoin</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Wallet Address / Account</label>
              <input
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
                placeholder="Enter your wallet address"
                className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Amount (coins)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Minimum 100 coins"
                className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <button
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !amount || !accountDetails}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Coins className="w-4 h-4" />
              {withdrawMutation.isPending ? "Submitting..." : "Request Withdrawal"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setTab("transactions")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "transactions" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Transactions
          </button>
          <button
            onClick={() => setTab("withdrawals")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === "withdrawals" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            Withdrawals
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {tab === "transactions" && (
            transactions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No transactions yet</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="bg-card border border-card-border rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(tx.status)}
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-sm ${tx.amount > 0 ? "text-green-500" : "text-destructive"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
              ))
            )
          )}

          {tab === "withdrawals" && (
            withdrawals.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No withdrawals yet</p>
            ) : (
              withdrawals.map((wd) => (
                <div key={wd.id} className="bg-card border border-card-border rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(wd.status)}
                    <div>
                      <p className="text-sm font-medium capitalize">{wd.method} withdrawal</p>
                      <p className="text-xs text-muted-foreground">{new Date(wd.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-yellow-500">{wd.amount} coins</span>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

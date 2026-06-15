import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/lib/api";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Withdrawal {
  id: string;
  telegramId: string;
  amount: number;
  method: string;
  accountDetails: string;
  status: string;
  createdAt: string;
  firstName?: string;
  username?: string | null;
}

export default function WithdrawalsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", statusFilter],
    queryFn: async () => {
      const res = await axiosInstance.get(`/admin/withdrawals?status=${statusFilter}&limit=50`);
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      await axiosInstance.post(`/admin/withdrawals/${id}/${action}`);
    },
    onSuccess: (_, { action }) => {
      toast({ title: action === "approve" ? "Withdrawal approved!" : "Withdrawal rejected" });
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: () => toast({ title: "Error", description: "Action failed", variant: "destructive" }),
  });

  const withdrawals: Withdrawal[] = data?.withdrawals ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="text-muted-foreground text-sm mt-1">Review and process withdrawal requests</p>
      </div>

      <div className="flex gap-2 mb-5">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-center text-muted-foreground py-12">Loading...</p>}

      {!isLoading && withdrawals.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No {statusFilter} withdrawals</p>
      )}

      <div className="space-y-3">
        {withdrawals.map((wd) => (
          <div key={wd.id} className="bg-card border border-card-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {wd.status === "approved" && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {wd.status === "rejected" && <XCircle className="w-4 h-4 text-destructive" />}
                  {wd.status === "pending" && <Clock className="w-4 h-4 text-yellow-500" />}
                  <span className="font-semibold text-sm capitalize">{wd.method} Withdrawal</span>
                  <span className="text-yellow-500 font-bold text-sm">{wd.amount} coins</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  User: {wd.firstName ?? wd.telegramId}{wd.username ? ` (@${wd.username})` : ""}
                </p>
                <div className="mt-2 bg-muted rounded-lg px-3 py-2">
                  <p className="text-xs text-muted-foreground">Account Details</p>
                  <code className="text-xs font-mono break-all">{wd.accountDetails}</code>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{new Date(wd.createdAt).toLocaleString()}</p>
              </div>

              {wd.status === "pending" && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveMutation.mutate({ id: wd.id, action: "approve" })}
                    disabled={approveMutation.isPending}
                    className="px-3 py-1.5 bg-green-500/10 text-green-500 rounded-xl text-xs font-bold hover:bg-green-500/20 flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ id: wd.id, action: "reject" })}
                    disabled={approveMutation.isPending}
                    className="px-3 py-1.5 bg-destructive/10 text-destructive rounded-xl text-xs font-bold hover:bg-destructive/20 flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

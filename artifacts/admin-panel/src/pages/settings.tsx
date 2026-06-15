import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { axiosInstance } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Settings, Link, Bot } from "lucide-react";

interface PlatformSettings {
  dailyBonusAmount: number;
  referralBonusAmount: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
  botUsername: string;
  maintenanceMode: boolean;
  withdrawMethods: string[];
}

interface ForceJoinChannel {
  id: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newChannel, setNewChannel] = useState({ channelId: "", channelName: "", channelUrl: "" });

  const { data: settings, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/settings");
      return res.data;
    },
  });

  const { data: channels = [], isLoading: channelsLoading } = useQuery<ForceJoinChannel[]>({
    queryKey: ["force-join-channels"],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/force-join");
      return res.data;
    },
  });

  const [form, setForm] = useState<PlatformSettings | null>(null);
  const currentSettings = form ?? settings;

  const saveSettings = useMutation({
    mutationFn: async (data: Partial<PlatformSettings>) => {
      const res = await axiosInstance.patch("/admin/settings", data);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Platform settings updated successfully." });
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      setForm(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    },
  });

  const addChannel = useMutation({
    mutationFn: async (data: typeof newChannel) => {
      const res = await axiosInstance.post("/admin/force-join", data);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Channel added", description: "Force join channel added." });
      qc.invalidateQueries({ queryKey: ["force-join-channels"] });
      setNewChannel({ channelId: "", channelName: "", channelUrl: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add channel.", variant: "destructive" });
    },
  });

  const removeChannel = useMutation({
    mutationFn: async (channelId: string) => {
      await axiosInstance.delete(`/admin/force-join/${channelId}`);
    },
    onSuccess: () => {
      toast({ title: "Channel removed" });
      qc.invalidateQueries({ queryKey: ["force-join-channels"] });
    },
  });

  if (isLoading || !currentSettings) {
    return <div className="text-muted-foreground p-4">Loading settings…</div>;
  }

  const handleChange = (key: keyof PlatformSettings, value: unknown) => {
    setForm((prev) => ({ ...(prev ?? currentSettings), [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Platform Settings */}
      <div className="bg-card border border-card-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Platform Settings</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Daily Bonus (coins)</label>
            <input
              type="number"
              value={currentSettings.dailyBonusAmount}
              onChange={(e) => handleChange("dailyBonusAmount", Number(e.target.value))}
              className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Referral Bonus (coins)</label>
            <input
              type="number"
              value={currentSettings.referralBonusAmount}
              onChange={(e) => handleChange("referralBonusAmount", Number(e.target.value))}
              className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Min Withdrawal (coins)</label>
            <input
              type="number"
              value={currentSettings.minWithdrawalAmount}
              onChange={(e) => handleChange("minWithdrawalAmount", Number(e.target.value))}
              className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Max Withdrawal (coins)</label>
            <input
              type="number"
              value={currentSettings.maxWithdrawalAmount}
              onChange={(e) => handleChange("maxWithdrawalAmount", Number(e.target.value))}
              className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Bot className="w-3 h-3" /> Bot Username</label>
            <input
              type="text"
              value={currentSettings.botUsername}
              onChange={(e) => handleChange("botUsername", e.target.value)}
              className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="earnbot"
            />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="text-sm font-medium text-muted-foreground">Maintenance Mode</label>
            <button
              onClick={() => handleChange("maintenanceMode", !currentSettings.maintenanceMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${currentSettings.maintenanceMode ? "bg-destructive" : "bg-muted"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentSettings.maintenanceMode ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            {currentSettings.maintenanceMode && <span className="text-xs text-destructive font-medium">ON</span>}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-muted-foreground">Withdraw Methods (comma-separated)</label>
          <input
            type="text"
            value={currentSettings.withdrawMethods?.join(", ")}
            onChange={(e) => handleChange("withdrawMethods", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            className="mt-1 w-full border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="TON, USDT, BTC"
          />
        </div>

        <button
          onClick={() => saveSettings.mutate(currentSettings)}
          disabled={saveSettings.isPending || !form}
          className="mt-5 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Save className="w-4 h-4" />
          {saveSettings.isPending ? "Saving…" : "Save Settings"}
        </button>
      </div>

      {/* Force Join Channels */}
      <div className="bg-card border border-card-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Link className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Force Join Channels</h2>
          <span className="text-xs text-muted-foreground ml-1">— Users must join these to use the app</span>
        </div>

        {channelsLoading ? (
          <p className="text-muted-foreground text-sm">Loading channels…</p>
        ) : channels.length === 0 ? (
          <p className="text-muted-foreground text-sm">No force join channels configured.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between bg-muted rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{ch.channelName}</p>
                  <p className="text-xs text-muted-foreground">{ch.channelUrl}</p>
                </div>
                <button
                  onClick={() => removeChannel.mutate(ch.id)}
                  className="text-destructive hover:bg-destructive/10 rounded-lg p-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="border border-dashed border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add New Channel</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Channel ID (e.g. -1001234)"
              value={newChannel.channelId}
              onChange={(e) => setNewChannel((p) => ({ ...p, channelId: e.target.value }))}
              className="border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Channel Name"
              value={newChannel.channelName}
              onChange={(e) => setNewChannel((p) => ({ ...p, channelName: e.target.value }))}
              className="border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Invite URL (t.me/...)"
              value={newChannel.channelUrl}
              onChange={(e) => setNewChannel((p) => ({ ...p, channelUrl: e.target.value }))}
              className="border border-border rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => addChannel.mutate(newChannel)}
            disabled={!newChannel.channelId || !newChannel.channelName || !newChannel.channelUrl || addChannel.isPending}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            {addChannel.isPending ? "Adding…" : "Add Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}

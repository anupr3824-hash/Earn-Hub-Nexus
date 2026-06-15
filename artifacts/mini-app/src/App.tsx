import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import TasksPage from "@/pages/tasks";
import WalletPage from "@/pages/wallet";
import LeaderboardPage from "@/pages/leaderboard";
import ReferralsPage from "@/pages/referrals";
import BottomNav from "@/components/BottomNav";
import ForceJoinGate from "@/components/ForceJoinGate";
import { queryClient } from "@/lib/queryClient";
import { getTelegramUser } from "@/lib/telegram";

function Router() {
  const tgUser = getTelegramUser();
  const telegramId = tgUser?.id?.toString() ?? localStorage.getItem("tg_user_id") ?? "demo";

  return (
    <>
      <ForceJoinGate telegramId={telegramId}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/tasks" component={TasksPage} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/referrals" component={ReferralsPage} />
          <Route component={NotFound} />
        </Switch>
        <BottomNav />
      </ForceJoinGate>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

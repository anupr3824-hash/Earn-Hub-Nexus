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
import { queryClient } from "@/lib/queryClient";

function Router() {
  return (
    <>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/leaderboard" component={LeaderboardPage} />
        <Route path="/referrals" component={ReferralsPage} />
        <Route component={NotFound} />
      </Switch>
      <BottomNav />
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

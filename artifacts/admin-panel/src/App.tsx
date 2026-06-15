import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import TasksPage from "@/pages/tasks";
import WithdrawalsPage from "@/pages/withdrawals";
import BroadcastPage from "@/pages/broadcast";
import Layout from "@/components/Layout";
import { queryClient } from "@/lib/queryClient";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("admin_token");
  if (!token) {
    window.location.replace(import.meta.env.BASE_URL + "login");
    return null;
  }
  return <Layout>{children}</Layout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedLayout>
          <DashboardPage />
        </ProtectedLayout>
      </Route>
      <Route path="/users">
        <ProtectedLayout>
          <UsersPage />
        </ProtectedLayout>
      </Route>
      <Route path="/tasks">
        <ProtectedLayout>
          <TasksPage />
        </ProtectedLayout>
      </Route>
      <Route path="/withdrawals">
        <ProtectedLayout>
          <WithdrawalsPage />
        </ProtectedLayout>
      </Route>
      <Route path="/broadcast">
        <ProtectedLayout>
          <BroadcastPage />
        </ProtectedLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
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

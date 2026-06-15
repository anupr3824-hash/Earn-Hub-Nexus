import { useLocation, Link } from "wouter";
import { Home, CheckSquare, Wallet, Users, Trophy } from "lucide-react";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/tasks", icon: CheckSquare, label: "Tasks" },
  { path: "/wallet", icon: Wallet, label: "Wallet" },
  { path: "/referrals", icon: Users, label: "Referrals" },
  { path: "/leaderboard", icon: Trophy, label: "Leaders" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 pb-safe">
      <div className="flex items-center justify-around py-2">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location === path;
          return (
            <Link key={path} href={path}>
              <button className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
                <Icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>{label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

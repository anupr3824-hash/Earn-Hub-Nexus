import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (window.Telegram?.WebApp?.colorScheme === "dark" || !window.Telegram?.WebApp) {
  document.documentElement.classList.add("dark");
}

if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
}

createRoot(document.getElementById("root")!).render(<App />);

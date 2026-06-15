import app from "./app";
import { logger } from "./lib/logger";
import { initBot } from "./lib/bot";
import { getFirebaseApp } from "./lib/firebase";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const firebaseApp = getFirebaseApp();
if (!firebaseApp) {
  logger.warn(
    "Firebase not configured — API will return 503 for database operations. " +
    "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY secrets."
  );
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  initBot().catch((err) => logger.error({ err }, "Bot init failed"));
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — server continues");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — server continues");
});

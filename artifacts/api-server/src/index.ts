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

getFirebaseApp();

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  initBot().catch((err) => logger.error({ err }, "Bot init failed"));
});

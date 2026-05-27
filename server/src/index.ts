import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";

const server = app.listen(env.PORT, () => {
  console.log(`Auren Care API ouvindo em http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  console.log(`\nRecebido ${signal}, encerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

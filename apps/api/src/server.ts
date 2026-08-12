import { app } from "./app.js";
import { config } from "./config.js";

app.listen(config.port, () => {
  console.info(`ForgeSEO API listening on port ${config.port}`);
});

import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST ?? "0.0.0.0";

const server = createApp().listen(port, host, () => {
  console.log(`Items API listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

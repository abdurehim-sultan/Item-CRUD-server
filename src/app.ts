import path from "node:path";
import express, { type Express } from "express";
import { logger } from "./middleware/logger.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { itemsRouter } from "./routes/items.js";
import { HttpError } from "./errors.js";
import { ItemStore, type ItemInput } from "./store.js";

export interface AppOptions {
  store?: ItemStore;
  log?: (line: string) => void;
  seed?: boolean;
}

export const sampleItems: ItemInput[] = [
  { name: "Mechanical Keyboard", description: "75% layout, hot-swappable switches", price: 129 },
  { name: "Noise-Cancelling Headphones", description: "Over-ear, 30h battery life", price: 249.99 },
  { name: "USB-C Hub", description: "7-in-1 with HDMI and SD card reader", price: 39.5 },
];

export function createApp({ store = new ItemStore(), log, seed = false }: AppOptions = {}): Express {
  if (seed && store.list().length === 0) sampleItems.forEach((item) => store.create(item));

  const app = express();

  app.disable("x-powered-by");
  app.use(logger(log));
  app.use(express.static(path.join(process.cwd(), "public")));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/items", (req, _res, next) => {
    if ((req.method === "POST" || req.method === "PUT" || req.method === "PATCH") && !req.is("application/json")) {
      return next(new HttpError(415, "Content-Type must be application/json"));
    }
    next();
  });
  app.use("/items", itemsRouter(store));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp({ seed: true });

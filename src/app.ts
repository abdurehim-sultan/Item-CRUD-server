import express, { type Express } from "express";
import { logger } from "./middleware/logger.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { itemsRouter } from "./routes/items.js";
import { HttpError } from "./errors.js";
import { ItemStore } from "./store.js";

export interface AppOptions {
  store?: ItemStore;
  log?: (line: string) => void;
}

export function createApp({ store = new ItemStore(), log }: AppOptions = {}): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(logger(log));
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

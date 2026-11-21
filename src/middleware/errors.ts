import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../errors.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route ${req.method} ${req.originalUrl} not found`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  const status =
    err instanceof HttpError
      ? err.status
      : typeof err?.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500;

  if (status >= 500) console.error(err);

  const message =
    status === 500
      ? "Internal Server Error"
      : err?.type === "entity.parse.failed"
        ? "Malformed JSON in request body"
        : (err?.message ?? "Error");

  res.status(status).json({
    error: {
      status,
      message,
      ...(err instanceof HttpError && err.details !== undefined ? { details: err.details } : {}),
    },
  });
};

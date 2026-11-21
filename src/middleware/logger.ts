import type { RequestHandler } from "express";

export function logger(write: (line: string) => void = console.log): RequestHandler {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    let logged = false;

    const log = () => {
      if (logged) return;
      logged = true;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      write(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(2)}ms`);
    };

    res.on("finish", log);
    res.on("close", log);
    next();
  };
}

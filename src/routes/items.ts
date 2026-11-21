import { Router } from "express";
import { HttpError } from "../errors.js";
import type { ItemInput, ItemStore } from "../store.js";

const FIELDS = ["name", "description", "price"] as const;

function validate(body: unknown, partial: boolean): Partial<ItemInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  const input = body as Record<string, unknown>;
  const errors: string[] = [];

  const unknown = Object.keys(input).filter((k) => !(FIELDS as readonly string[]).includes(k));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(", ")}`);

  const result: Partial<ItemInput> = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim() === "") {
      errors.push("name must be a non-empty string");
    } else result.name = input.name.trim();
  } else if (!partial) errors.push("name is required");

  if (input.description !== undefined) {
    if (typeof input.description !== "string") errors.push("description must be a string");
    else result.description = input.description;
  } else if (!partial) result.description = "";

  if (input.price !== undefined) {
    if (typeof input.price !== "number" || !Number.isFinite(input.price) || input.price < 0) {
      errors.push("price must be a non-negative number");
    } else result.price = input.price;
  } else if (!partial) errors.push("price is required");

  if (partial && errors.length === 0 && Object.keys(result).length === 0) {
    errors.push(`Provide at least one of: ${FIELDS.join(", ")}`);
  }

  if (errors.length) throw new HttpError(422, "Validation failed", errors);
  return result;
}

export function itemsRouter(store: ItemStore): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.status(200).json(store.list());
  });

  router.get("/:id", (req, res) => {
    const item = store.get(req.params.id);
    if (!item) throw new HttpError(404, `Item ${req.params.id} not found`);
    res.status(200).json(item);
  });

  router.post("/", (req, res) => {
    const item = store.create(validate(req.body, false) as ItemInput);
    res.status(201).location(`${req.baseUrl}/${item.id}`).json(item);
  });

  // PUT replaces the whole resource, so every required field must be sent.
  router.put("/:id", (req, res) => {
    if (!store.get(req.params.id)) throw new HttpError(404, `Item ${req.params.id} not found`);
    const item = store.update(req.params.id, validate(req.body, false));
    res.status(200).json(item);
  });

  router.patch("/:id", (req, res) => {
    if (!store.get(req.params.id)) throw new HttpError(404, `Item ${req.params.id} not found`);
    const item = store.update(req.params.id, validate(req.body, true));
    res.status(200).json(item);
  });

  router.delete("/:id", (req, res) => {
    if (!store.delete(req.params.id)) throw new HttpError(404, `Item ${req.params.id} not found`);
    res.status(204).end();
  });

  return router;
}

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { ItemStore } from "../src/store.js";

const store = new ItemStore();
const logs: string[] = [];
let server: Server;
let base: string;

before(async () => {
  server = createApp({ store, log: (l) => logs.push(l) }).listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
  store.clear();
  logs.length = 0;
});

function req(method: string, path: string, body?: unknown, raw?: string) {
  return fetch(base + path, {
    method,
    headers: body !== undefined || raw !== undefined ? { "content-type": "application/json" } : {},
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
}

const widget = { name: "Widget", description: "A small widget", price: 9.99 };

describe("/items CRUD", () => {
  it("lists items (empty) with 200", async () => {
    const res = await req("GET", "/items");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  });

  it("creates an item with 201 and a Location header", async () => {
    const res = await req("POST", "/items", widget);
    assert.equal(res.status, 201);
    const item = await res.json();
    assert.equal(item.name, "Widget");
    assert.equal(res.headers.get("location"), `/items/${item.id}`);
  });

  it("gets, replaces, patches and deletes an item", async () => {
    const created = await (await req("POST", "/items", widget)).json();

    const got = await req("GET", `/items/${created.id}`);
    assert.equal(got.status, 200);

    const put = await req("PUT", `/items/${created.id}`, { name: "Gadget", price: 20 });
    assert.equal(put.status, 200);
    const replaced = await put.json();
    assert.equal(replaced.name, "Gadget");
    assert.equal(replaced.description, "");

    const patch = await req("PATCH", `/items/${created.id}`, { price: 15 });
    assert.equal(patch.status, 200);
    assert.equal((await patch.json()).price, 15);

    const del = await req("DELETE", `/items/${created.id}`);
    assert.equal(del.status, 204);
    assert.equal(await del.text(), "");

    assert.equal((await req("GET", `/items/${created.id}`)).status, 404);
    assert.equal((await req("DELETE", `/items/${created.id}`)).status, 404);
  });

  it("returns 404 for unknown ids on GET/PUT/PATCH/DELETE", async () => {
    for (const m of ["GET", "PUT", "PATCH", "DELETE"]) {
      const res = await req(m, "/items/nope", m === "PUT" || m === "PATCH" ? widget : undefined);
      assert.equal(res.status, 404, m);
    }
  });

  it("returns 422 for invalid bodies", async () => {
    const res = await req("POST", "/items", { name: "", price: -1, color: "red" });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error.details.length, 3);

    const created = await (await req("POST", "/items", widget)).json();
    assert.equal((await req("PATCH", `/items/${created.id}`, {})).status, 422);
    assert.equal((await req("PUT", `/items/${created.id}`, { name: "x" })).status, 422);
  });

  it("returns 400 for malformed JSON and non-object bodies", async () => {
    const bad = await req("POST", "/items", undefined, "{not json");
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.message, "Malformed JSON in request body");
    assert.equal((await req("POST", "/items", [1, 2])).status, 400);
  });

  it("returns 415 when Content-Type is not JSON", async () => {
    const res = await fetch(`${base}/items`, { method: "POST", body: "name=x" });
    assert.equal(res.status, 415);
  });
});

describe("web UI", () => {
  it("serves the dashboard at /", async () => {
    const res = await req("GET", "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await res.text(), /Items Studio/);
  });

  it("seeds sample items when asked", async () => {
    const seeded = new ItemStore();
    createApp({ store: seeded, seed: true });
    assert.equal(seeded.list().length, 3);
  });
});

describe("fallbacks and logging", () => {
  it("returns a JSON 404 for unknown routes", async () => {
    const res = await req("GET", "/does-not-exist");
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), {
      error: { status: 404, message: "Route GET /does-not-exist not found" },
    });
  });

  it("logs method, path, status and response time", async () => {
    await req("GET", "/items?x=1");
    await req("GET", "/missing");
    await new Promise((r) => setImmediate(r));
    assert.match(logs[0], /^GET \/items\?x=1 200 \d+\.\d{2}ms$/);
    assert.match(logs[1], /^GET \/missing 404 \d+\.\d{2}ms$/);
  });
});

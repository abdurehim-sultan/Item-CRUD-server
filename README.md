# Express Items API

A small REST API built with **Express 5** and **TypeScript**. It exposes full CRUD on `/items`, backed by an in-memory store (data resets on restart).

Features:

- `GET` / `POST` / `PUT` / `PATCH` / `DELETE` on `/items` with correct HTTP status codes
- Custom logger middleware that prints `METHOD path status time` for every request
- JSON 404 fallback for unknown routes and a central error handler
- Input validation (`422`), malformed JSON (`400`), wrong content type (`415`)

## Requirements

- Node.js 20 or newer

## Run locally

```bash
npm install
npm run dev        # watch mode with tsx
# or
npm run build && npm start
```

The server listens on `http://localhost:4317` by default. Override with `PORT` and `HOST`:

```bash
PORT=5000 npm run dev
```

Run the tests:

```bash
npm test
npm run typecheck
```

## Request logging

Every request is logged when the response finishes:

```
POST /items 201 3.12ms
GET /items 200 0.41ms
GET /items/abc 404 0.37ms
DELETE /items/2f1c... 204 0.29ms
```

## Data model

```json
{
  "id": "2f1c7b9e-4c2d-4c55-9a8e-2b8f6f2d1f0a",
  "name": "Widget",
  "description": "A small widget",
  "price": 9.99,
  "createdAt": "2026-11-21T17:45:00.000Z",
  "updatedAt": "2026-11-21T17:45:00.000Z"
}
```

| Field         | Type   | Rules                                         |
| ------------- | ------ | --------------------------------------------- |
| `name`        | string | required, non-empty                           |
| `description` | string | optional, defaults to `""`                    |
| `price`       | number | required, non-negative                        |

`id`, `createdAt` and `updatedAt` are set by the server. Unknown fields are rejected.

## Endpoints

The examples use `BASE=http://localhost:4317` and `ID` as an item id returned by `POST /items`.

### Health check: `GET /health`

Returns `200` with `{ "status": "ok" }`.

```bash
curl -i $BASE/health
```

```bash
http GET :4317/health
```

### List items: `GET /items`

Returns `200` with an array of items.

```bash
curl -i $BASE/items
```

```bash
http GET :4317/items
```

### Get one item: `GET /items/:id`

Returns `200` with the item, or `404` if it does not exist.

```bash
curl -i $BASE/items/$ID
```

```bash
http GET :4317/items/$ID
```

### Create an item: `POST /items`

Returns `201` with the new item and a `Location: /items/:id` header. Returns `422` for invalid fields, `400` for malformed JSON and `415` if the body is not `application/json`.

```bash
curl -i -X POST $BASE/items \
  -H 'Content-Type: application/json' \
  -d '{"name":"Widget","description":"A small widget","price":9.99}'
```

```bash
http POST :4317/items name=Widget description='A small widget' price:=9.99
```

### Replace an item: `PUT /items/:id`

Replaces the whole item, so `name` and `price` are required (`description` resets to `""` if omitted). Returns `200` with the updated item, `404` if missing, or `422` for invalid fields.

```bash
curl -i -X PUT $BASE/items/$ID \
  -H 'Content-Type: application/json' \
  -d '{"name":"Gadget","description":"Bigger","price":19.5}'
```

```bash
http PUT :4317/items/$ID name=Gadget description=Bigger price:=19.5
```

### Update part of an item: `PATCH /items/:id`

Updates only the fields you send (at least one is required). Returns `200` with the updated item, `404` if missing, or `422` for invalid fields.

```bash
curl -i -X PATCH $BASE/items/$ID \
  -H 'Content-Type: application/json' \
  -d '{"price":14.99}'
```

```bash
http PATCH :4317/items/$ID price:=14.99
```

### Delete an item: `DELETE /items/:id`

Returns `204` with an empty body, or `404` if it does not exist.

```bash
curl -i -X DELETE $BASE/items/$ID
```

```bash
http DELETE :4317/items/$ID
```

## Errors

All errors share one JSON shape:

```json
{
  "error": {
    "status": 422,
    "message": "Validation failed",
    "details": ["name is required", "price must be a non-negative number"]
  }
}
```

| Status | When                                                   |
| ------ | ------------------------------------------------------ |
| `400`  | Malformed JSON, or the body is not a JSON object       |
| `404`  | Unknown item id, or unknown route                      |
| `415`  | `POST`/`PUT`/`PATCH` without `Content-Type: application/json` |
| `422`  | Validation failed                                      |
| `500`  | Unexpected server error (details are logged, not returned) |

Unknown route example:

```bash
curl -i $BASE/nope
# HTTP/1.1 404 Not Found
# {"error":{"status":404,"message":"Route GET /nope not found"}}
```

```bash
http GET :4317/nope
```

## Project layout

```
src/
  app.ts                 # builds the Express app (middleware, routes, fallbacks)
  server.ts              # starts the HTTP server
  store.ts               # in-memory ItemStore
  errors.ts              # HttpError class
  routes/items.ts        # /items CRUD router and validation
  middleware/logger.ts   # request logger
  middleware/errors.ts   # 404 fallback and error handler
test/
  items.test.ts          # node:test integration tests
```

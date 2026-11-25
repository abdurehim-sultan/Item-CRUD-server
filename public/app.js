const $ = (sel) => document.querySelector(sel);

const els = {
  health: $("#health"),
  count: $("#stat-count"),
  total: $("#stat-total"),
  avg: $("#stat-avg"),
  latency: $("#stat-latency"),
  createForm: $("#create-form"),
  createErrors: $("#create-errors"),
  list: $("#items"),
  listState: $("#list-state"),
  search: $("#search"),
  sort: $("#sort"),
  refresh: $("#refresh"),
  log: $("#log"),
  logEmpty: $("#log-empty"),
  clearLog: $("#clear-log"),
  editDialog: $("#edit-dialog"),
  editForm: $("#edit-form"),
  editErrors: $("#edit-errors"),
  editCancel: $("#edit-cancel"),
  deleteDialog: $("#delete-dialog"),
  deleteName: $("#delete-name"),
  toasts: $("#toasts"),
  snippet: $("#curl-snippet"),
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const palette = [
  ["#7c5cff", "#5b8cff"],
  ["#22d3ee", "#0ea5e9"],
  ["#f472b6", "#a855f7"],
  ["#34d399", "#10b981"],
  ["#fbbf24", "#f97316"],
  ["#f87171", "#ec4899"],
];

let items = [];
let editingId = null;
let flashId = null;

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function api(method, path, body) {
  const start = performance.now();
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    logRequest(method, path, 0, performance.now() - start);
    throw new ApiError(0, "Network error: could not reach the API");
  }
  const ms = performance.now() - start;
  logRequest(method, path, res.status, ms);
  els.latency.textContent = `${Math.round(ms)} ms`;

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message ?? `Request failed (${res.status})`, data?.error?.details);
  }
  return data;
}

function logRequest(method, path, status, ms) {
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const parts = [
    ["time", time],
    [`method-tag ${method.toLowerCase()}`, method],
    ["path", path],
    [`code s${String(status)[0]}`, status || "ERR"],
    ["ms", `${ms.toFixed(1)}ms`],
  ];
  for (const [cls, text] of parts) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    li.append(span);
  }
  els.log.prepend(li);
  while (els.log.children.length > 50) els.log.lastChild.remove();
  els.logEmpty.hidden = true;
}

function toast(message, type = "success") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", "status");
  el.innerHTML =
    type === "success"
      ? '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>';
  const text = document.createElement("span");
  text.textContent = message;
  el.append(text);
  els.toasts.append(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

function showErrors(listEl, form, err) {
  const messages = Array.isArray(err.details) && err.details.length ? err.details : [err.message];
  listEl.replaceChildren(
    ...messages.map((m) => {
      const li = document.createElement("li");
      li.textContent = m;
      return li;
    }),
  );
  listEl.hidden = false;
  for (const name of ["name", "description", "price"]) {
    const input = form.elements[name];
    input.setAttribute("aria-invalid", String(messages.some((m) => m.startsWith(name))));
  }
}

function clearErrors(listEl, form) {
  listEl.hidden = true;
  listEl.replaceChildren();
  for (const input of form.querySelectorAll("[aria-invalid]")) input.removeAttribute("aria-invalid");
}

function readForm(form, { partialFrom } = {}) {
  const name = form.elements.name.value.trim();
  const description = form.elements.description.value;
  const priceRaw = form.elements.price.value.trim();
  const price = priceRaw === "" ? undefined : Number(priceRaw);

  if (!partialFrom) {
    const body = { name, description };
    if (price !== undefined) body.price = price;
    return body;
  }

  const changes = {};
  if (name !== partialFrom.name) changes.name = name;
  if (description !== partialFrom.description) changes.description = description;
  if (price !== partialFrom.price) changes.price = price === undefined ? null : price;
  return changes;
}

function setBusy(form, busy) {
  for (const btn of form.querySelectorAll("button")) btn.disabled = busy;
}

function avatarFor(item) {
  const hash = [...item.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const [a, b] = palette[hash % palette.length];
  const el = document.createElement("div");
  el.className = "avatar";
  el.style.background = `linear-gradient(135deg, ${a}, ${b})`;
  el.textContent = item.name.trim().charAt(0).toUpperCase() || "?";
  return el;
}

function iconButton(label, cls, path) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn btn-ghost ${cls}`;
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`;
  return btn;
}

function relativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function visibleItems() {
  const q = els.search.value.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    : [...items];
  const sorters = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    "price-desc": (a, b) => b.price - a.price,
    "price-asc": (a, b) => a.price - b.price,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return filtered.sort(sorters[els.sort.value]);
}

function renderStats() {
  const total = items.reduce((sum, i) => sum + i.price, 0);
  els.count.textContent = String(items.length);
  els.total.textContent = money.format(total);
  els.avg.textContent = items.length ? money.format(total / items.length) : money.format(0);
}

function renderEmpty({ error = false, title, text, action }) {
  const box = document.createElement("div");
  box.className = `empty${error ? " error" : ""}`;
  box.innerHTML = error
    ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>';
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("span");
  p.textContent = text;
  box.append(strong, p);
  if (action) box.append(action);
  els.listState.replaceChildren(box);
  els.listState.hidden = false;
  els.list.hidden = true;
}

function renderList() {
  renderStats();
  const list = visibleItems();

  if (items.length === 0) {
    return renderEmpty({ title: "No items yet", text: "Create your first item with the form to see it appear here." });
  }
  if (list.length === 0) {
    return renderEmpty({ title: "No matches", text: `Nothing matches “${els.search.value.trim()}”.` });
  }

  els.listState.hidden = true;
  els.list.hidden = false;
  els.list.replaceChildren(
    ...list.map((item) => {
      const li = document.createElement("li");
      li.className = `item${item.id === flashId ? " flash" : ""}`;

      const body = document.createElement("div");
      body.className = "item-body";
      const name = document.createElement("div");
      name.className = "item-name";
      name.textContent = item.name;
      const desc = document.createElement("div");
      desc.className = "item-desc";
      desc.textContent = item.description || "No description";
      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = `${item.id.slice(0, 8)} · updated ${relativeTime(item.updatedAt)}`;
      body.append(name, desc, meta);

      const price = document.createElement("div");
      price.className = "price";
      price.textContent = money.format(item.price);

      const actions = document.createElement("div");
      actions.className = "item-actions";
      const edit = iconButton("Edit item", "edit", "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4");
      edit.addEventListener("click", () => openEdit(item));
      const del = iconButton("Delete item", "delete", "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3");
      del.addEventListener("click", () => confirmDelete(item));
      actions.append(edit, del);

      li.append(avatarFor(item), body, price, actions);
      return li;
    }),
  );
  flashId = null;
}

async function loadItems({ quiet = false } = {}) {
  if (!quiet) {
    els.listState.dataset.state = "loading";
    els.listState.replaceChildren(...Array.from({ length: 3 }, () => Object.assign(document.createElement("div"), { className: "skeleton" })));
    els.listState.hidden = false;
    els.list.hidden = true;
  }
  els.refresh.disabled = true;
  try {
    items = await api("GET", "/items");
    renderList();
  } catch (err) {
    const retry = document.createElement("button");
    retry.className = "btn btn-ghost btn-sm";
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => loadItems());
    renderEmpty({ error: true, title: "Couldn’t load items", text: err.message, action: retry });
  } finally {
    els.refresh.disabled = false;
  }
}

async function checkHealth() {
  const label = els.health.querySelector(".label");
  try {
    const res = await fetch("/health");
    if (!res.ok) throw new Error();
    els.health.dataset.state = "up";
    label.textContent = "API online";
  } catch {
    els.health.dataset.state = "down";
    label.textContent = "API offline";
  }
}

els.createForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErrors(els.createErrors, els.createForm);
  setBusy(els.createForm, true);
  try {
    const item = await api("POST", "/items", readForm(els.createForm));
    items.push(item);
    flashId = item.id;
    els.createForm.reset();
    els.search.value = "";
    renderList();
    toast(`Created “${item.name}”`);
    els.createForm.elements.name.focus();
  } catch (err) {
    showErrors(els.createErrors, els.createForm, err);
    toast(err.message, "error");
  } finally {
    setBusy(els.createForm, false);
  }
});

function openEdit(item) {
  editingId = item.id;
  clearErrors(els.editErrors, els.editForm);
  els.editForm.elements.name.value = item.name;
  els.editForm.elements.description.value = item.description;
  els.editForm.elements.price.value = String(item.price);
  els.editDialog.showModal();
}

els.editCancel.addEventListener("click", () => els.editDialog.close());

els.editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const current = items.find((i) => i.id === editingId);
  if (!current) return els.editDialog.close();

  const changes = readForm(els.editForm, { partialFrom: current });
  if (Object.keys(changes).length === 0) {
    els.editDialog.close();
    return toast("No changes to save");
  }

  clearErrors(els.editErrors, els.editForm);
  setBusy(els.editForm, true);
  try {
    const updated = await api("PATCH", `/items/${current.id}`, changes);
    items = items.map((i) => (i.id === updated.id ? updated : i));
    flashId = updated.id;
    els.editDialog.close();
    renderList();
    toast(`Updated “${updated.name}”`);
  } catch (err) {
    if (err.status === 404) {
      els.editDialog.close();
      toast("That item no longer exists", "error");
      return loadItems({ quiet: true });
    }
    showErrors(els.editErrors, els.editForm, err);
  } finally {
    setBusy(els.editForm, false);
  }
});

function confirmDelete(item) {
  els.deleteName.textContent = `“${item.name}” will be permanently removed.`;
  els.deleteDialog.returnValue = "";
  els.deleteDialog.showModal();
  els.deleteDialog.addEventListener(
    "close",
    async () => {
      if (els.deleteDialog.returnValue !== "confirm") return;
      try {
        await api("DELETE", `/items/${item.id}`);
        items = items.filter((i) => i.id !== item.id);
        renderList();
        toast(`Deleted “${item.name}”`);
      } catch (err) {
        toast(err.message, "error");
        if (err.status === 404) loadItems({ quiet: true });
      }
    },
    { once: true },
  );
}

els.search.addEventListener("input", renderList);
els.sort.addEventListener("change", renderList);
els.refresh.addEventListener("click", () => loadItems({ quiet: true }));
els.clearLog.addEventListener("click", () => {
  els.log.replaceChildren();
  els.logEmpty.hidden = false;
});

els.snippet.textContent = `curl -X POST ${location.origin}/items \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name":"Widget","price":9.99}'`;

checkHealth();
loadItems();

import { randomUUID } from "node:crypto";

export interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export type ItemInput = Pick<Item, "name" | "description" | "price">;

export class ItemStore {
  private items = new Map<string, Item>();

  list(): Item[] {
    return [...this.items.values()];
  }

  get(id: string): Item | undefined {
    return this.items.get(id);
  }

  create(input: ItemInput): Item {
    const now = new Date().toISOString();
    const item: Item = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
    this.items.set(item.id, item);
    return item;
  }

  update(id: string, changes: Partial<ItemInput>): Item | undefined {
    const existing = this.items.get(id);
    if (!existing) return undefined;
    const updated: Item = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    this.items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  clear(): void {
    this.items.clear();
  }
}

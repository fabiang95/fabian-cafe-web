import type { MenuItem, SelectedAddon } from "./api";

export type CartLine = {
  key: string;
  menuItemId: string;
  /** Number of bowls on this line. */
  quantity: number;
  addons: SelectedAddon[];
};

export type NewCartItem = Omit<CartLine, "key">;

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Drops unselected add-ons and sorts by ID so order never matters. */
function normalizeAddons(addons: SelectedAddon[]): SelectedAddon[] {
  return addons
    .filter((addon) => addon.quantity > 0)
    .map((addon) => ({ ...addon }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Two configurations share a key only if every add-on quantity matches. */
export function mergeKey(
  menuItemId: string,
  addons: SelectedAddon[],
): string {
  const parts = normalizeAddons(addons).map(
    (addon) => `${addon.id}:${addon.quantity}`,
  );
  return `${menuItemId}|${parts.join(",")}`;
}

export function addToCart(cart: CartLine[], item: NewCartItem): CartLine[] {
  if (!isPositiveInteger(item.quantity)) return cart;

  const key = mergeKey(item.menuItemId, item.addons);
  const exists = cart.some((line) => line.key === key);

  if (exists) {
    return cart.map((line) =>
      line.key === key
        ? { ...line, quantity: line.quantity + item.quantity }
        : line,
    );
  }

  return [
    ...cart,
    {
      key,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      addons: normalizeAddons(item.addons),
    },
  ];
}

export function setLineQuantity(
  cart: CartLine[],
  key: string,
  quantity: number,
): CartLine[] {
  if (!isPositiveInteger(quantity)) return cart;

  return cart.map((line) => (line.key === key ? { ...line, quantity } : line));
}

export function removeLine(cart: CartLine[], key: string): CartLine[] {
  return cart.filter((line) => line.key !== key);
}

/** Changing add-ons changes the key, so the line may merge into another. */
export function editLineAddons(
  cart: CartLine[],
  key: string,
  addons: SelectedAddon[],
): CartLine[] {
  const line = cart.find((candidate) => candidate.key === key);
  if (!line) return cart;

  const newKey = mergeKey(line.menuItemId, addons);
  if (newKey === key) return cart;

  const target = cart.find((candidate) => candidate.key === newKey);
  if (target) {
    return removeLine(cart, key).map((candidate) =>
      candidate.key === newKey
        ? { ...candidate, quantity: candidate.quantity + line.quantity }
        : candidate,
    );
  }

  return cart.map((candidate) =>
    candidate.key === key
      ? { ...candidate, key: newKey, addons: normalizeAddons(addons) }
      : candidate,
  );
}

/** For display only: the backend calculates the authoritative total. */
export function lineTotalCents(line: CartLine, menuItem: MenuItem): number {
  const addonsCents = line.addons.reduce((sum, selected) => {
    const addon = menuItem.addons.find((a) => a.id === selected.id);
    if (!addon) {
      throw new Error(`Unknown add-on: ${selected.id}`);
    }
    return sum + addon.priceCents * selected.quantity;
  }, 0);

  return (menuItem.basePriceCents + addonsCents) * line.quantity;
}

export function cartTotalCents(cart: CartLine[], menu: MenuItem[]): number {
  return cart.reduce((sum, line) => {
    const menuItem = menu.find((item) => item.id === line.menuItemId);
    if (!menuItem) {
      throw new Error(`Unknown menu item: ${line.menuItemId}`);
    }
    return sum + lineTotalCents(line, menuItem);
  }, 0);
}

export function totalBowls(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

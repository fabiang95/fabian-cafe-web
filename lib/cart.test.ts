import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartTotalCents,
  editLineAddons,
  lineTotalCents,
  mergeKey,
  removeLine,
  setLineQuantity,
  totalBowls,
  type CartLine,
} from "./cart";
import type { MenuItem } from "./api";

const BOWL = "pork-rice-bowl";

// Placeholder prices, for tests only.
const menu: MenuItem[] = [
  {
    id: BOWL,
    name: "Pork Rice Bowl",
    basePriceCents: 1200,
    addons: [
      { id: "onsen-egg", name: "Onsen Egg", priceCents: 200 },
      { id: "vegetables", name: "Vegetables", priceCents: 150 },
    ],
  },
];

const twoEggs = [{ id: "onsen-egg", quantity: 2 }];
const threeEggs = [{ id: "onsen-egg", quantity: 3 }];

describe("mergeKey", () => {
  it("ignores add-on order", () => {
    const first = [
      { id: "vegetables", quantity: 1 },
      { id: "onsen-egg", quantity: 2 },
    ];
    const second = [
      { id: "onsen-egg", quantity: 2 },
      { id: "vegetables", quantity: 1 },
    ];

    expect(mergeKey(BOWL, first)).toBe(mergeKey(BOWL, second));
  });

  it("differs when an add-on quantity differs", () => {
    expect(mergeKey(BOWL, twoEggs)).not.toBe(mergeKey(BOWL, threeEggs));
  });

  it("differs when an add-on is missing", () => {
    const withVegetables = [...twoEggs, { id: "vegetables", quantity: 1 }];

    expect(mergeKey(BOWL, twoEggs)).not.toBe(mergeKey(BOWL, withVegetables));
  });

  it("treats a quantity of 0 as not selected", () => {
    const withZero = [...twoEggs, { id: "vegetables", quantity: 0 }];

    expect(mergeKey(BOWL, withZero)).toBe(mergeKey(BOWL, twoEggs));
  });

  it("does not confuse IDs that run into their quantities", () => {
    expect(mergeKey(BOWL, [{ id: "egg", quantity: 12 }])).not.toBe(
      mergeKey(BOWL, [{ id: "egg1", quantity: 2 }]),
    );
  });
});

describe("addToCart", () => {
  it("merges identical configurations", () => {
    const cart = addToCart([], { menuItemId: BOWL, quantity: 2, addons: twoEggs });
    const merged = addToCart(cart, {
      menuItemId: BOWL,
      quantity: 1,
      addons: twoEggs,
    });

    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(3);
  });

  it("keeps different add-on quantities on separate lines", () => {
    const cart = addToCart([], { menuItemId: BOWL, quantity: 1, addons: twoEggs });
    const result = addToCart(cart, {
      menuItemId: BOWL,
      quantity: 1,
      addons: threeEggs,
    });

    expect(result).toHaveLength(2);
  });

  it("returns a new cart and leaves the original untouched", () => {
    const cart = addToCart([], { menuItemId: BOWL, quantity: 1, addons: twoEggs });
    const result = addToCart(cart, {
      menuItemId: BOWL,
      quantity: 1,
      addons: twoEggs,
    });

    expect(result).not.toBe(cart);
    expect(result[0]).not.toBe(cart[0]);
    expect(cart[0].quantity).toBe(1);
  });

  it("ignores a bowl quantity below 1", () => {
    const result = addToCart([], {
      menuItemId: BOWL,
      quantity: 0,
      addons: twoEggs,
    });

    expect(result).toEqual([]);
  });
});

describe("changing lines", () => {
  const cart: CartLine[] = addToCart(
    addToCart([], { menuItemId: BOWL, quantity: 1, addons: twoEggs }),
    { menuItemId: BOWL, quantity: 4, addons: threeEggs },
  );
  const [twoEggLine, threeEggLine] = cart;

  it("sets a line's bowl quantity", () => {
    const result = setLineQuantity(cart, twoEggLine.key, 5);

    expect(result[0].quantity).toBe(5);
    expect(result[1]).toBe(threeEggLine);
  });

  it("ignores an invalid bowl quantity", () => {
    expect(setLineQuantity(cart, twoEggLine.key, 0)).toBe(cart);
  });

  it("removes a line", () => {
    expect(removeLine(cart, twoEggLine.key)).toEqual([threeEggLine]);
  });

  it("rebuilds the key when add-ons are edited", () => {
    const result = editLineAddons(cart, twoEggLine.key, [
      { id: "vegetables", quantity: 1 },
    ]);

    expect(result[0].key).toBe(mergeKey(BOWL, [{ id: "vegetables", quantity: 1 }]));
    expect(result).toHaveLength(2);
  });

  it("merges when an edit makes two lines identical", () => {
    const result = editLineAddons(cart, twoEggLine.key, threeEggs);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe(threeEggLine.key);
    expect(result[0].quantity).toBe(5);
  });
});

describe("totals", () => {
  it("multiplies add-on quantities per bowl", () => {
    const [line] = addToCart([], {
      menuItemId: BOWL,
      quantity: 3,
      addons: [...twoEggs, { id: "vegetables", quantity: 1 }],
    });

    // (1200 + 200 × 2 + 150 × 1) × 3
    expect(lineTotalCents(line, menu[0])).toBe(5250);
  });

  it("adds up every line and counts bowls", () => {
    const cart = addToCart(
      addToCart([], { menuItemId: BOWL, quantity: 2, addons: twoEggs }),
      { menuItemId: BOWL, quantity: 1, addons: [] },
    );

    expect(cartTotalCents(cart, menu)).toBe(4400);
    expect(totalBowls(cart)).toBe(3);
  });

  it("fails loudly on an add-on missing from the menu", () => {
    const [line] = addToCart([], {
      menuItemId: BOWL,
      quantity: 1,
      addons: [{ id: "unknown", quantity: 1 }],
    });

    expect(() => lineTotalCents(line, menu[0])).toThrow("Unknown add-on");
  });
});

import { describe, expect, it } from "vitest";
import {
  ApiError,
  createOrder,
  getCafeDates,
  getMenu,
  getOrder,
  type OrderSubmission,
} from "./api";

async function firstOpenDate(): Promise<string> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
  }).format(new Date());
  const thisMonth = today.slice(0, 7);
  const [year, month] = thisMonth.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);

  const dates = [
    ...(await getCafeDates(thisMonth)),
    ...(await getCafeDates(nextMonth)),
  ];
  return dates[0].date;
}

async function submission(
  overrides: Partial<OrderSubmission> = {},
): Promise<OrderSubmission> {
  return {
    cafeDate: await firstOpenDate(),
    customer: { phone: "+6591234567", name: null, email: null },
    items: [
      {
        menuItemId: "pork-rice-bowl",
        quantity: 2,
        addons: [{ id: "onsen-egg", quantity: 2 }],
      },
    ],
    ...overrides,
  };
}

describe("getCafeDates", () => {
  it("returns only available dates within the month", async () => {
    const date = await firstOpenDate();
    const dates = await getCafeDates(date.slice(0, 7));

    expect(dates.length).toBeGreaterThan(0);
    for (const d of dates) {
      expect(d.date.startsWith(date.slice(0, 7))).toBe(true);
      expect(d.status).toBe("AVAILABLE");
    }
  });

  it("rejects a malformed month", async () => {
    await expect(getCafeDates("2026-13")).rejects.toBeInstanceOf(ApiError);
    await expect(getCafeDates("2026-13")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("getMenu", () => {
  it("serves the menu for an open date", async () => {
    const menu = await getMenu(await firstOpenDate());

    expect(menu[0].id).toBe("pork-rice-bowl");
  });

  it("rejects a date the café is closed", async () => {
    await expect(getMenu("2000-01-01")).rejects.toMatchObject({
      code: "DATE_UNAVAILABLE",
    });
  });
});

describe("createOrder", () => {
  it("prices per-bowl add-on quantities on the backend side", async () => {
    const order = await createOrder(await submission());

    // (1200 + 200 × 2) × 2, placeholder prices
    expect(order.totalCents).toBe(3200);
    expect(order.status).toBe("PENDING_PAYMENT");
  });

  it("rejects an unknown add-on", async () => {
    const bad = await submission({
      items: [
        {
          menuItemId: "pork-rice-bowl",
          quantity: 1,
          addons: [{ id: "truffle", quantity: 1 }],
        },
      ],
    });

    await expect(createOrder(bad)).rejects.toMatchObject({
      code: "INVALID_ORDER",
    });
  });

  it("rejects a phone that is not E.164", async () => {
    const bad = await submission({
      customer: { phone: "91234567", name: null, email: null },
    });

    await expect(createOrder(bad)).rejects.toMatchObject({
      code: "INVALID_ORDER",
    });
  });
});

describe("getOrder", () => {
  it("finds an order by access token without personal details", async () => {
    const created = await createOrder(
      await submission({
        customer: { phone: "+6591234567", name: "Ann", email: "a@b.co" },
      }),
    );
    const order = await getOrder(created.accessToken);

    expect(order.orderReference).toBe(created.orderReference);
    expect(JSON.stringify(order)).not.toMatch(/6591234567|Ann|a@b\.co/);
    expect(order).not.toHaveProperty("accessToken");
  });

  it("does not find an order by its short reference", async () => {
    const created = await createOrder(await submission());

    await expect(getOrder(created.orderReference)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

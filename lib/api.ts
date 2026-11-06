/**
 * The only module that talks to the backend.
 *
 * Until `fabian-cafe-backend` exists, every function here is served by an
 * in-memory fake. Pages and components call these functions and must never
 * know (or care) whether the data is real. Swapping in real `fetch` calls
 * should change this file only.
 *
 * Types follow the spec's data contracts (sections 5 and 6), except add-ons:
 * per AGENTS.md each selected add-on carries its own per-bowl quantity.
 */

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD`, a calendar date in Asia/Singapore. */
export type IsoDate = string;

/**
 * Only operating dates are returned. Statuses like sold out depend on
 * capacity limits, which are an open decision (spec section 10.5).
 */
export type CafeDateStatus = "AVAILABLE";

export type CafeDate = {
  date: IsoDate;
  status: CafeDateStatus;
};

export type Addon = {
  id: string;
  name: string;
  priceCents: number;
};

export type MenuItem = {
  id: string;
  name: string;
  basePriceCents: number;
  addons: Addon[];
};

export type SelectedAddon = {
  id: string;
  /** Per bowl: 2 means every bowl on the line gets two. Never 0; omit instead. */
  quantity: number;
};

export type OrderItem = {
  menuItemId: string;
  /** Number of bowls. */
  quantity: number;
  addons: SelectedAddon[];
};

export type OrderSubmission = {
  cafeDate: IsoDate;
  customer: {
    /** E.164, e.g. `+6591234567`. */
    phone: string;
    name: string | null;
    email: string | null;
  };
  /** No prices or totals: the backend calculates them. */
  items: OrderItem[];
};

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "CANCELLED"
  | "FULFILLED";

/**
 * What the payment page may show. Deliberately has no phone, name or email,
 * so a leaked link exposes no personal details.
 * The payment QR is not here yet: its format is open decision 3.
 */
export type OrderSummary = {
  /** Short, human-friendly reference to quote when paying. Not a secret. */
  orderReference: string;
  cafeDate: IsoDate;
  status: OrderStatus;
  /** Calculated by the backend. The only total to trust. */
  totalCents: number;
};

export type CreatedOrder = OrderSummary & {
  /** Long random token for the payment page URL. Unguessable, unlike the reference. */
  accessToken: string;
};

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "DATE_UNAVAILABLE"
  | "INVALID_ORDER"
  | "NETWORK";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Public API (GET /api/cafe-dates, GET /api/cafe-dates/{date}/menu,
// POST /api/orders, GET /api/orders/{token})
// ---------------------------------------------------------------------------

/** Operating dates in a month (`YYYY-MM`), from today onwards. */
export async function getCafeDates(month: string): Promise<CafeDate[]> {
  await simulateLatency();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ApiError(400, "BAD_REQUEST", `Invalid month: ${month}`);
  }

  return fakeOperatingDates()
    .filter((date) => date.startsWith(month))
    .map((date) => ({ date, status: "AVAILABLE" }));
}

export async function getMenu(date: IsoDate): Promise<MenuItem[]> {
  await simulateLatency();
  assertOperatingDate(date);
  return structuredClone(FAKE_MENU);
}

export async function createOrder(
  submission: OrderSubmission,
): Promise<CreatedOrder> {
  await simulateLatency();
  assertOperatingDate(submission.cafeDate);
  validateCustomer(submission.customer);

  // Like the real backend: reprice from its own menu, ignore the client.
  const totalCents = priceItems(submission.items);
  const order: CreatedOrder = {
    orderReference: `LB-${randomHex(3).toUpperCase()}`,
    accessToken: randomHex(32),
    cafeDate: submission.cafeDate,
    status: "PENDING_PAYMENT",
    totalCents,
  };

  fakeOrders.set(order.accessToken, order);
  return { ...order };
}

/** Looks an order up by its access token, never by its reference. */
export async function getOrder(accessToken: string): Promise<OrderSummary> {
  await simulateLatency();
  const order = fakeOrders.get(accessToken);
  if (!order) {
    throw new ApiError(404, "NOT_FOUND", "Order not found");
  }

  // Allowlist the fields, so a field added to orders later can't leak here.
  return {
    orderReference: order.orderReference,
    cafeDate: order.cafeDate,
    status: order.status,
    totalCents: order.totalCents,
  };
}

// ---------------------------------------------------------------------------
// Fake backend. Private to this module; replace with fetch calls later.
// ---------------------------------------------------------------------------

const TIME_ZONE = "Asia/Singapore";
const LATENCY_MS = process.env.NODE_ENV === "test" ? 0 : 300;

// Placeholder prices (spec section 10.2: real prices not decided).
const FAKE_MENU: MenuItem[] = [
  {
    id: "pork-rice-bowl",
    name: "Pork Rice Bowl",
    basePriceCents: 1200,
    addons: [
      { id: "onsen-egg", name: "Onsen Egg", priceCents: 200 },
      { id: "vegetables", name: "Vegetables", priceCents: 150 },
    ],
  },
];

/** In memory only: fake orders are lost when the page reloads. */
const fakeOrders = new Map<string, CreatedOrder>();

function simulateLatency(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

/** Today's date in Singapore, regardless of the browser's time zone. */
function todayInSingapore(): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(),
  );
}

/** Fake schedule: the next eight Saturdays, so the calendar never goes stale. */
function fakeOperatingDates(): IsoDate[] {
  // Treat the date as UTC midnight so adding days never hits DST or offsets.
  const cursor = new Date(`${todayInSingapore()}T00:00:00Z`);
  const dates: IsoDate[] = [];

  while (dates.length < 8) {
    if (cursor.getUTCDay() === 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function assertOperatingDate(date: IsoDate): void {
  if (!fakeOperatingDates().includes(date)) {
    throw new ApiError(409, "DATE_UNAVAILABLE", `Not open on ${date}`);
  }
}

function validateCustomer(customer: OrderSubmission["customer"]): void {
  if (!/^\+[1-9]\d{6,14}$/.test(customer.phone)) {
    throw new ApiError(422, "INVALID_ORDER", "Phone must be in E.164 format");
  }
  if (customer.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new ApiError(422, "INVALID_ORDER", "Invalid email");
  }
}

function priceItems(items: OrderItem[]): number {
  if (items.length === 0) {
    throw new ApiError(422, "INVALID_ORDER", "Order has no items");
  }

  return items.reduce((total, item) => {
    const menuItem = FAKE_MENU.find((m) => m.id === item.menuItemId);
    if (!menuItem || !isPositiveInteger(item.quantity)) {
      throw new ApiError(422, "INVALID_ORDER", "Invalid order item");
    }

    const addonsCents = item.addons.reduce((sum, selected) => {
      const addon = menuItem.addons.find((a) => a.id === selected.id);
      if (!addon || !isPositiveInteger(selected.quantity)) {
        throw new ApiError(422, "INVALID_ORDER", "Invalid add-on");
      }
      return sum + addon.priceCents * selected.quantity;
    }, 0);

    return total + (menuItem.basePriceCents + addonsCents) * item.quantity;
  }, 0);
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (b) => b.toString(16).padStart(2, "0")).join("");
}

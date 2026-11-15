import { describe, expect, expectTypeOf, it } from "vitest";
import {
  centsSchema,
  compareIdempotencyHashes,
  createOrderInputSchema,
  decodeCents,
  isoDateSchema,
  pageRequestSchema,
  productIdSchema,
} from "@/features/data-contracts/foundation";
import type {
  AdminProduct,
  Cents,
  CategoryId,
  CreateOrderInput,
  FinancialOrder,
  ProductId,
  PublicProduct,
  PublicStoreSettings,
  Result,
} from "@/features/data-contracts/foundation";
import type {
  SaveProductInput,
  AdminOrderRepository,
} from "@/features/data-contracts/backend-repositories";
import type { ProductRepository, OrderRepository } from "@/features/data-contracts/repositories";

const id = "00000000-0000-4000-8000-000000000001";
const validOrder = {
  operationKey: id,
  items: [{ productId: id, variantId: id, quantity: 1 }],
  customer: { name: "Synthetic", phoneE164: "+5521999999999" },
  notes: "",
  privacyNoticeVersion: "test-only",
};

describe("CR-007B backend wire contracts (no adapter/network)", () => {
  it.each([0, 1, 900, Number.MAX_SAFE_INTEGER])("accepts integer cents %s", (value) => {
    expect(centsSchema.parse(value)).toBe(value);
  });
  it.each([-1, 1.1, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    "rejects unsafe cents %s",
    (value) => {
      expect(centsSchema.safeParse(value).success).toBe(false);
    },
  );
  it.each(["-1", "1.0", "01", "1e3", "9007199254740992", "", "NaN"])(
    "rejects unsafe decimal cents %s",
    (value) => {
      expect(() => decodeCents(value)).toThrow();
    },
  );
  it("decodes exact integer cents", () => {
    expect(decodeCents("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
    expect(decodeCents("0")).toBe(0);
    expectTypeOf(decodeCents("1")).toEqualTypeOf<Cents>();
  });
  it("distinguishes entity brands", () => {
    expect(productIdSchema.parse(id)).toBe(id);
    expectTypeOf<ProductId>().not.toEqualTypeOf<CategoryId>();
    expect(productIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
  it("bounds pagination and supplies default", () => {
    expect(pageRequestSchema.parse({})).toEqual({ limit: 25 });
    expect(pageRequestSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(pageRequestSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(pageRequestSchema.safeParse({ cursor: "" }).success).toBe(false);
    expect(pageRequestSchema.safeParse({ sortSql: "DROP TABLE" }).success).toBe(false);
  });
  it("requires ISO dates with timezone", () => {
    expect(isoDateSchema.safeParse("2026-11-13T12:00:00-03:00").success).toBe(true);
    expect(isoDateSchema.safeParse("yesterday").success).toBe(false);
  });
  it("accepts creation with IDs and quantity, no client price", () => {
    const input = createOrderInputSchema.parse(validOrder);
    expect(input.items[0]?.quantity).toBe(1);
    expectTypeOf(input).toEqualTypeOf<CreateOrderInput>();
  });
  it.each(["unitPriceCents", "totalCents", "actorId", "status"])(
    "rejects caller-injected %s",
    (field) => {
      expect(createOrderInputSchema.safeParse({ ...validOrder, [field]: 1 }).success).toBe(false);
    },
  );
  it("rejects nested prices, empty cart and invalid contact", () => {
    expect(
      createOrderInputSchema.safeParse({
        ...validOrder,
        items: [{ ...validOrder.items[0], price: 1 }],
      }).success,
    ).toBe(false);
    expect(createOrderInputSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
    expect(
      createOrderInputSchema.safeParse({
        ...validOrder,
        customer: { name: "Test", phoneE164: "2199" },
      }).success,
    ).toBe(false);
  });
  it("same key payload hash replays; different payload conflicts", () => {
    expect(compareIdempotencyHashes("a".repeat(64), "a".repeat(64))).toBe("replay");
    expect(compareIdempotencyHashes("a".repeat(64), "b".repeat(64))).toBe("conflict");
    expect(() => compareIdempotencyHashes("PII", "bad")).toThrow("Invalid SHA-256 digest");
  });
  it("public projections exclude administrative and private fields", () => {
    expectTypeOf<
      Extract<keyof PublicProduct, "internalNotes" | "active" | "archivedAt">
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof PublicStoreSettings, "privacyNoticeVersion" | "version">
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<keyof FinancialOrder, "customerPhoneSnapshot" | "notes">
    >().toEqualTypeOf<never>();
    expectTypeOf<AdminProduct["internalNotes"]>().toEqualTypeOf<string>();
    expectTypeOf<Extract<keyof SaveProductInput, "effectivePriceCents">>().toEqualTypeOf<never>();
  });
  it("retains legacy repositories without replacing LocalStorage", () => {
    expectTypeOf<ProductRepository["listPublic"]>().returns.toEqualTypeOf<
      Promise<import("@/shared/types/catalog").Product[]>
    >();
    expectTypeOf<OrderRepository["get"]>().parameter(0).toBeString();
    expectTypeOf<AdminOrderRepository["create"]>().parameter(0).toEqualTypeOf<CreateOrderInput>();
  });
  it("uses a discriminated result with safe error metadata", () => {
    const failure: Result<PublicProduct> = {
      ok: false,
      error: {
        code: "FORBIDDEN",
        messageKey: "access.denied",
        requestId: "synthetic",
        retryable: false,
      },
    };
    expect(failure.ok).toBe(false);
    expect(failure.error.code).toBe("FORBIDDEN");
  });
});

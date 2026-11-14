import { z } from "zod";
import type { OrderStatus } from "@/shared/types/order";

/** Wire numbers are integer cents, never JS bigint JSON or floating point BRL. */
export const centsSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).brand<"Cents">();
export type Cents = z.infer<typeof centsSchema>;
export const uuidSchema = z.string().uuid();
export const productIdSchema = uuidSchema.brand<"ProductId">();
export const categoryIdSchema = uuidSchema.brand<"CategoryId">();
export const variantIdSchema = uuidSchema.brand<"VariantId">();
export const groupIdSchema = uuidSchema.brand<"GroupId">();
export const optionIdSchema = uuidSchema.brand<"OptionId">();
export const mediaIdSchema = uuidSchema.brand<"MediaId">();
export const orderIdSchema = uuidSchema.brand<"OrderId">();
export const itemIdSchema = uuidSchema.brand<"OrderItemId">();
export const customerIdSchema = uuidSchema.brand<"CustomerId">();
export const userIdSchema = uuidSchema.brand<"UserId">();
export const couponIdSchema = uuidSchema.brand<"CouponId">();
export const requestIdSchema = uuidSchema.brand<"CustomRequestId">();
export const bannerIdSchema = uuidSchema.brand<"BannerId">();
export const eventIdSchema = uuidSchema.brand<"EventId">();
export const operationKeySchema = uuidSchema.brand<"OperationKey">();
export type ProductId = z.infer<typeof productIdSchema>;
export type CategoryId = z.infer<typeof categoryIdSchema>;
export type VariantId = z.infer<typeof variantIdSchema>;
export type GroupId = z.infer<typeof groupIdSchema>;
export type OptionId = z.infer<typeof optionIdSchema>;
export type MediaId = z.infer<typeof mediaIdSchema>;
export type OrderId = z.infer<typeof orderIdSchema>;
export type OrderItemId = z.infer<typeof itemIdSchema>;
export type CustomerId = z.infer<typeof customerIdSchema>;
export type UserId = z.infer<typeof userIdSchema>;
export type CouponId = z.infer<typeof couponIdSchema>;
export type CustomRequestId = z.infer<typeof requestIdSchema>;
export type BannerId = z.infer<typeof bannerIdSchema>;
export type EventId = z.infer<typeof eventIdSchema>;
export type OperationKey = z.infer<typeof operationKeySchema>;
export const isoDateSchema = z.string().datetime({ offset: true }).brand<"IsoDate">();
export type IsoDate = z.infer<typeof isoDateSchema>;
export const pageRequestSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict();
export type PageRequest = z.infer<typeof pageRequestSchema>;
/** Cursor binds filter + sort + final ID; opaque, signed by the future server. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "OUT_OF_STOCK"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "INTERNAL";
export interface RepositoryError {
  readonly code: ErrorCode;
  /** Safe localization key. Never SQL, stack traces, secrets or customer payloads. */
  readonly messageKey: string;
  readonly requestId: string;
  readonly retryable: boolean;
  readonly fields?: Readonly<Record<string, readonly string[]>>;
}
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RepositoryError };
export interface IdempotentOutput<T> {
  readonly resource: T;
  readonly replayed: boolean;
}
export interface CommandContext {
  readonly operationKey: OperationKey;
  readonly expectedVersion: number;
  // Actor and timestamps are deliberately absent: derive them on the server.
}
export type AdminRole = "proprietario" | "editor" | "operador" | "financeiro";
export type ProductionMode = "pronta-entrega" | "sob-demanda";
export interface Versioned {
  readonly createdAt: IsoDate;
  readonly updatedAt: IsoDate;
  readonly version: number;
}
export interface PublicCategory {
  readonly id: CategoryId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly displayOrder: number;
}
export interface PublicProduct {
  readonly id: ProductId;
  readonly categoryId: CategoryId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly regularPriceCents: Cents;
  readonly promoPriceCents: Cents | null;
  readonly effectivePriceCents: Cents;
  readonly productionMode: ProductionMode;
  readonly productionDays: number | null;
  readonly featured: boolean;
  readonly badge: string | null;
}
export interface PublicAttributeGroup {
  readonly id: GroupId;
  readonly productId: ProductId;
  readonly code: string;
  readonly label: string;
  readonly position: number;
  readonly required: boolean;
}
export interface PublicAttributeOption {
  readonly id: OptionId;
  readonly groupId: GroupId;
  readonly code: string;
  readonly label: string;
  readonly position: number;
}
export interface PublicVariant {
  readonly id: VariantId;
  readonly productId: ProductId;
  readonly sku: string;
  readonly selectionKey: string;
}
export interface VariantOption {
  readonly variantId: VariantId;
  readonly groupId: GroupId;
  readonly optionId: OptionId;
}
export interface PublicImage {
  readonly mediaId: MediaId;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}
export interface ProductImage extends PublicImage {
  readonly productId: ProductId;
  readonly position: number;
  readonly isPrimary: boolean;
}
export interface CategoryImage extends PublicImage {
  readonly categoryId: CategoryId;
}
export interface PublicBanner {
  readonly id: BannerId;
  readonly title: string;
  readonly highlight: string;
  readonly subtitle: string;
  readonly buttonText: string;
  readonly buttonUrl: string;
  readonly displayOrder: number;
  readonly mediaId: MediaId | null;
}
export interface PublicStoreSettings {
  readonly id: 1;
  readonly name: string;
  readonly logoMediaId: MediaId | null;
  readonly whatsappNumber: string;
  readonly publicEmail: string | null;
  readonly socialLinks: Readonly<
    Partial<Record<"instagram" | "facebook" | "youtube" | "tiktok", string>>
  >;
  readonly address: string | null;
  readonly deliveryInfo: string;
  readonly offersNationalShipping: boolean;
  readonly serviceMessage: string;
  readonly canonicalOrigin: string | null;
  readonly timezone: string;
}
export interface Availability {
  readonly productId: ProductId;
  readonly available: boolean;
}
export interface AdminProfile extends Versioned {
  readonly userId: UserId;
  readonly displayName: string;
  readonly active: boolean;
}
export interface UserRole {
  readonly id: EventId;
  readonly userId: UserId;
  readonly role: AdminRole;
  readonly grantedBy: UserId | null;
  readonly createdAt: IsoDate;
}
export interface AdminCategory extends PublicCategory, Versioned {
  readonly active: boolean;
}
export interface AdminProduct extends PublicProduct, Versioned {
  readonly active: boolean;
  readonly archivedAt: IsoDate | null;
  readonly internalNotes: string;
}
export interface AdminVariant extends PublicVariant {
  readonly active: boolean;
  readonly createdAt: IsoDate;
}
export interface AdminAttributeOption extends PublicAttributeOption {
  readonly active: boolean;
  readonly createdAt: IsoDate;
}
export interface AdminAttributeGroup extends PublicAttributeGroup {
  readonly createdAt: IsoDate;
}
export interface MediaAsset extends Versioned {
  readonly id: MediaId;
  readonly bucket: string;
  readonly objectKey: string;
  readonly mime: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  /** bigint byte counts decode as decimal strings, avoiding precision loss. */
  readonly byteSize: string;
  readonly width: number;
  readonly height: number;
  readonly checksum: string;
  readonly alt: string;
  readonly state: "staging" | "verified" | "published" | "delete-pending";
  readonly createdBy: UserId | null;
  readonly derivatives: Readonly<Record<string, string>>;
}
export interface Customer extends Versioned {
  readonly id: CustomerId;
  readonly name: string;
  readonly phoneE164: string;
  readonly notes: string;
  readonly anonymizedAt: IsoDate | null;
}
export interface FinancialOrder {
  readonly id: OrderId;
  /** PostgreSQL sequence bigint is serialized as decimal text, not Number. */
  readonly number: string;
  readonly status: OrderStatus;
  readonly subtotalCents: Cents;
  readonly discountCents: Cents;
  readonly shippingCents: Cents | null;
  readonly totalCents: Cents | null;
  readonly currency: "BRL";
  readonly confirmedAt: IsoDate | null;
}
export interface AdminOrder extends FinancialOrder, Versioned {
  readonly customerId: CustomerId | null;
  readonly customerNameSnapshot: string;
  readonly customerPhoneSnapshot: string;
  readonly notes: string;
  readonly privacyNoticeVersion: string;
}
export interface OrderItem {
  readonly id: OrderItemId;
  readonly orderId: OrderId;
  readonly productId: ProductId | null;
  readonly variantId: VariantId | null;
  readonly productNameSnapshot: string;
  readonly skuSnapshot: string | null;
  readonly attributesSnapshot: Readonly<Record<string, string>>;
  readonly unitPriceCents: Cents;
  readonly quantity: number;
  readonly lineDiscountCents: Cents;
  readonly createdAt: IsoDate;
}
export interface OrderHistory {
  readonly id: EventId;
  readonly orderId: OrderId;
  readonly fromStatus: OrderStatus | null;
  readonly toStatus: OrderStatus;
  readonly actorId: UserId | null;
  readonly occurredAt: IsoDate;
  readonly note: string;
  readonly operationKey: string;
}
export interface Payment {
  readonly id: EventId;
  readonly orderId: OrderId;
  readonly amountCents: Cents;
  readonly kind: "receipt" | "refund" | "correction";
  readonly method: string;
  readonly reference: string | null;
  readonly evidenceMediaId: MediaId | null;
  readonly confirmedBy: UserId;
  readonly confirmedAt: IsoDate;
  readonly operationKey: OperationKey;
  readonly relatedPaymentId: EventId | null;
}
export interface InventoryBalance {
  readonly productId: ProductId;
  readonly onHand: number;
  readonly allocated: number;
  readonly version: number;
  readonly updatedAt: IsoDate;
}
export interface InventoryMovement {
  readonly id: EventId;
  readonly productId: ProductId;
  readonly orderId: OrderId | null;
  readonly kind: "adjust" | "allocate" | "release" | "consume" | "return";
  readonly quantity: number;
  readonly deltaOnHand: number;
  readonly deltaAllocated: number;
  readonly reason: string;
  readonly actorId: UserId | null;
  readonly operationKey: string;
  readonly createdAt: IsoDate;
}
export interface OrderAllocation extends Versioned {
  readonly id: EventId;
  readonly orderItemId: OrderItemId;
  readonly productId: ProductId;
  readonly quantity: number;
  readonly state: "active" | "released" | "consumed";
}
export interface Coupon extends Versioned {
  readonly id: CouponId;
  readonly code: string;
  readonly kind: "percentual" | "fixo";
  readonly value: number;
  readonly startsAt: IsoDate;
  readonly endsAt: IsoDate;
  readonly active: boolean;
  readonly usageLimit: number | null;
  readonly minSubtotalCents: Cents | null;
}
export interface CouponRedemption {
  readonly id: EventId;
  readonly couponId: CouponId;
  readonly orderId: OrderId;
  readonly discountCents: Cents;
  readonly state: "held" | "consumed" | "released";
  readonly expiresAt: IsoDate | null;
  readonly createdAt: IsoDate;
}
export type RequestStatus =
  | "recebida"
  | "em-analise"
  | "orcamento-enviado"
  | "aprovado"
  | "em-producao"
  | "concluido"
  | "cancelado";
export interface CustomRequest extends Versioned {
  readonly id: CustomRequestId;
  readonly customerId: CustomerId | null;
  readonly customerNameSnapshot: string;
  readonly customerPhoneSnapshot: string;
  readonly description: string;
  readonly dimensions: Readonly<Record<string, number>> | null;
  readonly colors: string;
  readonly quantity: number;
  readonly notes: string;
  readonly status: RequestStatus;
  readonly quoteCents: Cents | null;
  readonly quoteVersion: number;
}
export interface CustomRequestImage {
  readonly requestId: CustomRequestId;
  readonly mediaId: MediaId;
  readonly position: number;
}
export interface CustomRequestHistory {
  readonly id: EventId;
  readonly requestId: CustomRequestId;
  readonly fromStatus: RequestStatus | null;
  readonly toStatus: RequestStatus;
  readonly quoteCents: Cents | null;
  readonly actorId: UserId | null;
  readonly occurredAt: IsoDate;
  readonly note: string;
  readonly operationKey: string;
}
export interface AdminBanner extends PublicBanner, Versioned {
  readonly active: boolean;
}
export interface AdminStoreSettings extends PublicStoreSettings, Versioned {
  readonly privacyNoticeVersion: string;
}
export type AuditValue =
  string | number | boolean | null | readonly AuditValue[] | { readonly [key: string]: AuditValue };
export interface AuditEvent {
  readonly id: EventId;
  readonly actorId: UserId | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly requestId: string;
  readonly operationKey: string | null;
  readonly occurredAt: IsoDate;
  readonly safeBefore: AuditValue;
  readonly safeAfter: AuditValue;
  readonly reason: string;
}

export const createOrderInputSchema = z
  .object({
    operationKey: operationKeySchema,
    items: z
      .array(
        z
          .object({
            productId: productIdSchema,
            variantId: variantIdSchema,
            quantity: z.number().int().min(1).max(999),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    customer: z
      .object({
        name: z.string().trim().min(1).max(100),
        phoneE164: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
      })
      .strict(),
    notes: z.string().max(500),
    couponCode: z
      .string()
      .regex(/^[A-Z0-9]{3,20}$/)
      .optional(),
    privacyNoticeVersion: z.string().min(1).max(100),
  })
  .strict();
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
/** Creation returns only an acknowledgement; no anonymous GET by order number. */
export interface OrderAcknowledgement {
  readonly orderId: OrderId;
  readonly number: string;
  readonly status: "aguardando-contato";
}
export interface ChangeStatusInput extends CommandContext {
  readonly orderId: OrderId;
  readonly to: OrderStatus;
  readonly note: string;
}
export interface AdjustInventoryInput extends CommandContext {
  readonly productId: ProductId;
  readonly deltaOnHand: number;
  readonly reason: string;
}
export interface RecordPaymentInput extends CommandContext {
  readonly orderId: OrderId;
  readonly amountCents: Cents;
  readonly kind: Payment["kind"];
  readonly method: string;
  readonly reference: string | null;
  readonly evidenceMediaId: MediaId | null;
  readonly relatedPaymentId: EventId | null;
}
export interface CreateCustomRequestInput {
  readonly operationKey: OperationKey;
  readonly customer: { readonly name: string; readonly phoneE164: string };
  readonly description: string;
  readonly dimensions: CustomRequest["dimensions"];
  readonly colors: string;
  readonly quantity: number;
  readonly notes: string;
  readonly mediaIds: readonly MediaId[];
}
export interface QuoteRequestInput extends CommandContext {
  readonly requestId: CustomRequestId;
  readonly quoteCents: Cents;
  readonly note: string;
}
export interface RoleAssignmentInput extends CommandContext {
  readonly userId: UserId;
  readonly role: AdminRole;
  readonly grant: boolean;
  readonly reason: string;
}
/** Replays are resolved BEFORE version/stock checks; same key + different canonical payload conflicts. */
export function compareIdempotencyHashes(stored: string, incoming: string): "replay" | "conflict" {
  const sha256 = /^[a-f0-9]{64}$/;
  if (!sha256.test(stored) || !sha256.test(incoming)) throw new Error("Invalid SHA-256 digest");
  return stored === incoming ? "replay" : "conflict";
}
/** Explicit decimal decoding at the adapter boundary, never a lossy Number conversion. */
export function decodeCents(value: string): Cents {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("Invalid integer cents");
  return centsSchema.parse(Number(value));
}

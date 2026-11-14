import type * as D from "./foundation";

/** Contracts only: no Supabase client, credentials or server commands in browser code. */
export interface PublicCatalogRepository {
  categories(page: D.PageRequest): Promise<D.Result<D.Page<D.PublicCategory>>>;
  products(
    page: D.PageRequest & {
      readonly categoryId?: D.CategoryId;
      readonly sort?: "created" | "price-asc" | "price-desc";
    },
  ): Promise<D.Result<D.Page<D.PublicProduct>>>;
  product(slug: string): Promise<D.Result<D.PublicProduct | null>>;
  groups(productId: D.ProductId): Promise<D.Result<readonly D.PublicAttributeGroup[]>>;
  options(groupId: D.GroupId): Promise<D.Result<readonly D.PublicAttributeOption[]>>;
  variants(productId: D.ProductId): Promise<D.Result<readonly D.PublicVariant[]>>;
  variantOptions(variantId: D.VariantId): Promise<D.Result<readonly D.VariantOption[]>>;
  images(productId: D.ProductId): Promise<D.Result<readonly D.ProductImage[]>>;
  categoryImage(categoryId: D.CategoryId): Promise<D.Result<D.CategoryImage | null>>;
  availability(productId: D.ProductId): Promise<D.Result<D.Availability | null>>;
}
export interface PublicContentRepository {
  banners(page: D.PageRequest): Promise<D.Result<D.Page<D.PublicBanner>>>;
  settings(): Promise<D.Result<D.PublicStoreSettings | null>>;
}
export type SaveProductInput = Omit<
  D.AdminProduct,
  "id" | "createdAt" | "updatedAt" | "version" | "effectivePriceCents"
> & { readonly id?: D.ProductId };
export type SaveCategoryInput = Omit<
  D.AdminCategory,
  "id" | "createdAt" | "updatedAt" | "version"
> & { readonly id?: D.CategoryId };
export interface SaveVariantInput {
  readonly id?: D.VariantId;
  readonly productId: D.ProductId;
  readonly sku: string;
  readonly active: boolean;
  /** Canonical selectionKey is built on server, not trusted from client. */
  readonly options: readonly { readonly groupId: D.GroupId; readonly optionId: D.OptionId }[];
}
export interface AdminCatalogRepository {
  products(page: D.PageRequest): Promise<D.Result<D.Page<D.AdminProduct>>>;
  categories(page: D.PageRequest): Promise<D.Result<D.Page<D.AdminCategory>>>;
  saveProduct(
    input: SaveProductInput,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminProduct>>>;
  saveCategory(
    input: SaveCategoryInput,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminCategory>>>;
  archiveProduct(
    id: D.ProductId,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminProduct>>>;
  saveVariant(
    input: SaveVariantInput,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminVariant>>>;
  saveGroup(
    input: Omit<D.AdminAttributeGroup, "createdAt">,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminAttributeGroup>>>;
  saveOption(
    input: Omit<D.AdminAttributeOption, "createdAt">,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminAttributeOption>>>;
  linkProductImage(
    input: {
      readonly productId: D.ProductId;
      readonly mediaId: D.MediaId;
      readonly position: number;
      readonly isPrimary: boolean;
    },
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.ProductImage>>>;
  linkCategoryImage(
    input: { readonly categoryId: D.CategoryId; readonly mediaId: D.MediaId },
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.CategoryImage>>>;
}
export interface AdminOrderRepository {
  list(
    page: D.PageRequest & { readonly status?: D.AdminOrder["status"] },
  ): Promise<D.Result<D.Page<D.AdminOrder>>>;
  get(id: D.OrderId): Promise<D.Result<D.AdminOrder | null>>;
  items(id: D.OrderId): Promise<D.Result<readonly D.OrderItem[]>>;
  history(id: D.OrderId, page: D.PageRequest): Promise<D.Result<D.Page<D.OrderHistory>>>;
  /** One future server transaction reprices, writes snapshots/history and persists replay. */
  create(input: D.CreateOrderInput): Promise<D.Result<D.IdempotentOutput<D.OrderAcknowledgement>>>;
  changeStatus(input: D.ChangeStatusInput): Promise<D.Result<D.IdempotentOutput<D.AdminOrder>>>;
}
export interface AdminCustomerRepository {
  list(page: D.PageRequest): Promise<D.Result<D.Page<D.Customer>>>;
  get(id: D.CustomerId): Promise<D.Result<D.Customer | null>>;
  save(
    input: {
      readonly id?: D.CustomerId;
      readonly name: string;
      readonly phoneE164: string;
      readonly notes: string;
    },
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.Customer>>>;
  /** Retention policy and explicit authorization required before implementation. */
  anonymize(
    id: D.CustomerId,
    reason: string,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.Customer>>>;
}
export interface AdminInventoryRepository {
  balances(page: D.PageRequest): Promise<D.Result<D.Page<D.InventoryBalance>>>;
  movements(
    productId: D.ProductId,
    page: D.PageRequest,
  ): Promise<D.Result<D.Page<D.InventoryMovement>>>;
  allocations(
    productId: D.ProductId,
    page: D.PageRequest,
  ): Promise<D.Result<D.Page<D.OrderAllocation>>>;
  /** Ledger + balance + audit in one future transaction; no raw setStock in backend. */
  adjust(input: D.AdjustInventoryInput): Promise<D.Result<D.IdempotentOutput<D.InventoryBalance>>>;
}
export interface FinanceRepository {
  orders(page: D.PageRequest): Promise<D.Result<D.Page<D.FinancialOrder>>>;
  payments(orderId: D.OrderId, page: D.PageRequest): Promise<D.Result<D.Page<D.Payment>>>;
  /** Do not implement until partial/refund/correction rules are approved. */
  record(input: D.RecordPaymentInput): Promise<D.Result<D.IdempotentOutput<D.Payment>>>;
}
export interface AdminCouponRepository {
  list(page: D.PageRequest): Promise<D.Result<D.Page<D.Coupon>>>;
  save(
    input: Omit<D.Coupon, keyof D.Versioned>,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.Coupon>>>;
  redemptions(
    couponId: D.CouponId,
    page: D.PageRequest,
  ): Promise<D.Result<D.Page<D.CouponRedemption>>>;
}
export interface AdminCustomRequestRepository {
  list(page: D.PageRequest): Promise<D.Result<D.Page<D.CustomRequest>>>;
  create(
    input: D.CreateCustomRequestInput,
  ): Promise<
    D.Result<D.IdempotentOutput<{ readonly id: D.CustomRequestId; readonly status: "recebida" }>>
  >;
  images(id: D.CustomRequestId): Promise<D.Result<readonly D.CustomRequestImage[]>>;
  history(
    id: D.CustomRequestId,
    page: D.PageRequest,
  ): Promise<D.Result<D.Page<D.CustomRequestHistory>>>;
  quote(input: D.QuoteRequestInput): Promise<D.Result<D.IdempotentOutput<D.CustomRequest>>>;
}
export interface AdminContentRepository {
  banners(page: D.PageRequest): Promise<D.Result<D.Page<D.AdminBanner>>>;
  saveBanner(
    input: Omit<D.AdminBanner, keyof D.Versioned>,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminBanner>>>;
  settings(): Promise<D.Result<D.AdminStoreSettings | null>>;
  saveSettings(
    input: Omit<D.AdminStoreSettings, keyof D.Versioned>,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminStoreSettings>>>;
}
export interface AdminMediaRepository {
  list(page: D.PageRequest): Promise<D.Result<D.Page<D.MediaAsset>>>;
  get(id: D.MediaId): Promise<D.Result<D.MediaAsset | null>>;
  /** No upload/bucket creation or client supplied verified flags in this stage. */
  requestDeletion(
    id: D.MediaId,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.MediaAsset>>>;
}
export interface AdminIdentityRepository {
  profiles(page: D.PageRequest): Promise<D.Result<D.Page<D.AdminProfile>>>;
  roles(userId: D.UserId): Promise<D.Result<readonly D.UserRole[]>>;
  assignRole(
    input: D.RoleAssignmentInput,
  ): Promise<D.Result<D.IdempotentOutput<readonly D.UserRole[]>>>;
  setActive(
    userId: D.UserId,
    active: boolean,
    reason: string,
    context: D.CommandContext,
  ): Promise<D.Result<D.IdempotentOutput<D.AdminProfile>>>;
}
export interface AdminAuditRepository {
  list(
    page: D.PageRequest & { readonly entityId?: string },
  ): Promise<D.Result<D.Page<D.AuditEvent>>>;
  // Append is internal to authorized commands; no generic public audit writer.
}

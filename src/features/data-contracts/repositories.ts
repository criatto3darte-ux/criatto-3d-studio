import type { Category, Product } from "@/shared/types/catalog";
import type { DemoBanner, DemoCustomer, DemoOrder, StoreSettings } from "@/features/demo-data/model";
import type { OrderStatus } from "@/shared/types/order";

/**
 * Contratos para a futura integração com backend (CR-006+). Ainda NÃO implementados com servidor:
 * hoje a fonte única é `demoRepository` (LocalStorage). Todos assíncronos para não mudar
 * as chamadas quando a implementação passar a ser remota.
 */
export interface ProductRepository {
  listPublic(): Promise<Product[]>;
  listAll(): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | null>;
  save(product: Product): Promise<Product>;
  remove(id: string): Promise<void>;
}
export interface CategoryRepository {
  list(opts?: { includeInactive?: boolean }): Promise<Category[]>;
  save(category: Category, originalSlug?: string): Promise<Category>;
  /** Must fail when products are linked unless `moveTo` is given. */
  remove(slug: string, moveTo?: string): Promise<void>;
}
export interface OrderRepository {
  list(): Promise<DemoOrder[]>;
  get(id: string): Promise<DemoOrder | null>;
  /** Server must re-price items; client totals are never trusted. */
  changeStatus(id: string, to: OrderStatus, note?: string): Promise<DemoOrder>;
}
export interface CustomerRepository {
  list(): Promise<DemoCustomer[]>;
  get(id: string): Promise<DemoCustomer | null>;
}
export interface InventoryRepository {
  setStock(productId: string, stock: number): Promise<void>;
  lowStock(threshold: number): Promise<Product[]>;
}
export interface BannerRepository {
  list(): Promise<DemoBanner[]>;
  save(banner: DemoBanner): Promise<DemoBanner>;
  remove(id: string): Promise<void>;
}
export interface StoreSettingsRepository {
  get(): Promise<StoreSettings>;
  save(settings: StoreSettings): Promise<StoreSettings>;
}

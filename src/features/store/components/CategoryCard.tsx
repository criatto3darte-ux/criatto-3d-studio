import { Link } from "@tanstack/react-router";
import type { Category } from "@/shared/types/catalog";
import { MediaImage } from "@/shared/ui/MediaImage";
import { categoryVisual } from "./categoryVisual";
import styles from "./CategoryCard.module.css";

export function CategoryCard({ category, count }: { category: Category; count: number }) {
  const v = categoryVisual[category.slug];
  const Icon = v.icon;
  return (
    <Link to="/produtos" search={{ categoria: category.slug }} className={styles.card}>
      <MediaImage src={category.image} alt={category.name} ratio="4 / 3" accent={v.accent} showTag={false} fallbackIcon={<Icon strokeWidth={1.3} aria-hidden="true" />} />
      <div className={styles.body}>
        <div className={styles.name}>{category.name}</div>
        <div className={styles.count}>{count} {count === 1 ? "produto" : "produtos"}</div>
      </div>
    </Link>
  );
}

export function CategoryGrid({ items }: { items: { category: Category; count: number }[] }) {
  return (
    <ul className={styles.grid}>
      {items.map(({ category, count }) => <li key={category.slug}><CategoryCard category={category} count={count} /></li>)}
    </ul>
  );
}

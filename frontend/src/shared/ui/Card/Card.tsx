import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import styles from './Card.module.css';

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={clsx(styles.card, padded && styles.padded, className)}>{children}</section>;
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className={styles.header}>
      <h3 className={styles.title}>{title}</h3>
      {action}
    </header>
  );
}

/** Плитка метрики для дашборда. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
}) {
  return (
    <div className={clsx(styles.tile, styles[`tone_${tone}`])}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={clsx(styles.tileValue, 'tnum')}>{value}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </div>
  );
}

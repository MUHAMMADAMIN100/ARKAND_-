import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { FiInbox, FiAlertTriangle } from 'react-icons/fi';
import styles from './States.module.css';

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 10) }}
      aria-label="Загрузка"
    />
  );
}

export function LoadingBlock({ text = 'Загрузка…' }: { text?: string }) {
  return (
    <div className={styles.center}>
      <Spinner size={32} />
      <span className={styles.dim}>{text}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.center}>
      <span className={styles.icon}>{icon ?? <FiInbox />}</span>
      <p className={styles.emptyTitle}>{title}</p>
      {hint && <p className={styles.dim}>{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Что-то пошло не так', hint, onRetry }: { title?: string; hint?: string; onRetry?: () => void }) {
  return (
    <div className={styles.center}>
      <span className={clsx(styles.icon, styles.iconDanger)}>
        <FiAlertTriangle />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {hint && <p className={styles.dim}>{hint}</p>}
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

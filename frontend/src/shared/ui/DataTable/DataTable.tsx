import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import styles from './DataTable.module.css';
import { LoadingBlock, EmptyState } from '../feedback/States';

export interface Column<T> {
  key: string;
  header: string;
  /** Значение ячейки. */
  render: (row: T) => ReactNode;
  /** Показывать как заголовок карточки на мобильном. */
  primary?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Скрыть колонку в мобильной карточке. */
  hideOnMobile?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
}

/**
 * Адаптивная таблица. Десктоп ≥720px — обычная таблица со скроллом по X.
 * Мобильный <720px — карточки (одинаково выглядят на 320–425px): primary-колонка — заголовок,
 * остальные — пары «метка: значение». Никакого горизонтального скролла на телефоне.
 */
export function DataTable<T>({ columns, rows, rowKey, loading, emptyText = 'Нет данных', onRowClick, footer }: DataTableProps<T>) {
  if (loading) return <LoadingBlock />;
  if (rows.length === 0) return <EmptyState title={emptyText} />;

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile);

  return (
    <>
      {/* Десктоп */}
      <div className={clsx(styles.tableWrap, 'scroll-x')}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width, textAlign: c.align ?? 'left' }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} onClick={() => onRowClick?.(row)} className={onRowClick ? styles.clickable : undefined}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'left' }} className={c.align === 'right' ? 'tnum' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Мобильный */}
      <div className={styles.cards}>
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className={clsx(styles.card, onRowClick && styles.clickable)}
            onClick={() => onRowClick?.(row)}
          >
            <div className={styles.cardHead}>{primary?.render(row)}</div>
            <dl className={styles.cardBody}>
              {secondary.map((c) => (
                <div key={c.key} className={styles.cardRow}>
                  <dt>{c.header}</dt>
                  <dd className={c.align === 'right' ? 'tnum' : undefined}>{c.render(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {footer}
    </>
  );
}

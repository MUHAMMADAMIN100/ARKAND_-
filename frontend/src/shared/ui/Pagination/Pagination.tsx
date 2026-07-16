import { Button } from '../Button/Button';
import styles from './Pagination.module.css';

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className={styles.wrap}>
      <span className={styles.info}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} из {total}
      </span>
      <div className={styles.controls}>
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ←
        </Button>
        <span className={styles.page}>
          {page} / {pages}
        </span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          →
        </Button>
      </div>
    </div>
  );
}

/** Кнопка «показать ещё» для keyset-пагинации. */
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading?: boolean; onLoad: () => void }) {
  if (!hasMore) return null;
  return (
    <div className={styles.more}>
      <Button variant="secondary" loading={loading} onClick={onLoad}>
        Показать ещё
      </Button>
    </div>
  );
}

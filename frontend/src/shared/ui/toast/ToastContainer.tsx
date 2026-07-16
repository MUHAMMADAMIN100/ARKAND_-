import { FiCheck, FiX, FiInfo } from 'react-icons/fi';
import { useToastStore } from './toast.store';
import styles from './ToastContainer.module.css';
import { clsx } from 'clsx';

const iconByKind = { success: FiCheck, error: FiX, info: FiInfo } as const;

export function ToastContainer() {
  const { toasts, remove } = useToastStore();
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = iconByKind[t.kind];
        return (
          <div key={t.id} className={clsx(styles.toast, styles[t.kind])} onClick={() => remove(t.id)}>
            <span className={styles.icon}>
              <Icon />
            </span>
            <span className={styles.msg}>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

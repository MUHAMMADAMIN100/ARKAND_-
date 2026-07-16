import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import styles from './form.module.css';

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, error, hint, required, children, className }: FieldProps) {
  return (
    <label className={clsx(styles.field, className)}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.req}>*</span>}
        </span>
      )}
      {children}
      {error ? <span className={styles.error}>{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}

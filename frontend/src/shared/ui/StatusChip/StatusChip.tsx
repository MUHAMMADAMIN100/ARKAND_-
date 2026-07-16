import { clsx } from 'clsx';
import styles from './StatusChip.module.css';

type Tone = 'new' | 'progress' | 'done' | 'cancel' | 'danger' | 'info';

const toneByValue: Record<string, Tone> = {
  // orders
  NEW: 'new',
  CONFIRMED: 'info',
  READY: 'progress',
  SHIPPING: 'progress',
  COMPLETED: 'done',
  CANCELLED: 'cancel',
  // talon
  ISSUED: 'new',
  SHIPPED: 'progress',
  DELIVERED: 'done',
  // shift / inventory
  OPEN: 'progress',
  CLOSED: 'done',
  IN_PROGRESS: 'progress',
  // cash / approval
  PENDING: 'progress',
  CONFIRMED_: 'done',
  REJECTED: 'danger',
  APPROVED: 'done',
  // purchase
  PENDING_APPROVAL: 'progress',
  PURCHASED: 'info',
  RECEIVED: 'done',
};

export function StatusChip({ value, label }: { value: string; label: string }) {
  const tone = toneByValue[value] ?? 'info';
  return <span className={clsx(styles.chip, styles[tone])}>{label}</span>;
}

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import styles from './form.module.css';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, options, placeholder, className, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={clsx(styles.control, styles.select, invalid && styles.invalid, className)} {...rest}>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

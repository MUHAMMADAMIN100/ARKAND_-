import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import styles from './form.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return <input ref={ref} className={clsx(styles.control, invalid && styles.invalid, className)} {...rest} />;
});

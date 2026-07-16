import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import styles from './form.module.css';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea ref={ref} className={clsx(styles.control, styles.textarea, invalid && styles.invalid, className)} {...rest} />
  );
});

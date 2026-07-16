import { useCallback, useEffect, useState } from 'react';

/** Дебаунс значения (для поиска). */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Опции register() для ОПЦИОНАЛЬНОГО числового поля.
 * Пустой ввод → undefined (проходит .optional()), а не NaN (который валит Zod-схему).
 * Для обязательных числовых полей используйте обычный { valueAsNumber: true }.
 */
export const optionalNumber = {
  setValueAs: (v: unknown): number | undefined => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  },
};

/** Управление открытием/закрытием (модалки, дровер). */
export function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return { open, onOpen, onClose, toggle };
}

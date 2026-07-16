import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { HttpError } from './http';
import { toast } from '../ui/toast/toast.store';

/**
 * Универсальный хелпер ОПТИМИСТИЧНЫХ мутаций (требование заказчика: всё без задержек).
 * Мгновенно правит кэш через updater, при ошибке откатывает и показывает toast,
 * в конце инвалидирует связанные ключи.
 *
 * @param mutationFn — сетевой вызов.
 * @param queryKey — ключ(и) списка для оптимистичного апдейта и инвалидации.
 * @param updater — как изменить закэшированные данные оптимистично (получает старые данные и переменные).
 * @param successMessage — текст toast при успехе.
 */
export function useOptimisticMutation<TData, TVars, TCached = unknown>(opts: {
  mutationFn: (vars: TVars) => Promise<TData>;
  queryKeys: QueryKey[];
  updater?: (old: TCached | undefined, vars: TVars) => TCached | undefined;
  successMessage?: string;
  errorMessage?: string;
  onDone?: (data: TData | undefined, vars: TVars) => void;
}) {
  const qc = useQueryClient();

  return useMutation<TData, unknown, TVars, { snapshots: [QueryKey, unknown][] }>({
    mutationFn: opts.mutationFn,
    onMutate: async (vars) => {
      const snapshots: [QueryKey, unknown][] = [];
      for (const key of opts.queryKeys) {
        await qc.cancelQueries({ queryKey: key });
        const prev = qc.getQueryData(key);
        snapshots.push([key, prev]);
        if (opts.updater) {
          qc.setQueryData(key, (old: TCached | undefined) => opts.updater!(old, vars));
        }
      }
      return { snapshots };
    },
    onError: (error, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, prev]) => qc.setQueryData(key, prev));
      const msg =
        opts.errorMessage ??
        (error instanceof HttpError ? error.message : 'Не удалось сохранить, попробуйте ещё раз');
      toast.error(msg);
    },
    onSuccess: (data, vars) => {
      if (opts.successMessage) toast.success(opts.successMessage);
      opts.onDone?.(data, vars);
    },
    onSettled: () => {
      for (const key of opts.queryKeys) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

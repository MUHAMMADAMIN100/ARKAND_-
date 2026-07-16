import { z } from 'zod';
import { InventoryStatus, offsetPaginationSchema } from '@sheben/shared';

/** Список инвентаризаций — offset-пагинация + фильтр по статусу. */
export const inventoryFilterSchema = offsetPaginationSchema.extend({
  status: z.enum(InventoryStatus).optional(),
});
export type InventoryFilter = z.infer<typeof inventoryFilterSchema>;

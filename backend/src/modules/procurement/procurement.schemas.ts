import { z } from 'zod';
import { PurchaseStatus, offsetPaginationSchema } from '@sheben/shared';

/**
 * Локальный фильтр списка заявок на закупку. Не публикуется в @sheben/shared —
 * используется только этим backend-модулем (offset-пагинация + фильтр по статусу).
 */
export const purchaseRequestFilterSchema = offsetPaginationSchema.extend({
  status: z.enum(PurchaseStatus).optional(),
});
export type PurchaseRequestFilter = z.infer<typeof purchaseRequestFilterSchema>;

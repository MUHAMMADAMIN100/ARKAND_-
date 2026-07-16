// Barrel shared-слоя — единая точка импорта для страниц и виджетов.
export { http, HttpError } from './api/http';
export type { ApiError } from './api/http';
export { queryClient } from './api/query-client';
export { useOptimisticMutation } from './api/optimistic';

export { useAuthStore, authStore } from './auth/auth.store';
export { useAuth } from './auth/useAuth';

export { API_BASE, IS_DEV } from './config/env';

export { Button } from './ui/Button/Button';
export { Field } from './ui/form/Field';
export { Input } from './ui/form/Input';
export { Select } from './ui/form/Select';
export { Textarea } from './ui/form/Textarea';
export { Modal } from './ui/Modal/Modal';
export { Card, CardHeader, StatTile } from './ui/Card/Card';
export { StatusChip } from './ui/StatusChip/StatusChip';
export { DataTable } from './ui/DataTable/DataTable';
export type { Column } from './ui/DataTable/DataTable';
export { Pagination, LoadMore } from './ui/Pagination/Pagination';
export { PageHeader, Toolbar } from './ui/layout/PageHeader';
export { Spinner, LoadingBlock, EmptyState, ErrorState } from './ui/feedback/States';
export { ToastContainer } from './ui/toast/ToastContainer';
export { toast } from './ui/toast/toast.store';

export { money, num, qty, formatDate, formatDateTime, formatMonth, todayISO } from './lib/format';
export { useDebounce, useDisclosure, optionalNumber } from './lib/hooks';
export { zodForm } from './lib/zod-form';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  createPurchaseRequestSchema,
  ApprovalDecisionLabel,
  PurchaseStatusLabel,
  Unit,
  UnitLabel,
  type CreatePurchaseRequestInput,
  type PurchaseRequestDto,
} from '@sheben/shared';
import {
  procurementKeys,
  fetchPurchaseRequests,
  fetchPurchaseRequest,
  createPurchaseRequest,
  decidePurchaseRequest,
  markPurchaseRequestPurchased,
  receivePurchaseRequest,
  cancelPurchaseRequest,
  type PurchaseRequestListParams,
} from '../../entities/procurement/api';
import { warehouseKeys } from '../../entities/warehouse/api';
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  StatusChip,
  Pagination,
  money,
  num,
  optionalNumber,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';

export function ProcurementPage() {
  const { hasRole } = useAuth();
  const canCreate = hasRole('SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const params: PurchaseRequestListParams = { page, pageSize: 25 };
  const { data, isLoading } = useQuery({ queryKey: procurementKeys.list(params), queryFn: () => fetchPurchaseRequests(params) });

  const columns: Column<PurchaseRequestDto>[] = [
    { key: 'number', header: '№', primary: true, render: (r) => `№${r.number} · ${r.title}` },
    { key: 'cost', header: 'Стоимость', align: 'right', render: (r) => money(r.actualCost ?? r.estimatedCost ?? 0) },
    {
      key: 'large',
      header: 'Тип',
      render: (r) => (r.isLarge ? <StatusChip value="PENDING" label="Крупная" /> : <span style={{ color: 'var(--c-text-dim)', fontSize: 12 }}>обычная</span>),
      hideOnMobile: true,
    },
    {
      key: 'approvals',
      header: 'Согласия',
      render: (r) => (r.approvals.length ? `${r.approvals.filter((a) => a.decision === 'APPROVED').length}/${r.approvals.length}` : '—'),
      hideOnMobile: true,
    },
    { key: 'status', header: 'Статус', render: (r) => <StatusChip value={r.status} label={PurchaseStatusLabel[r.status]} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Снабжение"
        subtitle="Заявки на закупку"
        actions={canCreate && <Button onClick={() => setCreateOpen(true)}>+ Заявка</Button>}
      />
      <Card padded>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          loading={isLoading}
          emptyText="Заявок нет"
          onRowClick={(r) => setDetailId(r.id)}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>

      {createOpen && <PurchaseCreateModal onClose={() => setCreateOpen(false)} />}
      {detailId && <PurchaseDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function PurchaseCreateModal({ onClose }: { onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreatePurchaseRequestInput>({
    resolver: zodResolver(createPurchaseRequestSchema),
  });
  const createMut = useOptimisticMutation<PurchaseRequestDto, CreatePurchaseRequestInput>({
    mutationFn: createPurchaseRequest,
    queryKeys: [procurementKeys.all],
    successMessage: 'Заявка создана',
    onDone: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Новая заявка на закупку"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button loading={createMut.isPending} onClick={handleSubmit((d) => createMut.mutate(d))}>Создать</Button>
        </>
      }
    >
      <Field label="Что закупаем" error={errors.title?.message} required>
        <Input placeholder="Солярка, 500 л" {...register('title')} />
      </Field>
      <Field label="Ориентировочная стоимость, смн" error={errors.estimatedCost?.message} hint="Крупные заявки уходят на согласование владельцам">
        <Input type="number" step="0.01" {...register('estimatedCost', optionalNumber)} />
      </Field>
      <Field label="Поставщик" error={errors.supplierName?.message}>
        <Input {...register('supplierName')} />
      </Field>
      <Field label="Примечание" error={errors.note?.message}>
        <Input {...register('note')} />
      </Field>
    </Modal>
  );
}

function PurchaseDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { hasRole } = useAuth();
  const isOwner = hasRole('OWNER');
  const isSupply = hasRole('SUPPLY_MANAGER', 'OWNER', 'ADMIN');
  const { data: req } = useQuery({ queryKey: procurementKeys.detail(id), queryFn: () => fetchPurchaseRequest(id) });
  const [actualCost, setActualCost] = useState('');

  const decideMut = useOptimisticMutation<PurchaseRequestDto, 'APPROVED' | 'REJECTED'>({
    mutationFn: (decision) => decidePurchaseRequest(id, { decision }),
    queryKeys: [procurementKeys.all, procurementKeys.detail(id)],
    successMessage: 'Решение записано',
  });
  const purchaseMut = useOptimisticMutation<PurchaseRequestDto, number>({
    mutationFn: (cost) => markPurchaseRequestPurchased(id, { actualCost: cost }),
    queryKeys: [procurementKeys.all, procurementKeys.detail(id)],
    successMessage: 'Отмечено как закуплено',
  });
  const receiveMut = useOptimisticMutation<PurchaseRequestDto, void>({
    mutationFn: () => receivePurchaseRequest(id, {}),
    // Оприходование пополняет склад — обновляем и складские остатки.
    queryKeys: [procurementKeys.all, procurementKeys.detail(id), warehouseKeys.all],
    successMessage: 'Оприходовано на склад',
  });
  const cancelMut = useOptimisticMutation<PurchaseRequestDto, void>({
    mutationFn: () => cancelPurchaseRequest(id),
    queryKeys: [procurementKeys.all, procurementKeys.detail(id)],
    successMessage: 'Заявка отменена',
    onDone: onClose,
  });

  if (!req) return null;

  return (
    <Modal open onClose={onClose} title={`Заявка №${req.number}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b>{req.title}</b>
        <StatusChip value={req.status} label={PurchaseStatusLabel[req.status]} />
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-muted)' }}>
        Стоимость: {money(req.actualCost ?? req.estimatedCost ?? 0)}
        {req.quantity != null && ` · ${num(req.quantity)} ${req.unit ? UnitLabel[req.unit as Unit] : ''}`}
        {req.supplierName && ` · ${req.supplierName}`}
      </div>

      {req.approvals.length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)', marginBottom: 6 }}>Согласование владельцев:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {req.approvals.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)' }}>
                <span>{a.ownerName}</span>
                <StatusChip value={a.decision} label={ApprovalDecisionLabel[a.decision]} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
        {isOwner && req.status === 'PENDING_APPROVAL' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="success" fullWidth loading={decideMut.isPending} onClick={() => decideMut.mutate('APPROVED')}>Добро</Button>
            <Button variant="danger" fullWidth loading={decideMut.isPending} onClick={() => decideMut.mutate('REJECTED')}>Нет</Button>
          </div>
        )}
        {isSupply && req.status === 'APPROVED' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Field label="Фактическая стоимость" className="grow">
              <Input type="number" step="0.01" value={actualCost} onChange={(e) => setActualCost(e.target.value)} />
            </Field>
            <Button loading={purchaseMut.isPending} onClick={() => purchaseMut.mutate(Number(actualCost) || req.estimatedCost || 0)}>Закуплено</Button>
          </div>
        )}
        {isSupply && req.status === 'PURCHASED' && (
          <Button variant="success" fullWidth loading={receiveMut.isPending} onClick={() => receiveMut.mutate()}>Оприходовать на склад</Button>
        )}
        {isSupply && req.status !== 'RECEIVED' && req.status !== 'CANCELLED' && (
          <Button variant="ghost" size="sm" loading={cancelMut.isPending} onClick={() => cancelMut.mutate()}>Отменить заявку</Button>
        )}
      </div>
    </Modal>
  );
}

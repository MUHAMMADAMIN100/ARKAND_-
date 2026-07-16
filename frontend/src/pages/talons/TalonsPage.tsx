import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  createTalonSchema,
  DeliveryType,
  DeliveryTypeLabel,
  TalonStatus,
  TalonStatusLabel,
  VehicleType,
  type CreateTalonInput,
  type OrderDto,
  type TalonDto,
} from '@sheben/shared';
import {
  talonKeys,
  fetchTalons,
  createTalon,
  shipTalon,
  deliverTalon,
  cancelTalon,
  fetchVehicles,
  fetchDrivers,
} from '../../entities/talon/api';
import { fetchOrders, orderKeys } from '../../entities/order/api';
import { warehouseKeys } from '../../entities/warehouse/api';
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusChip,
  LoadMore,
  money,
  num,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';

export function TalonsPage() {
  const { hasRole } = useAuth();
  const canIssue = hasRole('OPERATOR', 'SALES_MANAGER', 'OWNER', 'ADMIN');
  const isDriver = hasRole('DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const filter = { status: (status || undefined) as TalonStatus | undefined, limit: 50 };
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: talonKeys.list(filter),
    queryFn: ({ pageParam }) => fetchTalons({ ...filter, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: talonKeys.all });

  const shipMut = useOptimisticMutation<TalonDto, string>({ mutationFn: shipTalon, queryKeys: [talonKeys.all], successMessage: 'Талон отгружен', onDone: invalidate });
  const deliverMut = useOptimisticMutation<TalonDto, string>({ mutationFn: deliverTalon, queryKeys: [talonKeys.all], successMessage: 'Доставлено', onDone: invalidate });
  // Отмена возвращает товар на склад и может вернуть заказ из SHIPPING — обновляем и склад, и заказы.
  const cancelMut = useOptimisticMutation<TalonDto, string>({ mutationFn: cancelTalon, queryKeys: [talonKeys.all, warehouseKeys.all, orderKeys.all], successMessage: 'Талон отменён', onDone: invalidate });

  const columns: Column<TalonDto>[] = [
    { key: 'number', header: '№ талона', primary: true, render: (t) => `Талон №${t.number}` },
    { key: 'order', header: 'Заказ', render: (t) => `№${t.orderNumber} · ${t.clientName}` },
    { key: 'product', header: 'Фракция', render: (t) => `${t.productName}, ${num(t.quantity)} м³` },
    { key: 'status', header: 'Статус', render: (t) => <StatusChip value={t.status} label={TalonStatusLabel[t.status]} /> },
    { key: 'delivery', header: 'Доставка', render: (t) => (t.deliveryType === 'DELIVERY' ? `${t.vehicleName ?? '—'} / ${t.driverName ?? '—'}` : `Самовывоз ${t.clientVehiclePlate ?? ''}`), hideOnMobile: true },
    { key: 'sum', header: 'Сумма', align: 'right', render: (t) => money(t.amount) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {canIssue && t.status === 'ISSUED' && <Button size="sm" variant="secondary" onClick={() => shipMut.mutate(t.id)}>Отгружен</Button>}
          {(canIssue || isDriver) && t.status === 'SHIPPED' && <Button size="sm" variant="success" onClick={() => deliverMut.mutate(t.id)}>Доставлен</Button>}
          {canIssue && (t.status === 'ISSUED' || t.status === 'SHIPPED') && <Button size="sm" variant="ghost" onClick={() => cancelMut.mutate(t.id)}>Отмена</Button>}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Талоны отгрузки"
        subtitle={isDriver ? 'Ваши талоны доставки' : 'Цифровые талоны на машину'}
        actions={canIssue && <Button onClick={() => setCreateOpen(true)}>+ Выдать талон</Button>}
      />
      <Card padded>
        <div style={{ marginBottom: 12 }}>
          <Select
            options={[{ value: '', label: 'Все статусы' }, ...Object.values(TalonStatus).map((s) => ({ value: s, label: TalonStatusLabel[s] }))]}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ maxWidth: 220 }}
          />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(t) => t.id} loading={isLoading} emptyText="Талонов нет" />
        <LoadMore hasMore={!!hasNextPage} loading={isFetchingNextPage} onLoad={() => fetchNextPage()} />
      </Card>

      {createOpen && <TalonCreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function TalonCreateModal({ onClose }: { onClose: () => void }) {
  const { data: orders } = useQuery({
    queryKey: ['orders', 'active-for-talon'],
    queryFn: () => fetchOrders({ pageSize: 100 }),
  });
  const { data: vehicles } = useQuery({ queryKey: ['vehicles', 'dump'], queryFn: () => fetchVehicles({ type: VehicleType.DUMP_TRUCK }) });
  const { data: drivers } = useQuery({ queryKey: ['drivers', 'dump'], queryFn: () => fetchDrivers('DUMP_TRUCK_DRIVER') });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<CreateTalonInput>({
    resolver: zodResolver(createTalonSchema),
    defaultValues: { deliveryType: DeliveryType.DELIVERY, quantity: 1 },
  });

  const orderId = watch('orderId');
  const deliveryType = watch('deliveryType');
  const activeOrders = (orders?.items ?? []).filter((o: OrderDto) => ['CONFIRMED', 'READY', 'SHIPPING'].includes(o.status));
  const selectedOrder = activeOrders.find((o) => o.id === orderId);

  const createMut = useOptimisticMutation<TalonDto, CreateTalonInput>({
    mutationFn: createTalon,
    // Выдача талона списывает склад и переводит заказ в SHIPPING — обновляем и склад, и заказы.
    queryKeys: [talonKeys.all, warehouseKeys.all, orderKeys.all],
    successMessage: 'Талон выдан',
    onDone: () => onClose(),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Выдать талон"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button loading={createMut.isPending} onClick={handleSubmit((d) => createMut.mutate(d))}>Выдать</Button>
        </>
      }
    >
      <Field label="Заказ" error={errors.orderId?.message} required>
        <Select
          placeholder="Выберите активный заказ"
          options={activeOrders.map((o) => ({ value: o.id, label: `№${o.number} · ${o.clientName}` }))}
          {...register('orderId')}
        />
      </Field>
      <Field label="Фракция" error={errors.productId?.message} required>
        <Select
          placeholder={selectedOrder ? 'Позиция заказа' : 'Сначала выберите заказ'}
          options={(selectedOrder?.items ?? []).map((it) => ({ value: it.productId, label: `${it.productName} (заказано ${num(it.quantity)}, отгружено ${num(it.shippedQty)})` }))}
          {...register('productId')}
        />
      </Field>
      <Field label="Количество, м³" error={errors.quantity?.message} required>
        <Input type="number" step="0.001" {...register('quantity', { valueAsNumber: true })} />
      </Field>
      <Field label="Тип доставки" required>
        <Select options={Object.values(DeliveryType).map((d) => ({ value: d, label: DeliveryTypeLabel[d] }))} {...register('deliveryType')} />
      </Field>

      {deliveryType === 'DELIVERY' ? (
        <>
          <Field label="Машина" error={errors.vehicleId?.message} required>
            <Select placeholder="Самосвал" options={(vehicles ?? []).map((v) => ({ value: v.id, label: v.name }))} {...register('vehicleId')} />
          </Field>
          <Field label="Водитель" error={errors.driverId?.message} required>
            <Select placeholder="Шофёр" options={(drivers?.items ?? []).map((u) => ({ value: u.id, label: u.fullName }))} {...register('driverId')} />
          </Field>
        </>
      ) : (
        <Field label="Номер машины клиента" error={errors.clientVehiclePlate?.message} required>
          <Input placeholder="01A123BC" {...register('clientVehiclePlate')} />
        </Field>
      )}
    </Modal>
  );
}

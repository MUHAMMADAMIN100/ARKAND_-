import { useState } from 'react';
import { clsx } from 'clsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  createFuelLogSchema,
  createMaintenanceSchema,
  createTripSchema,
  createVehicleSchema,
  MaintenanceType,
  MaintenanceTypeLabel,
  Role,
  TripType,
  TripTypeLabel,
  VehicleType,
  VehicleTypeLabel,
  type CreateFuelLogInput,
  type CreateMaintenanceInput,
  type CreateTripInput,
  type CreateVehicleInput,
  type FuelLogDto,
  type MaintenanceDto,
  type Paginated,
  type TripDto,
  type UpdateVehicleInput,
  type UserDto,
  type VehicleDto,
} from '@sheben/shared';
import {
  fleetKeys,
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  fetchMaintenance,
  createMaintenance,
  fetchFuelLogs,
  createFuelLog,
  fetchTrips,
  createTrip,
  type FuelListParams,
  type MaintenanceListParams,
  type TripListParams,
} from '../../entities/fleet/api';
import { userKeys, fetchUsers } from '../../entities/user/api';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusChip,
  Textarea,
  Toolbar,
  money,
  qty,
  formatDate,
  todayISO,
  optionalNumber,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './FleetPage.module.css';

type TabKey = 'vehicles' | 'trips' | 'maintenance' | 'fuel';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'vehicles', label: 'Техника' },
  { key: 'trips', label: 'Рейсы' },
  { key: 'maintenance', label: 'ТО/ремонты' },
  { key: 'fuel', label: 'Солярка' },
];

const PAGE_SIZE = 20;

export function FleetPage() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<TabKey>('vehicles');

  const canManageVehicles = hasRole('OWNER', 'ADMIN', 'MECHANIC');
  const canManageMaintenance = hasRole('MECHANIC', 'OWNER', 'ADMIN');
  const canManageFuel = hasRole('OWNER', 'ADMIN', 'OPERATOR', 'MECHANIC', 'DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER');
  const canAddTrip = hasRole('OWNER', 'ADMIN', 'OPERATOR', 'DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER');

  // Общий справочник машин — используется на всех вкладках (карточки + фильтры/селекты форм).
  const { data: vehicles = [] } = useQuery({
    queryKey: fleetKeys.vehicles({}),
    queryFn: () => fetchVehicles(),
  });

  // Справочник водителей самосвалов — для фильтра и выбора при создании рейса.
  const {
    data: driversResp,
    isError: driversError,
  } = useQuery({
    queryKey: userKeys.list({ role: Role.DUMP_TRUCK_DRIVER, pageSize: 100 }),
    queryFn: () => fetchUsers({ role: Role.DUMP_TRUCK_DRIVER, pageSize: 100 }),
  });
  const drivers = driversResp?.items ?? [];

  return (
    <div>
      <PageHeader title="Техника" subtitle="Машины, рейсы, ТО и солярка" />

      <div className={clsx(styles.tabs, 'scroll-x')}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={clsx(styles.tab, tab === t.key && styles.tabActive)}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vehicles' && <VehiclesTab vehicles={vehicles} canManage={canManageVehicles} />}
      {tab === 'trips' && (
        <TripsTab vehicles={vehicles} drivers={drivers} driversError={driversError} canAdd={canAddTrip} />
      )}
      {tab === 'maintenance' && <MaintenanceTab vehicles={vehicles} canAdd={canManageMaintenance} />}
      {tab === 'fuel' && <FuelTab vehicles={vehicles} canAdd={canManageFuel} />}
    </div>
  );
}

// ==================== Вкладка «Техника» ====================

function VehiclesTab({ vehicles, canManage }: { vehicles: VehicleDto[]; canManage: boolean }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDto | null>(null);
  const listKey = fleetKeys.vehicles({});

  const createMut = useOptimisticMutation<VehicleDto, CreateVehicleInput, VehicleDto[]>({
    mutationFn: createVehicle,
    queryKeys: [listKey],
    updater: (old, vars) => [
      ...(old ?? []),
      {
        id: `tmp-${Date.now()}`,
        name: vars.name,
        type: vars.type,
        plate: vars.plate ?? null,
        isActive: true,
        fuelCost30d: 0,
        maintenanceCost30d: 0,
      },
    ],
    successMessage: 'Машина добавлена',
    onDone: () => closeModal(),
  });

  const updateMut = useOptimisticMutation<VehicleDto, { id: string; input: UpdateVehicleInput }, VehicleDto[]>({
    mutationFn: ({ id, input }) => updateVehicle(id, input),
    queryKeys: [listKey],
    updater: (old, vars) => (old ?? []).map((v) => (v.id === vars.id ? { ...v, ...vars.input } : v)),
    successMessage: 'Сохранено',
    onDone: () => closeModal(),
  });

  const deactivateMut = useOptimisticMutation<VehicleDto, string, VehicleDto[]>({
    mutationFn: deleteVehicle,
    queryKeys: [listKey],
    updater: (old, id) => (old ?? []).map((v) => (v.id === id ? { ...v, isActive: false } : v)),
    successMessage: 'Машина деактивирована',
  });

  const reactivateMut = useOptimisticMutation<VehicleDto, string, VehicleDto[]>({
    mutationFn: (id) => updateVehicle(id, { isActive: true }),
    queryKeys: [listKey],
    updater: (old, id) => (old ?? []).map((v) => (v.id === id ? { ...v, isActive: true } : v)),
    successMessage: 'Машина активирована',
  });

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    void qc.invalidateQueries({ queryKey: fleetKeys.all });
  }

  return (
    <div>
      <Toolbar>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + Машина
          </Button>
        )}
      </Toolbar>

      {vehicles.length === 0 ? (
        <EmptyState title="Нет техники" hint="Добавьте первую машину" />
      ) : (
        <div className={styles.vehicleGrid}>
          {vehicles.map((v) => (
            <Card key={v.id} className={styles.vehicleCard}>
              <div className={styles.vehicleHead}>
                <div>
                  <div className={styles.vehicleName}>{v.name}</div>
                  <div className={styles.vehicleMeta}>
                    {VehicleTypeLabel[v.type]}
                    {v.plate ? ` · ${v.plate}` : ''}
                  </div>
                </div>
                {!v.isActive && <StatusChip value="CANCELLED" label="неактивна" />}
              </div>
              <dl className={styles.vehicleStats}>
                <div className={styles.statRow}>
                  <dt>Солярка за 30 дней</dt>
                  <dd className="tnum">{money(v.fuelCost30d ?? 0)}</dd>
                </div>
                <div className={styles.statRow}>
                  <dt>Ремонты за 30 дней</dt>
                  <dd className="tnum">{money(v.maintenanceCost30d ?? 0)}</dd>
                </div>
              </dl>
              {canManage && (
                <div className={styles.vehicleActions}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(v);
                      setModalOpen(true);
                    }}
                  >
                    Редактировать
                  </Button>
                  {v.isActive ? (
                    <Button size="sm" variant="ghost" onClick={() => deactivateMut.mutate(v.id)}>
                      Деактивировать
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => reactivateMut.mutate(v.id)}>
                      Активировать
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <VehicleModal
          vehicle={editing}
          onClose={closeModal}
          onCreate={(input) => createMut.mutate(input)}
          onUpdate={(id, input) => updateMut.mutate({ id, input })}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}

function VehicleModal({
  vehicle,
  onClose,
  onCreate,
  onUpdate,
  saving,
}: {
  vehicle: VehicleDto | null;
  onClose: () => void;
  onCreate: (input: CreateVehicleInput) => void;
  onUpdate: (id: string, input: CreateVehicleInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema),
    defaultValues: vehicle
      ? { name: vehicle.name, type: vehicle.type, plate: vehicle.plate ?? undefined }
      : { type: VehicleType.DUMP_TRUCK },
  });

  const submit = (data: CreateVehicleInput) => {
    if (vehicle) onUpdate(vehicle.id, data);
    else onCreate(data);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={vehicle ? 'Редактировать машину' : 'Новая машина'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(submit)} loading={saving}>
            Сохранить
          </Button>
        </>
      }
    >
      <Field label="Название" error={errors.name?.message} required>
        <Input placeholder="КамАЗ-1" {...register('name')} />
      </Field>
      <Field label="Тип техники" error={errors.type?.message} required>
        <Select
          options={Object.values(VehicleType).map((t) => ({ value: t, label: VehicleTypeLabel[t] }))}
          {...register('type')}
        />
      </Field>
      <Field label="Гос. номер" error={errors.plate?.message}>
        <Input placeholder="01 A 123 AA" {...register('plate')} />
      </Field>
    </Modal>
  );
}

// ==================== Вкладка «Рейсы» ====================

function TripsTab({
  vehicles,
  drivers,
  driversError,
  canAdd,
}: {
  vehicles: VehicleDto[];
  drivers: UserDto[];
  driversError: boolean;
  canAdd: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const params: TripListParams = {
    vehicleId: vehicleFilter || undefined,
    driverId: driverFilter || undefined,
    type: (typeFilter || undefined) as TripType | undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const listKey = fleetKeys.trips(params);

  const { data, isLoading } = useQuery({ queryKey: listKey, queryFn: () => fetchTrips(params) });
  const trips = data?.items ?? [];
  const total = data?.total ?? 0;

  const createMut = useOptimisticMutation<TripDto, CreateTripInput, Paginated<TripDto>>({
    mutationFn: createTrip,
    queryKeys: [listKey],
    updater: (old, vars) => {
      if (!old) return old;
      const vehicle = vehicles.find((v) => v.id === vars.vehicleId);
      const driver = drivers.find((d) => d.id === vars.driverId);
      const temp: TripDto = {
        id: `tmp-${Date.now()}`,
        vehicleId: vars.vehicleId,
        vehicleName: vehicle?.name ?? '',
        driverId: vars.driverId,
        driverName: driver?.fullName ?? '',
        type: vars.type,
        date: vars.date,
        quantity: vars.quantity ?? null,
        talonId: vars.talonId ?? null,
        talonNumber: null,
        note: vars.note ?? null,
        enteredById: '',
        createdAt: new Date().toISOString(),
      };
      return { ...old, items: [temp, ...old.items], total: old.total + 1 };
    },
    successMessage: 'Рейс добавлен',
    onDone: () => closeModal(),
  });

  // Рейс не влияет ни на справочник машин (fuelCost30d/maintenanceCost30d считаются
  // из fuel_logs/maintenance_records, не из trips), ни на ТО/солярку — инвалидировать
  // весь fleetKeys.all незачем. Список рейсов уже точечно обновляется мутацией выше
  // (queryKeys: [listKey]) — здесь только закрываем модалку.
  function closeModal() {
    setModalOpen(false);
  }

  const columns: Column<TripDto>[] = [
    { key: 'date', header: 'Дата', primary: true, render: (t) => formatDate(t.date) },
    { key: 'vehicle', header: 'Машина', render: (t) => t.vehicleName },
    { key: 'driver', header: 'Водитель', render: (t) => t.driverName },
    { key: 'type', header: 'Тип', render: (t) => TripTypeLabel[t.type] },
    {
      key: 'volume',
      header: 'Объём/талон',
      align: 'right',
      render: (t) =>
        t.type === TripType.RAW_HAUL ? qty(t.quantity) : t.talonNumber ? `Талон №${t.talonNumber}` : '—',
    },
  ];

  return (
    <div>
      <Toolbar>
        <div className={styles.filterItem}>
          <Select
            options={[{ value: '', label: 'Все машины' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]}
            value={vehicleFilter}
            onChange={(e) => {
              setVehicleFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className={styles.filterItem}>
          <Select
            options={[{ value: '', label: 'Все водители' }, ...drivers.map((d) => ({ value: d.id, label: d.fullName }))]}
            value={driverFilter}
            onChange={(e) => {
              setDriverFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className={styles.filterItem}>
          <Select
            options={[
              { value: '', label: 'Все типы' },
              ...Object.values(TripType).map((t) => ({ value: t, label: TripTypeLabel[t] })),
            ]}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {canAdd && <Button onClick={() => setModalOpen(true)}>+ Рейс</Button>}
      </Toolbar>

      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable columns={columns} rows={trips} rowKey={(t) => t.id} loading={isLoading} emptyText="Нет рейсов" />
        </div>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {modalOpen && (
        <TripModal
          vehicles={vehicles.filter((v) => v.isActive)}
          drivers={drivers}
          driversError={driversError}
          onClose={closeModal}
          onCreate={(input) => createMut.mutate(input)}
          saving={createMut.isPending}
        />
      )}
    </div>
  );
}

function TripModal({
  vehicles,
  drivers,
  driversError,
  onClose,
  onCreate,
  saving,
}: {
  vehicles: VehicleDto[];
  drivers: UserDto[];
  driversError: boolean;
  onClose: () => void;
  onCreate: (input: CreateTripInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { type: TripType.RAW_HAUL, date: todayISO() },
  });

  const type = watch('type');

  return (
    <Modal
      open
      onClose={onClose}
      title="Новый рейс"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(onCreate)} loading={saving}>
            Сохранить
          </Button>
        </>
      }
    >
      <Field label="Тип рейса" error={errors.type?.message} required>
        <Select options={Object.values(TripType).map((t) => ({ value: t, label: TripTypeLabel[t] }))} {...register('type')} />
      </Field>
      <Field label="Машина" error={errors.vehicleId?.message} required>
        <Select
          placeholder="Выберите машину"
          options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
          {...register('vehicleId')}
        />
      </Field>
      <Field
        label="Водитель"
        error={driversError ? 'Не удалось загрузить список водителей (недостаточно прав)' : errors.driverId?.message}
        required
      >
        <Select
          placeholder="Выберите водителя"
          options={drivers.map((d) => ({ value: d.id, label: d.fullName }))}
          {...register('driverId')}
        />
      </Field>
      <Field label="Дата" error={errors.date?.message} required>
        <Input type="date" {...register('date')} />
      </Field>
      {type === TripType.RAW_HAUL && (
        <Field label="Объём породы (м³)" error={errors.quantity?.message} required>
          <Input type="number" step="0.001" {...register('quantity', optionalNumber)} />
        </Field>
      )}
      {type === TripType.DELIVERY && (
        <Field label="ID талона" error={errors.talonId?.message} hint="Идентификатор талона (UUID)" required>
          <Input placeholder="00000000-0000-0000-0000-000000000000" {...register('talonId')} />
        </Field>
      )}
      <Field label="Примечание" error={errors.note?.message}>
        <Textarea rows={2} {...register('note')} />
      </Field>
    </Modal>
  );
}

// ==================== Вкладка «ТО/ремонты» ====================

function MaintenanceTab({ vehicles, canAdd }: { vehicles: VehicleDto[]; canAdd: boolean }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params: MaintenanceListParams = {
    vehicleId: vehicleFilter || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const listKey = fleetKeys.maintenance(params);

  const { data, isLoading } = useQuery({ queryKey: listKey, queryFn: () => fetchMaintenance(params) });
  const records = data?.items ?? [];
  const total = data?.total ?? 0;

  const createMut = useOptimisticMutation<MaintenanceDto, CreateMaintenanceInput, Paginated<MaintenanceDto>>({
    mutationFn: createMaintenance,
    queryKeys: [listKey],
    updater: (old, vars) => {
      if (!old) return old;
      const vehicle = vehicles.find((v) => v.id === vars.vehicleId);
      const temp: MaintenanceDto = {
        id: `tmp-${Date.now()}`,
        vehicleId: vars.vehicleId,
        vehicleName: vehicle?.name ?? '',
        type: vars.type,
        description: vars.description,
        cost: vars.cost,
        date: vars.date,
        mechanicId: '',
        mechanicName: '',
        createdAt: new Date().toISOString(),
      };
      return { ...old, items: [temp, ...old.items], total: old.total + 1 };
    },
    successMessage: 'Запись добавлена',
    onDone: () => closeModal(),
  });

  // Новая запись ТО меняет maintenanceCost30d на вкладке «Техника» — обновляем только
  // список машин, а не весь fleetKeys.all (список рейсов и солярки эта запись не трогает).
  function closeModal() {
    setModalOpen(false);
    void qc.invalidateQueries({ queryKey: fleetKeys.vehicles({}) });
  }

  const columns: Column<MaintenanceDto>[] = [
    { key: 'date', header: 'Дата', primary: true, render: (m) => formatDate(m.date) },
    { key: 'vehicle', header: 'Машина', render: (m) => m.vehicleName },
    { key: 'type', header: 'Тип', render: (m) => MaintenanceTypeLabel[m.type] },
    { key: 'description', header: 'Описание', render: (m) => m.description },
    { key: 'cost', header: 'Стоимость', align: 'right', render: (m) => money(m.cost) },
  ];

  return (
    <div>
      <Toolbar>
        <div className={styles.filterItem}>
          <Select
            options={[{ value: '', label: 'Все машины' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]}
            value={vehicleFilter}
            onChange={(e) => {
              setVehicleFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className={styles.filterItem}>
          <Input
            type="date"
            aria-label="С даты"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className={styles.filterItem}>
          <Input
            type="date"
            aria-label="По дату"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {canAdd && <Button onClick={() => setModalOpen(true)}>+ Запись</Button>}
      </Toolbar>

      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable
            columns={columns}
            rows={records}
            rowKey={(m) => m.id}
            loading={isLoading}
            emptyText="Нет записей ТО/ремонтов"
          />
        </div>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {modalOpen && (
        <MaintenanceModal
          vehicles={vehicles.filter((v) => v.isActive)}
          onClose={closeModal}
          onCreate={(input) => createMut.mutate(input)}
          saving={createMut.isPending}
        />
      )}
    </div>
  );
}

function MaintenanceModal({
  vehicles,
  onClose,
  onCreate,
  saving,
}: {
  vehicles: VehicleDto[];
  onClose: () => void;
  onCreate: (input: CreateMaintenanceInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateMaintenanceInput>({
    resolver: zodResolver(createMaintenanceSchema),
    defaultValues: { type: MaintenanceType.SERVICE, date: todayISO() },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Новая запись ТО/ремонта"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(onCreate)} loading={saving}>
            Сохранить
          </Button>
        </>
      }
    >
      <Field label="Машина" error={errors.vehicleId?.message} required>
        <Select
          placeholder="Выберите машину"
          options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
          {...register('vehicleId')}
        />
      </Field>
      <Field label="Тип" error={errors.type?.message} required>
        <Select
          options={Object.values(MaintenanceType).map((t) => ({ value: t, label: MaintenanceTypeLabel[t] }))}
          {...register('type')}
        />
      </Field>
      <Field label="Описание работ" error={errors.description?.message} required>
        <Textarea rows={3} placeholder="Замена масла, фильтров…" {...register('description')} />
      </Field>
      <Field label="Стоимость" error={errors.cost?.message} required>
        <Input type="number" step="0.01" {...register('cost', { valueAsNumber: true })} />
      </Field>
      <Field label="Дата" error={errors.date?.message} required>
        <Input type="date" {...register('date')} />
      </Field>
    </Modal>
  );
}

// ==================== Вкладка «Солярка» ====================

function FuelTab({ vehicles, canAdd }: { vehicles: VehicleDto[]; canAdd: boolean }) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const params: FuelListParams = {
    vehicleId: vehicleFilter || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const listKey = fleetKeys.fuel(params);

  const { data, isLoading } = useQuery({ queryKey: listKey, queryFn: () => fetchFuelLogs(params) });
  const logs = data?.items ?? [];
  const total = data?.total ?? 0;

  const createMut = useOptimisticMutation<FuelLogDto, CreateFuelLogInput, Paginated<FuelLogDto>>({
    mutationFn: createFuelLog,
    queryKeys: [listKey],
    updater: (old, vars) => {
      if (!old) return old;
      const vehicle = vehicles.find((v) => v.id === vars.vehicleId);
      const temp: FuelLogDto = {
        id: `tmp-${Date.now()}`,
        vehicleId: vars.vehicleId,
        vehicleName: vehicle?.name ?? '',
        liters: vars.liters,
        cost: vars.cost,
        date: vars.date,
        byUserId: '',
        byUserName: '',
        note: vars.note ?? null,
      };
      return { ...old, items: [temp, ...old.items], total: old.total + 1 };
    },
    successMessage: 'Заправка добавлена',
    onDone: () => closeModal(),
  });

  // Новая заправка меняет fuelCost30d на вкладке «Техника» — обновляем только список
  // машин, а не весь fleetKeys.all (список рейсов и ТО эта запись не трогает).
  function closeModal() {
    setModalOpen(false);
    void qc.invalidateQueries({ queryKey: fleetKeys.vehicles({}) });
  }

  const columns: Column<FuelLogDto>[] = [
    { key: 'date', header: 'Дата', primary: true, render: (f) => formatDate(f.date) },
    { key: 'vehicle', header: 'Машина', render: (f) => f.vehicleName },
    { key: 'liters', header: 'Литры', align: 'right', render: (f) => qty(f.liters, 'л') },
    { key: 'cost', header: 'Стоимость', align: 'right', render: (f) => money(f.cost) },
  ];

  return (
    <div>
      <Toolbar>
        <div className={styles.filterItem}>
          <Select
            options={[{ value: '', label: 'Все машины' }, ...vehicles.map((v) => ({ value: v.id, label: v.name }))]}
            value={vehicleFilter}
            onChange={(e) => {
              setVehicleFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className={styles.filterItem}>
          <Input
            type="date"
            aria-label="С даты"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className={styles.filterItem}>
          <Input
            type="date"
            aria-label="По дату"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {canAdd && <Button onClick={() => setModalOpen(true)}>+ Заправка</Button>}
      </Toolbar>

      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable columns={columns} rows={logs} rowKey={(f) => f.id} loading={isLoading} emptyText="Нет заправок" />
        </div>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {modalOpen && (
        <FuelModal
          vehicles={vehicles.filter((v) => v.isActive)}
          onClose={closeModal}
          onCreate={(input) => createMut.mutate(input)}
          saving={createMut.isPending}
        />
      )}
    </div>
  );
}

function FuelModal({
  vehicles,
  onClose,
  onCreate,
  saving,
}: {
  vehicles: VehicleDto[];
  onClose: () => void;
  onCreate: (input: CreateFuelLogInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFuelLogInput>({
    resolver: zodResolver(createFuelLogSchema),
    defaultValues: { date: todayISO() },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Новая заправка"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(onCreate)} loading={saving}>
            Сохранить
          </Button>
        </>
      }
    >
      <Field label="Машина" error={errors.vehicleId?.message} required>
        <Select
          placeholder="Выберите машину"
          options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
          {...register('vehicleId')}
        />
      </Field>
      <Field label="Литры" error={errors.liters?.message} required>
        <Input type="number" step="0.001" {...register('liters', { valueAsNumber: true })} />
      </Field>
      <Field label="Стоимость" error={errors.cost?.message} required>
        <Input type="number" step="0.01" {...register('cost', { valueAsNumber: true })} />
      </Field>
      <Field label="Дата" error={errors.date?.message} required>
        <Input type="date" {...register('date')} />
      </Field>
      <Field label="Примечание" error={errors.note?.message}>
        <Textarea rows={2} {...register('note')} />
      </Field>
    </Modal>
  );
}

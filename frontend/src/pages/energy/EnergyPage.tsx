import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import { createElectricityLogSchema, type CreateElectricityLogInput, type ElectricityLogDto } from '@sheben/shared';
import {
  energyKeys,
  fetchElectricityLogs,
  createElectricityLog,
  updateElectricityLog,
  deleteElectricityLog,
} from '../../entities/energy/api';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  money,
  num,
  formatMonth,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';

export function EnergyPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('OPERATOR', 'OWNER', 'ADMIN');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ElectricityLogDto | null>(null);

  const { data: logs = [], isLoading } = useQuery({ queryKey: energyKeys.list(), queryFn: fetchElectricityLogs });

  const deleteMut = useOptimisticMutation<{ ok: true }, string, ElectricityLogDto[]>({
    mutationFn: deleteElectricityLog,
    queryKeys: [energyKeys.list()],
    updater: (old, id) => (old ?? []).filter((l) => l.id !== id),
    successMessage: 'Запись удалена',
  });

  const columns: Column<ElectricityLogDto>[] = [
    { key: 'month', header: 'Месяц', primary: true, render: (l) => formatMonth(l.month) },
    { key: 'kwh', header: 'кВт·ч', align: 'right', render: (l) => num(l.kwh) },
    { key: 'cost', header: 'Стоимость', align: 'right', render: (l) => money(l.cost) },
    { key: 'output', header: 'Выпуск, м³', align: 'right', render: (l) => num(l.monthOutput) },
    {
      key: 'unit',
      header: 'Уд. расход',
      align: 'right',
      render: (l) => (l.monthOutput > 0 ? money(l.cost / l.monthOutput) + '/м³' : '—'),
      hideOnMobile: true,
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (l: ElectricityLogDto) => (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Button size="sm" variant="secondary" aria-label="Изменить" onClick={() => { setEditing(l); setModalOpen(true); }}><FiEdit2 /></Button>
                <Button size="sm" variant="ghost" aria-label="Удалить" onClick={() => deleteMut.mutate(l.id)}><FiTrash2 /></Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Электроэнергия"
        subtitle="Показания по месяцам (дробилка)"
        actions={canEdit && <Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Показания</Button>}
      />
      <Card padded>
        <DataTable columns={columns} rows={logs} rowKey={(l) => l.id} loading={isLoading} emptyText="Нет показаний" />
      </Card>
      {modalOpen && <EnergyModal log={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />}
    </div>
  );
}

function EnergyModal({ log, onClose }: { log: ElectricityLogDto | null; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<CreateElectricityLogInput>({
    resolver: zodResolver(createElectricityLogSchema),
    defaultValues: log ? { month: log.month.slice(0, 10), kwh: log.kwh, cost: log.cost, note: log.note ?? undefined } : undefined,
  });

  const createMut = useOptimisticMutation<ElectricityLogDto, CreateElectricityLogInput>({
    mutationFn: createElectricityLog,
    queryKeys: [energyKeys.list()],
    successMessage: 'Показания сохранены',
    onDone: onClose,
  });
  const updateMut = useOptimisticMutation<ElectricityLogDto, CreateElectricityLogInput>({
    mutationFn: (input) => updateElectricityLog(log!.id, input),
    queryKeys: [energyKeys.list()],
    successMessage: 'Сохранено',
    onDone: onClose,
  });

  const submit = (d: CreateElectricityLogInput) => (log ? updateMut.mutate(d) : createMut.mutate(d));

  return (
    <Modal
      open
      onClose={onClose}
      title={log ? 'Изменить показания' : 'Показания электроэнергии'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button loading={createMut.isPending || updateMut.isPending} onClick={handleSubmit(submit)}>Сохранить</Button>
        </>
      }
    >
      <Field label="Месяц" error={errors.month?.message} required hint="Любая дата месяца — приведётся к первому числу">
        <Input type="date" {...register('month')} />
      </Field>
      <Field label="кВт·ч" error={errors.kwh?.message} required>
        <Input type="number" step="0.001" {...register('kwh', { valueAsNumber: true })} />
      </Field>
      <Field label="Стоимость, смн" error={errors.cost?.message} required>
        <Input type="number" step="0.01" {...register('cost', { valueAsNumber: true })} />
      </Field>
    </Modal>
  );
}

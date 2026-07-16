import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  createClientSchema,
  ClientType,
  ClientTypeLabel,
  type CreateClientInput,
  type ClientDto,
} from '@sheben/shared';
import type { Paginated } from '@sheben/shared';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { clientKeys, fetchClients, createClient, updateClient, deleteClient } from '../../entities/client/api';
import {
  Button,
  Card,
  DataTable,
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
  useDebounce,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';

const PAGE_SIZE = 20;

export function ClientsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('OWNER', 'ADMIN', 'OPERATOR', 'SALES_MANAGER');
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDto | null>(null);

  const [typeFilter, setTypeFilter] = useState<ClientType | ''>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);

  const queryParams = { type: typeFilter, search: debouncedSearch, page, pageSize: PAGE_SIZE };
  const listKey = clientKeys.list(queryParams);

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchClients(queryParams),
  });

  const clients = data?.items ?? [];
  const total = data?.total ?? 0;

  function changeType(value: ClientType | '') {
    setTypeFilter(value);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  const createMut = useOptimisticMutation<ClientDto, CreateClientInput, Paginated<ClientDto>>({
    mutationFn: createClient,
    queryKeys: [listKey],
    updater: (old, vars) => {
      if (!old) return old;
      const tmp: ClientDto = {
        id: `tmp-${Date.now()}`,
        name: vars.name,
        type: vars.type ?? ClientType.EXTERNAL,
        phone: vars.phone ?? null,
        note: vars.note ?? null,
        isActive: true,
        debtBalance: 0,
        createdAt: new Date().toISOString(),
      };
      return { ...old, items: [tmp, ...old.items].slice(0, old.pageSize), total: old.total + 1 };
    },
    successMessage: 'Клиент добавлен',
    onDone: () => closeModal(),
  });

  const updateMut = useOptimisticMutation<ClientDto, { id: string; input: CreateClientInput }, Paginated<ClientDto>>({
    mutationFn: ({ id, input }) => updateClient(id, input),
    queryKeys: [listKey],
    updater: (old, vars) =>
      old ? { ...old, items: old.items.map((c) => (c.id === vars.id ? { ...c, ...vars.input } : c)) } : old,
    successMessage: 'Сохранено',
    onDone: () => closeModal(),
  });

  const deleteMut = useOptimisticMutation<void, string, Paginated<ClientDto>>({
    mutationFn: deleteClient,
    queryKeys: [listKey],
    updater: (old, id) =>
      old ? { ...old, items: old.items.map((c) => (c.id === id ? { ...c, isActive: false } : c)) } : old,
    successMessage: 'Клиент деактивирован',
  });

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    void qc.invalidateQueries({ queryKey: clientKeys.all });
  }

  const columns: Column<ClientDto>[] = [
    {
      key: 'name',
      header: 'Имя / название',
      primary: true,
      render: (c) => (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {c.name}
          {!c.isActive && <StatusChip value="CANCELLED" label="неактивен" />}
        </span>
      ),
    },
    { key: 'type', header: 'Тип', render: (c) => ClientTypeLabel[c.type] },
    { key: 'phone', header: 'Телефон', render: (c) => c.phone ?? '—' },
    {
      key: 'debtBalance',
      header: 'Баланс долга',
      align: 'right',
      render: (c) => (c.type === ClientType.INTERNAL ? money(c.debtBalance) : '—'),
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (c: ClientDto) => (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(c);
                    setModalOpen(true);
                  }}
                  aria-label="Изменить"
                >
                  <FiEdit2 />
                </Button>
                {c.isActive && (
                  <Button size="sm" variant="ghost" aria-label="Деактивировать" onClick={() => deleteMut.mutate(c.id)}>
                    <FiTrash2 />
                  </Button>
                )}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Клиенты"
        subtitle="Внешние и внутренние клиенты"
        actions={
          canEdit && (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              + Клиент
            </Button>
          )
        }
      />

      <Toolbar>
        <Select
          value={typeFilter}
          onChange={(e) => changeType(e.target.value as ClientType | '')}
          options={[
            { value: '', label: 'Все типы' },
            ...Object.values(ClientType).map((t) => ({ value: t, label: ClientTypeLabel[t] })),
          ]}
        />
        <Input
          placeholder="Поиск по имени/телефону"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
        />
      </Toolbar>

      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable
            columns={columns}
            rows={clients}
            rowKey={(c) => c.id}
            loading={isLoading}
            emptyText="Клиенты не найдены"
            footer={<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
          />
        </div>
      </Card>

      {modalOpen && (
        <ClientModal
          client={editing}
          onClose={closeModal}
          onCreate={(input) => createMut.mutate(input)}
          onUpdate={(id, input) => updateMut.mutate({ id, input })}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}

function ClientModal({
  client,
  onClose,
  onCreate,
  onUpdate,
  saving,
}: {
  client: ClientDto | null;
  onClose: () => void;
  onCreate: (input: CreateClientInput) => void;
  onUpdate: (id: string, input: CreateClientInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: client
      ? {
          name: client.name,
          type: client.type,
          phone: client.phone ?? undefined,
          note: client.note ?? undefined,
        }
      : { type: ClientType.EXTERNAL },
  });

  const submit = (data: CreateClientInput) => {
    if (client) onUpdate(client.id, data);
    else onCreate(data);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={client ? 'Редактировать клиента' : 'Новый клиент'}
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
      <Field label="Название / имя" error={errors.name?.message} required>
        <Input placeholder="ООО «Ромашка»" {...register('name')} />
      </Field>
      <Field label="Тип" error={errors.type?.message} required>
        <Select
          options={Object.values(ClientType).map((t) => ({ value: t, label: ClientTypeLabel[t] }))}
          {...register('type')}
        />
      </Field>
      <Field label="Телефон" error={errors.phone?.message}>
        <Input placeholder="+992 900 00 00 00" {...register('phone')} />
      </Field>
      <Field label="Примечание" error={errors.note?.message}>
        <Textarea rows={3} {...register('note')} />
      </Field>
    </Modal>
  );
}

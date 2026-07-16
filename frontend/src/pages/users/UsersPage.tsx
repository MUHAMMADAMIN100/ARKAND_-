import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  Role,
  RoleLabel,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetPasswordInput,
  type UserDto,
} from '@sheben/shared';
import type { Paginated } from '@sheben/shared';
import {
  userKeys,
  fetchUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '../../entities/user/api';
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
  Toolbar,
  useDebounce,
  useOptimisticMutation,
  type Column,
} from '../../shared';
const PAGE_SIZE = 20;

export function UsersPage() {
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null);

  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);

  const queryParams = { role: roleFilter, search: debouncedSearch, page, pageSize: PAGE_SIZE };
  const listKey = userKeys.list(queryParams);

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchUsers(queryParams),
  });

  const users = data?.items ?? [];
  const total = data?.total ?? 0;

  function changeRole(value: Role | '') {
    setRoleFilter(value);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  const createMut = useOptimisticMutation<UserDto, CreateUserInput, Paginated<UserDto>>({
    mutationFn: createUser,
    queryKeys: [listKey],
    updater: (old, vars) => {
      if (!old) return old;
      const tmp: UserDto = {
        id: `tmp-${Date.now()}`,
        login: vars.login,
        fullName: vars.fullName,
        role: vars.role,
        phone: vars.phone ?? null,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      return { ...old, items: [tmp, ...old.items].slice(0, old.pageSize), total: old.total + 1 };
    },
    successMessage: 'Пользователь добавлен',
    onDone: () => closeModal(),
  });

  const updateMut = useOptimisticMutation<UserDto, { id: string; input: UpdateUserInput }, Paginated<UserDto>>({
    mutationFn: ({ id, input }) => updateUser(id, input),
    queryKeys: [listKey],
    updater: (old, vars) =>
      old ? { ...old, items: old.items.map((u) => (u.id === vars.id ? { ...u, ...vars.input } : u)) } : old,
    successMessage: 'Сохранено',
    onDone: () => closeModal(),
  });

  const deleteMut = useOptimisticMutation<void, string, Paginated<UserDto>>({
    mutationFn: deleteUser,
    queryKeys: [listKey],
    updater: (old, id) =>
      old ? { ...old, items: old.items.map((u) => (u.id === id ? { ...u, isActive: false } : u)) } : old,
    successMessage: 'Пользователь деактивирован',
  });

  const resetMut = useOptimisticMutation<void, { id: string; input: ResetPasswordInput }>({
    mutationFn: ({ id, input }) => resetUserPassword(id, input),
    queryKeys: [],
    successMessage: 'Пароль сброшен',
    onDone: () => setResetTarget(null),
  });

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    void qc.invalidateQueries({ queryKey: userKeys.all });
  }

  const columns: Column<UserDto>[] = [
    { key: 'fullName', header: 'ФИО', primary: true, render: (u) => u.fullName },
    { key: 'login', header: 'Логин', render: (u) => u.login },
    { key: 'role', header: 'Роль', render: (u) => RoleLabel[u.role] },
    { key: 'phone', header: 'Телефон', render: (u) => u.phone ?? '—' },
    {
      key: 'status',
      header: 'Статус',
      render: (u) =>
        u.isActive ? (
          <StatusChip value="COMPLETED" label="Активен" />
        ) : (
          <StatusChip value="CANCELLED" label="Неактивен" />
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (u: UserDto) => (
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(u);
              setModalOpen(true);
            }}
          >
            ✎
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setResetTarget(u)}>
            Сбросить пароль
          </Button>
          {u.isActive && (
            <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(u.id)}>
              🗑
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Пользователи"
        subtitle="Сотрудники и доступы"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            + Пользователь
          </Button>
        }
      />

      <Toolbar>
        <Select
          value={roleFilter}
          onChange={(e) => changeRole(e.target.value as Role | '')}
          options={[
            { value: '', label: 'Все роли' },
            ...Object.values(Role).map((r) => ({ value: r, label: RoleLabel[r] })),
          ]}
        />
        <Input
          placeholder="Поиск по ФИО/логину/телефону"
          value={search}
          onChange={(e) => changeSearch(e.target.value)}
        />
      </Toolbar>

      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable
            columns={columns}
            rows={users}
            rowKey={(u) => u.id}
            loading={isLoading}
            emptyText="Пользователи не найдены"
            footer={<Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
          />
        </div>
      </Card>

      {modalOpen &&
        (editing ? (
          <EditUserModal
            user={editing}
            onClose={closeModal}
            onSave={(id, input) => updateMut.mutate({ id, input })}
            saving={updateMut.isPending}
          />
        ) : (
          <CreateUserModal
            onClose={closeModal}
            onSave={(input) => createMut.mutate(input)}
            saving={createMut.isPending}
          />
        ))}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSave={(input) => resetMut.mutate({ id: resetTarget.id, input })}
          saving={resetMut.isPending}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (input: CreateUserInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: Role.OPERATOR },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Новый пользователь"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(onSave)} loading={saving}>
            Сохранить
          </Button>
        </>
      }
    >
      <Field label="Логин" error={errors.login?.message} required>
        <Input placeholder="ivanov" {...register('login')} />
      </Field>
      <Field label="Пароль" error={errors.password?.message} required>
        <Input type="password" placeholder="Минимум 8 символов" {...register('password')} />
      </Field>
      <Field label="ФИО" error={errors.fullName?.message} required>
        <Input placeholder="Иванов Иван Иванович" {...register('fullName')} />
      </Field>
      <Field label="Роль" error={errors.role?.message} required>
        <Select options={Object.values(Role).map((r) => ({ value: r, label: RoleLabel[r] }))} {...register('role')} />
      </Field>
      <Field label="Телефон" error={errors.phone?.message}>
        <Input placeholder="+992 900 00 00 00" {...register('phone')} />
      </Field>
    </Modal>
  );
}

function EditUserModal({
  user,
  onClose,
  onSave,
  saving,
}: {
  user: UserDto;
  onClose: () => void;
  onSave: (id: string, input: UpdateUserInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      fullName: user.fullName,
      role: user.role,
      phone: user.phone ?? undefined,
      isActive: user.isActive,
    },
  });

  const submit = (data: UpdateUserInput) => onSave(user.id, data);

  return (
    <Modal
      open
      onClose={onClose}
      title="Редактировать пользователя"
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
      <Field label="Логин">
        <Input value={user.login} disabled />
      </Field>
      <Field label="ФИО" error={errors.fullName?.message} required>
        <Input placeholder="Иванов Иван Иванович" {...register('fullName')} />
      </Field>
      <Field label="Роль" error={errors.role?.message} required>
        <Select options={Object.values(Role).map((r) => ({ value: r, label: RoleLabel[r] }))} {...register('role')} />
      </Field>
      <Field label="Телефон" error={errors.phone?.message}>
        <Input placeholder="+992 900 00 00 00" {...register('phone')} />
      </Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <input type="checkbox" {...register('isActive')} />
        Активен
      </label>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onSave,
  saving,
}: {
  user: UserDto;
  onClose: () => void;
  onSave: (input: ResetPasswordInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Сбросить пароль: ${user.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(onSave)} loading={saving}>
            Сбросить
          </Button>
        </>
      }
    >
      <Field label="Новый пароль" error={errors.newPassword?.message} required>
        <Input type="password" placeholder="Минимум 8 символов" {...register('newPassword')} />
      </Field>
    </Modal>
  );
}

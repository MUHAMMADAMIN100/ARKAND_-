import { http } from '../../shared/api/http';
import type {
  UserDto,
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordInput,
  Role,
  Paginated,
} from '@sheben/shared';

export interface UsersQuery {
  role?: Role | '';
  search?: string;
  page?: number;
  pageSize?: number;
}

export const userKeys = {
  all: ['users'] as const,
  list: (params?: UsersQuery) => ['users', 'list', params ?? {}] as const,
};

export function fetchUsers(params?: UsersQuery): Promise<Paginated<UserDto>> {
  return http.get<Paginated<UserDto>>('/users', {
    query: {
      role: params?.role || undefined,
      search: params?.search || undefined,
      page: params?.page,
      pageSize: params?.pageSize,
    },
  });
}

export function createUser(input: CreateUserInput): Promise<UserDto> {
  return http.post<UserDto>('/users', input);
}

export function updateUser(id: string, input: UpdateUserInput): Promise<UserDto> {
  return http.patch<UserDto>(`/users/${id}`, input);
}

export function resetUserPassword(id: string, input: ResetPasswordInput): Promise<void> {
  return http.post<void>(`/users/${id}/reset-password`, input);
}

export function deleteUser(id: string): Promise<void> {
  return http.delete<void>(`/users/${id}`);
}

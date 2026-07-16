import type { Role } from '@sheben/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: Role[]; // если пусто — доступно всем аутентифицированным
  /** Показывать в нижней мобильной навигации (до 5 главных). */
  primary?: boolean;
}

/** Единое меню приложения — используется и сайдбаром, и нижней навигацией. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: '📊', primary: true },
  { to: '/production', label: 'Производство', icon: '⛏️', primary: true, roles: ['OPERATOR', 'ASSISTANT_OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/orders', label: 'Заказы', icon: '📋', primary: true },
  { to: '/talons', label: 'Талоны', icon: '🎫', primary: true },
  { to: '/warehouse', label: 'Склад', icon: '📦', primary: true },
  { to: '/products', label: 'Продукция', icon: '🪨' },
  { to: '/clients', label: 'Клиенты', icon: '🤝' },
  { to: '/fleet', label: 'Техника', icon: '🚛', roles: ['MECHANIC', 'OPERATOR', 'DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER', 'OWNER', 'ADMIN'] },
  { to: '/energy', label: 'Электроэнергия', icon: '⚡', roles: ['OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/finance', label: 'Финансы', icon: '💰', roles: ['FINANCIER', 'OPERATOR', 'SALES_MANAGER', 'OWNER', 'ADMIN'] },
  { to: '/procurement', label: 'Снабжение', icon: '🛒', roles: ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/inventory', label: 'Инвентаризация', icon: '🔢', roles: ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/reports', label: 'Отчёты', icon: '📈', roles: ['OWNER', 'ADMIN'] },
  { to: '/users', label: 'Пользователи', icon: '👥', roles: ['OWNER', 'ADMIN'] },
];

export function navForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV.filter((item) => !item.roles || item.roles.includes(role));
}

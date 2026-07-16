import type { IconType } from 'react-icons';
import {
  FiGrid,
  FiTool,
  FiClipboard,
  FiTag,
  FiPackage,
  FiLayers,
  FiUsers,
  FiTruck,
  FiZap,
  FiDollarSign,
  FiShoppingCart,
  FiCheckSquare,
  FiBarChart2,
  FiUserCheck,
} from 'react-icons/fi';
import type { Role } from '@sheben/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: IconType;
  roles?: Role[]; // если пусто — доступно всем аутентифицированным
  /** Показывать в нижней мобильной навигации (до 5 главных). */
  primary?: boolean;
}

/** Единое меню приложения — используется и сайдбаром, и нижней навигацией. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: FiGrid, primary: true },
  { to: '/production', label: 'Производство', icon: FiTool, primary: true, roles: ['OPERATOR', 'ASSISTANT_OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/orders', label: 'Заказы', icon: FiClipboard, primary: true },
  { to: '/talons', label: 'Талоны', icon: FiTag, primary: true },
  { to: '/warehouse', label: 'Склад', icon: FiPackage, primary: true },
  { to: '/products', label: 'Продукция', icon: FiLayers },
  { to: '/clients', label: 'Клиенты', icon: FiUsers },
  { to: '/fleet', label: 'Техника', icon: FiTruck, roles: ['MECHANIC', 'OPERATOR', 'DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER', 'OWNER', 'ADMIN'] },
  { to: '/energy', label: 'Электроэнергия', icon: FiZap, roles: ['OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/finance', label: 'Финансы', icon: FiDollarSign, roles: ['FINANCIER', 'OPERATOR', 'SALES_MANAGER', 'OWNER', 'ADMIN'] },
  { to: '/procurement', label: 'Снабжение', icon: FiShoppingCart, roles: ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/inventory', label: 'Инвентаризация', icon: FiCheckSquare, roles: ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'] },
  { to: '/reports', label: 'Отчёты', icon: FiBarChart2, roles: ['OWNER', 'ADMIN'] },
  { to: '/users', label: 'Пользователи', icon: FiUserCheck, roles: ['OWNER', 'ADMIN'] },
];

export function navForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return NAV.filter((item) => !item.roles || item.roles.includes(role));
}

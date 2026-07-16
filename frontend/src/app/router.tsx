import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ProtectedRoute } from './layout/ProtectedRoute';
import { LoginPage } from '../pages/login/LoginPage';
import { LoadingBlock } from '../shared/ui/feedback/States';
import type { Role } from '@sheben/shared';

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProductionPage = lazy(() => import('../pages/production/ProductionPage').then((m) => ({ default: m.ProductionPage })));
const OrdersPage = lazy(() => import('../pages/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const TalonsPage = lazy(() => import('../pages/talons/TalonsPage').then((m) => ({ default: m.TalonsPage })));
const WarehousePage = lazy(() => import('../pages/warehouse/WarehousePage').then((m) => ({ default: m.WarehousePage })));
const ProductsPage = lazy(() => import('../pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const ClientsPage = lazy(() => import('../pages/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const FleetPage = lazy(() => import('../pages/fleet/FleetPage').then((m) => ({ default: m.FleetPage })));
const EnergyPage = lazy(() => import('../pages/energy/EnergyPage').then((m) => ({ default: m.EnergyPage })));
const FinancePage = lazy(() => import('../pages/finance/FinancePage').then((m) => ({ default: m.FinancePage })));
const ProcurementPage = lazy(() => import('../pages/procurement/ProcurementPage').then((m) => ({ default: m.ProcurementPage })));
const InventoryPage = lazy(() => import('../pages/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const ReportsPage = lazy(() => import('../pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const UsersPage = lazy(() => import('../pages/users/UsersPage').then((m) => ({ default: m.UsersPage })));

function guard(node: React.ReactNode, roles?: Role[]) {
  return <ProtectedRoute roles={roles}>{node}</ProtectedRoute>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          element={
            <Suspense fallback={<LoadingBlock />}>
              <PageOutlet />
            </Suspense>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/production" element={guard(<ProductionPage />, ['OPERATOR', 'ASSISTANT_OPERATOR', 'OWNER', 'ADMIN'])} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/talons" element={<TalonsPage />} />
          <Route path="/warehouse" element={<WarehousePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/fleet" element={guard(<FleetPage />, ['MECHANIC', 'OPERATOR', 'DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER', 'OWNER', 'ADMIN'])} />
          <Route path="/energy" element={guard(<EnergyPage />, ['OPERATOR', 'OWNER', 'ADMIN'])} />
          <Route path="/finance" element={guard(<FinancePage />, ['FINANCIER', 'OPERATOR', 'SALES_MANAGER', 'OWNER', 'ADMIN'])} />
          <Route path="/procurement" element={guard(<ProcurementPage />, ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'])} />
          <Route path="/inventory" element={guard(<InventoryPage />, ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'])} />
          <Route path="/reports" element={guard(<ReportsPage />, ['OWNER', 'ADMIN'])} />
          <Route path="/users" element={guard(<UsersPage />, ['OWNER', 'ADMIN'])} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Отдельный Outlet под Suspense внутри layout
import { Outlet } from 'react-router-dom';
function PageOutlet() {
  return <Outlet />;
}

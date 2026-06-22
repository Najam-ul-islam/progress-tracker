/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Outlet } from "react-router-dom";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { RegisterPage } from "@/modules/auth/pages/RegisterPage";
import { UnauthorizedPage } from "@/modules/auth/pages/UnauthorizedPage";
import { HydrationGate } from "@/modules/auth/components/HydrationGate";
import { RequireAuth } from "@/modules/auth/components/RequireAuth";
import { UsersListPage } from "@/modules/users/pages/UsersListPage";
import { UserProfilePage } from "@/modules/users/pages/UserProfilePage";
import { ClientsListPage } from "@/modules/clients/pages/ClientsListPage";
import { ClientDetailsPage } from "@/modules/clients/pages/ClientDetailsPage";
import { ProjectsListPage } from "@/modules/projects/pages/ProjectsListPage";
import { ProjectDetailsPage } from "@/modules/projects/pages/ProjectDetailsPage";
import { PaymentsDashboardPage } from "@/modules/payments/pages/PaymentsDashboardPage";
import { PaymentDetailsPage } from "@/modules/payments/pages/PaymentDetailsPage";
import { DeveloperEarningsPage } from "@/modules/earnings/pages/DeveloperEarningsPage";
import { AnalyticsDashboardPage } from "@/modules/reporting/pages/AnalyticsDashboardPage";
import { RevenueAnalyticsPage } from "@/modules/reporting/pages/RevenueAnalyticsPage";
import { ProjectAnalyticsPage } from "@/modules/reporting/pages/ProjectAnalyticsPage";
import { DeveloperPerformancePage } from "@/modules/reporting/pages/DeveloperPerformancePage";
import { NotificationsPage } from "@/modules/notifications/pages/NotificationsPage";
import { SettingsPage } from "@/modules/settings/pages/SettingsPage";
import { DeveloperOverviewPage } from "@/modules/developer/pages/DeveloperOverviewPage";
import { MyModulesPage } from "@/modules/developer/pages/MyModulesPage";
import { MyProjectsPage } from "@/modules/developer/pages/MyProjectsPage";
import { RequireDeveloperWorkspace } from "@/modules/developer/components/RequireDeveloperWorkspace";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { RequireDashboardAccess } from "@/modules/dashboard/components/RequireDashboardAccess";

import { DashboardLayout } from "@/modules/dashboard/components/DashboardLayout";

function RootLayout() {
  return (
    <HydrationGate>
      <Outlet />
    </HydrationGate>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/unauthorized", element: <UnauthorizedPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <RequireDashboardAccess><DashboardLayout><DashboardPage /></DashboardLayout></RequireDashboardAccess> },
          { path: "/developer", element: <RequireDeveloperWorkspace><DashboardLayout><DeveloperOverviewPage /></DashboardLayout></RequireDeveloperWorkspace> },
          { path: "/my-modules", element: <RequireDeveloperWorkspace><DashboardLayout><MyModulesPage /></DashboardLayout></RequireDeveloperWorkspace> },
          { path: "/my-projects", element: <RequireDeveloperWorkspace><DashboardLayout><MyProjectsPage /></DashboardLayout></RequireDeveloperWorkspace> },
          { path: "/users", element: <UsersListPage /> },
          { path: "/users/:id", element: <UserProfilePage /> },
          { path: "/clients", element: <ClientsListPage /> },
          { path: "/clients/:id", element: <ClientDetailsPage /> },
          { path: "/projects", element: <ProjectsListPage /> },
          { path: "/projects/:id", element: <ProjectDetailsPage /> },
          { path: "/payments", element: <PaymentsDashboardPage /> },
          { path: "/payments/:id", element: <PaymentDetailsPage /> },
          { path: "/earnings", element: <DeveloperEarningsPage /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/analytics", element: <AnalyticsDashboardPage /> },
          { path: "/analytics/revenue", element: <RevenueAnalyticsPage /> },
          { path: "/analytics/projects", element: <ProjectAnalyticsPage /> },
          { path: "/analytics/developers", element: <DeveloperPerformancePage /> },
          { path: "/settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
]);

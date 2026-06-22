import { http, HttpResponse } from "msw";

const BASE = "http://localhost:8000";

// ---- Seed payloads (mirror reporting.openapi.yaml shapes; money = strings) --

export const seededDashboard = {
  projects: { total: 8, pending: 2, active: 4, completed: 1, overdue: 1 },
  developers: {
    total: 5,
    with_active_assignments: 3,
    average_module_progress: "66.7",
  },
  payments: {
    total_revenue: "6000.00",
    total_company_reserve: "1800.00",
    total_developer_disbursed: "4200.00",
    pending_amount: "5000.00",
  },
};

export const emptyDashboard = {
  projects: { total: 0, pending: 0, active: 0, completed: 0, overdue: 0 },
  developers: { total: 0, with_active_assignments: 0, average_module_progress: "0.0" },
  payments: {
    total_revenue: "0.00",
    total_company_reserve: "0.00",
    total_developer_disbursed: "0.00",
    pending_amount: "0.00",
  },
};

export const seededFinancial = {
  rows: [
    {
      project_id: 1,
      project_name: "Apollo",
      client_id: 1,
      client_name: "Acme Corp",
      status: "active",
      invoiced: "10000.00",
      company_share: "3000.00",
      developer_share: "7000.00",
      outstanding: "0.00",
      payment_count: 2,
    },
    {
      project_id: 2,
      project_name: "Borealis",
      client_id: 2,
      client_name: "Globex",
      status: "pending",
      invoiced: "0.00",
      company_share: "0.00",
      developer_share: "0.00",
      outstanding: "0.00",
      payment_count: 0,
    },
  ],
  totals: {
    invoiced: "10000.00",
    company_share: "3000.00",
    developer_share: "7000.00",
    outstanding: "0.00",
  },
};

export const seededProjects = [
  {
    id: 1,
    name: "Apollo",
    client_id: 1,
    client_name: "Acme Corp",
    status: "active",
    start_date: "2026-01-01",
    end_date: "2026-06-30",
    overall_progress: 60,
    module_count: 3,
    modules_completed: 1,
    modules_in_progress: 1,
    modules_pending: 1,
    invoiced_amount: "10000.00",
    outstanding_amount: "0.00",
    modules: [
      {
        id: 11,
        name: "Auth",
        assigned_developer_id: 3,
        assigned_developer_name: "Dev One",
        progress: 100,
        status: "completed",
        share_percentage: "30.00",
      },
    ],
  },
];

export const seededDevelopers = [
  {
    id: 3,
    name: "Dev One",
    email: "dev1@example.com",
    module_count: 2,
    modules_completed: 1,
    modules_in_progress: 1,
    modules_pending: 0,
    earnings: { paid: "700.00", pending: "300.00", total: "1000.00" },
    earnings_by_project: [
      { project_id: 1, project_name: "Apollo", paid: "700.00", pending: "300.00", total: "1000.00" },
    ],
  },
];

export const seededSelfReport = {
  id: 3,
  name: "Dev One",
  module_count: 2,
  modules_completed: 1,
  modules_in_progress: 1,
  modules_pending: 0,
  earnings: { paid: "400.00", pending: "0.00", total: "400.00" },
  modules: [
    {
      module_id: 11,
      module_name: "Auth",
      project_id: 1,
      project_name: "Apollo",
      progress: 100,
      status: "completed",
      share_percentage: "30.00",
      amount_paid: "400.00",
      amount_pending: "0.00",
    },
  ],
  projects_completed: 1,
  projects_pending: 1,
  earnings_from_completed_projects: "400.00",
};

export const emptySelfReport = {
  id: 4,
  name: "Dev Two",
  module_count: 0,
  modules_completed: 0,
  modules_in_progress: 0,
  modules_pending: 0,
  earnings: { paid: "0.00", pending: "0.00", total: "0.00" },
  modules: [],
  projects_completed: 0,
  projects_pending: 0,
  earnings_from_completed_projects: "0.00",
};

// ---- Success handlers (default) -------------------------------------------

export const dashboardSuccess = (data = seededDashboard) =>
  http.get(`${BASE}/reports/dashboard`, () => HttpResponse.json(data));

export const paymentsSuccess = (data = seededFinancial) =>
  http.get(`${BASE}/reports/payments`, () => HttpResponse.json(data));

export const projectsReportSuccess = (data = seededProjects) =>
  http.get(`${BASE}/reports/projects`, () => HttpResponse.json(data));

export const developersReportSuccess = (data = seededDevelopers) =>
  http.get(`${BASE}/reports/developers`, () => HttpResponse.json(data));

export const selfReportSuccess = (data = seededSelfReport) =>
  http.get(`${BASE}/reports/developers/me`, () => HttpResponse.json(data));

// ---- Error handlers (opt-in via server.use) -------------------------------

export const dashboardForbidden = () =>
  http.get(`${BASE}/reports/dashboard`, () =>
    HttpResponse.json({ detail: "Forbidden" }, { status: 403 })
  );

export const dashboardNetworkError = () =>
  http.get(`${BASE}/reports/dashboard`, () => HttpResponse.error());

export const paymentsNetworkError = () =>
  http.get(`${BASE}/reports/payments`, () => HttpResponse.error());

export const projectsReportNetworkError = () =>
  http.get(`${BASE}/reports/projects`, () => HttpResponse.error());

export const developersReportNetworkError = () =>
  http.get(`${BASE}/reports/developers`, () => HttpResponse.error());

export const selfReportNetworkError = () =>
  http.get(`${BASE}/reports/developers/me`, () => HttpResponse.error());

/** 422 from any filtered report endpoint (bad date range / unknown id). */
export const reportInvalidFilter = (
  endpoint: "payments" | "projects" | "developers",
  detail = "Invalid filter value"
) =>
  http.get(`${BASE}/reports/${endpoint}`, () =>
    HttpResponse.json({ detail }, { status: 422 })
  );

export const seededChartData = {
  items: [
    { name: "Jan", revenue: 12000, expenses: 7800, users: 120 },
    { name: "Feb", revenue: 19000, expenses: 9500, users: 145 },
    { name: "Mar", revenue: 15000, expenses: 9000, users: 160 },
    { name: "Apr", revenue: 22000, expenses: 11000, users: 180 },
    { name: "May", revenue: 26000, expenses: 13000, users: 210 },
    { name: "Jun", revenue: 31000, expenses: 15000, users: 240 },
  ],
};

export const dashboardChartSuccess = (data = seededChartData) =>
  http.get(`${BASE}/reports/dashboard/chart-data`, () =>
    HttpResponse.json(data)
  );

export const defaultReportingHandlers = [
  dashboardSuccess(),
  dashboardChartSuccess(),
  paymentsSuccess(),
  projectsReportSuccess(),
  developersReportSuccess(),
  selfReportSuccess(),
];

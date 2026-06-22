import { http, HttpResponse } from "msw";
import type {
  Project,
  ProjectModule,
  ProjectProgress,
} from "@/modules/projects/types";

export const seededProjects: Project[] = [
  {
    id: 1,
    name: "Phoenix Migration",
    description: "Cloud migration for legacy ERP",
    clientId: 1,
    totalAmount: "120000.00",
    companyShare: 30,
    developerShare: 70,
    startDate: "2026-06-01",
    endDate: "2026-12-31",
    status: "active",
    isActive: true,
    createdAt: "2026-05-01T10:00:00Z",
    updatedAt: "2026-05-15T10:00:00Z",
  },
  {
    id: 2,
    name: "Mobile App V2",
    description: "React Native rewrite",
    clientId: 2,
    totalAmount: "45000.00",
    companyShare: 30,
    developerShare: 70,
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    status: "pending",
    isActive: true,
    createdAt: "2026-05-10T08:00:00Z",
    updatedAt: "2026-05-10T08:00:00Z",
  },
];

export const seededModules: ProjectModule[] = [
  {
    id: 1,
    projectId: 1,
    name: "Auth Service",
    description: "OAuth2 and RBAC",
    assignedDeveloperId: 3, // Dev user
    progress: 100,
    status: "completed",
    sharePercentage: 25,
    isActive: true,
    createdAt: "2026-05-01T10:00:00Z",
    updatedAt: "2026-05-20T10:00:00Z",
  },
  {
    id: 2,
    projectId: 1,
    name: "Data Sync",
    description: "Legacy DB to Postgres",
    assignedDeveloperId: 3,
    progress: 40,
    status: "in_progress",
    sharePercentage: 45,
    isActive: true,
    createdAt: "2026-05-01T10:00:00Z",
    updatedAt: "2026-06-01T10:00:00Z",
  },
];

export const projectsHandlers = [
  // List projects
  http.get("/api/projects", () => {
    return HttpResponse.json(seededProjects.map(p => ({
      ...p,
      client_id: p.clientId,
      total_amount: p.totalAmount,
      company_share: p.companyShare,
      developer_share: p.developerShare,
      start_date: p.startDate,
      end_date: p.endDate,
      is_active: p.isActive,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })));
  }),

  // Get project detail
  http.get("/api/projects/:id", ({ params }) => {
    const id = Number(params.id);
    const p = seededProjects.find(x => x.id === id);
    if (!p) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      ...p,
      client_id: p.clientId,
      total_amount: p.totalAmount,
      company_share: p.companyShare,
      developer_share: p.developerShare,
      start_date: p.startDate,
      end_date: p.endDate,
      is_active: p.isActive,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    });
  }),

  // Get project progress
  http.get("/api/projects/:id/progress", ({ params }) => {
    const id = Number(params.id);
    const modules = seededModules.filter(m => m.projectId === id);
    const totalProgress = modules.length > 0 
      ? modules.reduce((acc, m) => acc + m.progress, 0) / modules.length 
      : 0;
    
    const res: ProjectProgress = {
      projectId: id,
      progress: totalProgress,
      modules: modules.map(m => ({
        id: m.id,
        name: m.name,
        progress: m.progress,
        sharePercentage: m.sharePercentage,
        assignedDeveloperId: m.assignedDeveloperId,
      })),
    };

    return HttpResponse.json({
      project_id: res.projectId,
      progress: res.progress,
      modules: res.modules.map(m => ({
        ...m,
        share_percentage: m.sharePercentage,
        assigned_developer_id: m.assignedDeveloperId,
      })),
    });
  }),

  // Create project
  http.post("/api/projects", async ({ request }) => {
    const body = await request.json() as {
      name: string;
      description?: string;
      client_id: number;
      total_amount: string;
      start_date: string;
      end_date: string;
    };
    const newProject: Project = {
      id: seededProjects.length + 1,
      name: body.name,
      description: body.description ?? null,
      clientId: body.client_id,
      totalAmount: body.total_amount,
      companyShare: 30,
      developerShare: 70,
      startDate: body.start_date,
      endDate: body.end_date,
      status: "pending",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({
      ...newProject,
      client_id: newProject.clientId,
      total_amount: newProject.totalAmount,
      company_share: newProject.companyShare,
      developer_share: newProject.developerShare,
      start_date: newProject.startDate,
      end_date: newProject.endDate,
      is_active: newProject.isActive,
      created_at: newProject.createdAt,
      updated_at: newProject.updatedAt,
    }, { status: 201 });
  }),

  // Add module
  http.post("/api/projects/:id/modules", async ({ params, request }) => {
    const projectId = Number(params.id);
    const body = await request.json() as {
      name: string;
      description?: string;
      assigned_developer_id: number;
      share_percentage: number;
    };
    const newModule: ProjectModule = {
      id: seededModules.length + 1,
      projectId,
      name: body.name,
      description: body.description ?? null,
      assignedDeveloperId: body.assigned_developer_id,
      progress: 0,
      status: "pending",
      sharePercentage: body.share_percentage,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({
      ...newModule,
      project_id: newModule.projectId,
      assigned_developer_id: newModule.assignedDeveloperId,
      share_percentage: newModule.sharePercentage,
      is_active: newModule.isActive,
      created_at: newModule.createdAt,
      updated_at: newModule.updatedAt,
    }, { status: 201 });
  }),

  // Update progress
  http.patch("/api/modules/:id/progress", async ({ params, request }) => {
    const id = Number(params.id);
    const body = await request.json() as { progress: number };
    const m = seededModules.find(x => x.id === id);
    if (!m) return new HttpResponse(null, { status: 404 });
    
    const status = body.progress === 100 ? "completed" : body.progress > 0 ? "in_progress" : "pending";
    const updated = { ...m, progress: body.progress, status, updatedAt: new Date().toISOString() };
    
    return HttpResponse.json({
      ...updated,
      project_id: updated.projectId,
      assigned_developer_id: updated.assignedDeveloperId,
      share_percentage: updated.sharePercentage,
      is_active: updated.isActive,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    });
  }),
];

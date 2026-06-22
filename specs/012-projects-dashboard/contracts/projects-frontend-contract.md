# Frontend Contract: Projects Dashboard

**Feature**: `012-projects-dashboard`
**Date**: 2026-06-14

## Domain Types (`modules/projects/types.ts`)

```typescript
export type ProjectStatus = "pending" | "active" | "completed";
export type ModuleStatus = "pending" | "in_progress" | "completed";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  clientId: number;
  totalAmount: string; // Decimal from backend
  companyShare: number;
  developerShare: number;
  startDate: string; // ISO Date
  endDate: string; // ISO Date
  status: ProjectStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectModule {
  id: number;
  projectId: number;
  name: string;
  description: string | null;
  assignedDeveloperId: number;
  progress: number; // 0-100
  status: ModuleStatus;
  sharePercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProgress {
  projectId: number;
  progress: number;
  modules: {
    id: number;
    name: string;
    progress: number;
    sharePercentage: number;
  }[];
}

// API Payloads
export interface ProjectCreateBody {
  name: string;
  description?: string;
  client_id: number;
  total_amount: string;
  start_date: string;
  end_date: string;
}

export interface ModuleCreateBody {
  name: string;
  description?: string;
  assigned_developer_id: number;
  share_percentage: number;
}
```

## API Mapping (`modules/projects/services/projects.api.ts`)

| Frontend Method | Method | Endpoint | Note |
| --- | --- | --- | --- |
| `listProjects()` | `GET` | `/projects` | |
| `getProject(id)` | `GET` | `/projects/{id}` | |
| `createProject(body)` | `POST` | `/projects` | |
| `updateProject(id, body)` | `PATCH` | `/projects/{id}` | Used for Activation too |
| `addModule(projectId, body)` | `POST` | `/projects/{projectId}/modules` | |
| `updateModuleProgress(id, progress)` | `PATCH` | `/modules/{id}/progress` | |
| `getProjectProgress(id)` | `GET` | `/projects/{id}/progress` | |

## Query Keys

- List: `['projects']`
- Detail: `['projects', id]`
- Progress: `['projects', id, 'progress']`
- Modules (if nested): `['projects', id, 'modules']` (or just use detail query)

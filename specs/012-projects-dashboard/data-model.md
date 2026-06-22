# Data Model: Projects Dashboard (Frontend)

**Feature**: `012-projects-dashboard`
**Date**: 2026-06-14

## Domain Types (`frontend/src/modules/projects/types.ts`)

```typescript
export type ProjectStatus = "pending" | "active" | "completed";
export type ModuleStatus = "pending" | "in_progress" | "completed";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  clientId: number;
  totalAmount: string; // Stored as string to preserve Decimal precision from backend
  companyShare: number;
  developerShare: number;
  startDate: string; // ISO-8601 Date
  endDate: string; // ISO-8601 Date
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

export type ProjectsApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict" // e.g. status transition violation
  | "validation" // 422
  | "network"
  | "unknown";
```

## Form Schemas (Zod)

### Project Form (`modules/projects/schemas/project-form.schema.ts`)
```typescript
const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  description: z.string().trim().optional(),
  clientId: z.number().positive("Required"),
  totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be on or after start date",
  path: ["endDate"],
});
```

### Module Form (`modules/projects/schemas/module-form.schema.ts`)
```typescript
const moduleFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  description: z.string().trim().optional(),
  assignedDeveloperId: z.number().positive("Required"),
  sharePercentage: z.number().min(0.01).max(70.00),
});
```

## API Mapping (Camel to Snake)

| Domain (TS) | Wire (JSON) |
| --- | --- |
| `clientId` | `client_id` |
| `totalAmount` | `total_amount` |
| `companyShare` | `company_share` |
| `developerShare` | `developer_share` |
| `startDate` | `start_date` |
| `endDate` | `end_date` |
| `isActive` | `is_active` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `projectId` | `project_id` |
| `assignedDeveloperId` | `assigned_developer_id` |
| `sharePercentage` | `share_percentage` |

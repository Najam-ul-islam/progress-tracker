import { setupServer } from "msw/node";
import { defaultHandlers } from "./auth-handlers";
import { defaultUsersHandlers } from "./users-handlers";
import { defaultClientsHandlers } from "./clients-handlers";
import { projectsHandlers } from "./projects-handlers";
import { defaultReportingHandlers } from "./reporting-handlers";
import { defaultNotificationsHandlers } from "./notifications-handlers";

export const server = setupServer(
  ...defaultHandlers,
  ...defaultUsersHandlers,
  ...defaultClientsHandlers,
  ...projectsHandlers,
  ...defaultReportingHandlers,
  ...defaultNotificationsHandlers
);

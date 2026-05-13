import { setupServer } from "msw/node";
import { defaultHandlers } from "./auth-handlers";
import { defaultUsersHandlers } from "./users-handlers";

export const server = setupServer(...defaultHandlers, ...defaultUsersHandlers);

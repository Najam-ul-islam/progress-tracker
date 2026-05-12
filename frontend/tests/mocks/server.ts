import { setupServer } from "msw/node";
import { defaultHandlers } from "./auth-handlers";

export const server = setupServer(...defaultHandlers);

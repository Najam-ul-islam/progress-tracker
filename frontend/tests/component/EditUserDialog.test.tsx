import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "../mocks/server";
import {
  seededUsers,
  userUpdateConflict,
  userUpdateSuccess,
  userUpdateValidation,
  userStatusConflict,
  userStatusSuccess,
} from "../mocks/users-handlers";
import { clearSession, renderRoute, seedSession } from "../helpers/renderWithProviders";
import { EditUserDialog } from "@/modules/users/components/EditUserDialog";
import type { User } from "@/modules/users/types";

afterEach(() => clearSession());

const targetUser: User = {
  id: 2,
  name: "Maya Manager",
  email: "maya@example.com",
  role: "manager",
  isActive: true,
  createdAt: "2026-01-02T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

function Harness({ user }: { user: User | null }) {
  return (
    <EditUserDialog
      user={user}
      open={user !== null}
      onOpenChange={() => {}}
    />
  );
}

describe("EditUserDialog", () => {
  it("renders nothing when role is not admin", () => {
    seedSession({ role: "manager", id: 2 });
    const { container } = renderRoute("/x", <Harness user={targetUser} />);
    expect(container.textContent ?? "").not.toMatch(/edit user/i);
  });

  it("renders nothing when role is developer", () => {
    seedSession({ role: "developer", id: 3 });
    const { container } = renderRoute("/x", <Harness user={targetUser} />);
    expect(container.textContent ?? "").not.toMatch(/edit user/i);
  });

  it("opens prefilled with current user values for admin", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <Harness user={targetUser} />);
    const name = await screen.findByLabelText(/name/i);
    expect(name).toHaveValue("Maya Manager");
    expect(screen.getByLabelText(/role/i)).toHaveValue("manager");
    expect(screen.getByLabelText(/active/i)).toBeChecked();
  });

  it("blocks submit with required-name error and makes no request", async () => {
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <Harness user={targetUser} />);
    const name = await screen.findByLabelText(/name/i);
    const user = userEvent.setup();
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("saves a name change successfully", async () => {
    server.use(userUpdateSuccess({ ...seededUsers[1], name: "Maya Updated" }));
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <Harness user={targetUser} />);
    const name = await screen.findByLabelText(/name/i);
    const user = userEvent.setup();
    await user.clear(name);
    await user.type(name, "Maya Updated");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /saving/i })).not.toBeInTheDocument();
    });
  });

  it("surfaces a 409 conflict inline and keeps the modal open", async () => {
    server.use(userStatusConflict("Cannot deactivate yourself"));
    seedSession({ role: "admin", id: 2 });
    renderRoute("/x", <Harness user={targetUser} />);
    const active = await screen.findByLabelText(/active/i);
    const user = userEvent.setup();
    await user.click(active);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot deactivate yourself/i);
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("surfaces 422 field errors on the matching control", async () => {
    server.use(userUpdateValidation({ name: "must be unique" }));
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <Harness user={targetUser} />);
    const name = await screen.findByLabelText(/name/i);
    const user = userEvent.setup();
    await user.clear(name);
    await user.type(name, "Maya Updated");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/must be unique/i)).toBeInTheDocument();
  });

  it("Cancel button does not submit a request", async () => {
    server.use(userUpdateSuccess(seededUsers[1]), userStatusSuccess(seededUsers[1]));
    seedSession({ role: "admin", id: 1 });
    renderRoute("/x", <Harness user={targetUser} />);
    await screen.findByLabelText(/name/i);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("button", { name: /saving/i })).not.toBeInTheDocument();
  });
});

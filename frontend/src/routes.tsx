import { createBrowserRouter, Outlet } from "react-router-dom";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { RegisterPage } from "@/modules/auth/pages/RegisterPage";
import { UnauthorizedPage } from "@/modules/auth/pages/UnauthorizedPage";
import { AuthenticatedLanding } from "@/modules/auth/pages/AuthenticatedLanding";
import { HydrationGate } from "@/modules/auth/components/HydrationGate";
import { RequireAuth } from "@/modules/auth/components/RequireAuth";

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
        children: [{ path: "/", element: <AuthenticatedLanding /> }],
      },
    ],
  },
]);

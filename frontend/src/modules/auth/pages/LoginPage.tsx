import * as React from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "@/modules/auth/components/AuthLayout";
import { PasswordInput } from "@/modules/auth/components/PasswordInput";
import { LoadingButton } from "@/modules/auth/components/LoadingButton";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLogin } from "@/modules/auth/hooks/useLogin";
import { loginSchema, type LoginInput } from "@/modules/auth/schemas/login.schema";
import { useSessionStore, selectIsAuthenticated } from "@/modules/auth/store/session.store";
import type { ClearReason } from "@/modules/auth/types";

type LocationState = {
  from?: string;
  reason?: ClearReason | null;
  email?: string;
};

function reasonMessage(reason: ClearReason | null | undefined): string | null {
  switch (reason) {
    case "session-ended":
      return "Your session ended. Please sign in again.";
    case "backend-rejected":
      return "Your session is no longer valid. Please sign in again.";
    default:
      return null;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const isAuthed = useSessionStore(selectIsAuthenticated);
  const login = useLogin();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: state.email ?? "", password: "" },
    mode: "onSubmit",
  });

  const [topError, setTopError] = React.useState<string | null>(
    reasonMessage(state.reason)
  );

  if (isAuthed) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setTopError(null);
    try {
      await login.mutateAsync(values);
      navigate(state.from ?? "/", { replace: true });
    } catch (err) {
      const kind = (err as { kind?: string } | null)?.kind;
      if (kind === "invalid-credentials") {
        setTopError("Invalid email or password.");
      } else if (kind === "network") {
        setTopError("Can't reach the server. Please try again.");
      } else if (kind === "validation") {
        const fieldErrors = (err as { fieldErrors?: Record<string, string> })
          .fieldErrors;
        if (fieldErrors) {
          for (const [name, message] of Object.entries(fieldErrors)) {
            form.setError(name as keyof LoginInput, { type: "server", message });
          }
        } else {
          setTopError("Please correct the errors and try again.");
        }
      } else {
        setTopError("Something went wrong. Please try again.");
      }
      form.setValue("password", "", { shouldDirty: false, shouldTouch: false });
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      description="Enter your credentials to access your account."
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            state={{ email: form.getValues("email") || undefined }}
            className="font-medium text-slate-900 hover:underline"
          >
            Create an account
          </Link>
        </span>
      }
    >
      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {topError ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {topError}
            </div>
          ) : null}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <LoadingButton
            type="submit"
            className="w-full"
            isLoading={login.isPending}
            loadingText="Signing in…"
          >
            Sign in
          </LoadingButton>
        </form>
      </Form>
    </AuthLayout>
  );
}

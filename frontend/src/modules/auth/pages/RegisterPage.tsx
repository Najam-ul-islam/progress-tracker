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
import { useRegister } from "@/modules/auth/hooks/useRegister";
import { registerSchema, type RegisterInput } from "@/modules/auth/schemas/register.schema";
import { useSessionStore, selectIsAuthenticated } from "@/modules/auth/store/session.store";
import { ROLES } from "@/modules/auth/types";

type LocationState = { email?: string };

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const isAuthed = useSessionStore(selectIsAuthenticated);
  const register = useRegister();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: state.email ?? "",
      password: "",
      role: "developer",
    },
    mode: "onSubmit",
  });

  const [topError, setTopError] = React.useState<string | null>(null);

  if (isAuthed) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setTopError(null);
    try {
      await register.mutateAsync(values);
      navigate("/", { replace: true });
    } catch (err) {
      const e = err as { kind?: string; fieldErrors?: Record<string, string> };
      if (e.kind === "email-in-use") {
        form.setError("email", {
          type: "server",
          message: e.fieldErrors?.email ?? "This email is already registered.",
        });
      } else if (e.kind === "validation" && e.fieldErrors) {
        for (const [name, message] of Object.entries(e.fieldErrors)) {
          form.setError(name as keyof RegisterInput, { type: "server", message });
        }
      } else if (e.kind === "network") {
        setTopError("Can't reach the server. Please try again.");
      } else {
        setTopError("Something went wrong. Please try again.");
      }
      form.setValue("password", "", { shouldDirty: false, shouldTouch: false });
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      description="Set up your Progress Tracker account."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            to="/login"
            state={{ email: form.getValues("email") || undefined }}
            className="font-medium text-slate-900 hover:underline"
          >
            Sign in
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Your name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <FormControl>
                  <select
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 aria-[invalid=true]:border-red-500"
                    {...field}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <LoadingButton
            type="submit"
            className="w-full"
            isLoading={register.isPending}
            loadingText="Creating account…"
          >
            Create account
          </LoadingButton>
        </form>
      </Form>
    </AuthLayout>
  );
}

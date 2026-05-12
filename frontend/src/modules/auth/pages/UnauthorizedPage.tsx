import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/modules/auth/components/AuthLayout";

export function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <AuthLayout
      title="Access denied"
      description="You don't have permission to view this page."
    >
      <div className="space-y-4 text-sm text-slate-600">
        <p>If you believe this is a mistake, contact your administrator.</p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => navigate("/")}
        >
          Return home
        </Button>
      </div>
    </AuthLayout>
  );
}

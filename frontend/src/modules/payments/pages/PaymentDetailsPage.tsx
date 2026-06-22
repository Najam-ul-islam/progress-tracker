import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { getPaymentDetail, updatePaymentStatus } from "../api";
import { formatCurrency } from "@/lib/format";
import { useSessionStore, selectRole } from "@/modules/auth/store/session.store";

export const PaymentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const paymentId = Number(id);
  const queryClient = useQueryClient();
  const role = useSessionStore(selectRole);
  const isAdmin = role === "admin";

  const { data: payment, isLoading } = useQuery({
    queryKey: ["payments", "detail", paymentId],
    queryFn: () => getPaymentDetail(paymentId),
    enabled: !!paymentId,
  });

  const statusMutation = useMutation({
    mutationFn: (data: { developer_payment_id?: number; target?: "all" }) =>
      updatePaymentStatus(paymentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", "detail", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["reports", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports", "payments"] });
    },
  });

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading payment details...</div>;
  if (!payment) return <div className="p-8 text-center text-red-500">Payment not found.</div>;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Link
        to="/payments"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors w-fit"
      >
        <ArrowLeft size={16} />
        Back to Payments
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Payment #{payment.id}</h1>
        <div className="flex items-center gap-3">
          <Badge variant={payment.status === "paid" ? "active" : "inactive"}>
            {payment.status.toUpperCase()}
          </Badge>
          {isAdmin && payment.status !== "paid" && (
            <Button
              size="sm"
              className="flex items-center gap-2"
              onClick={() => statusMutation.mutate({ target: "all" })}
              disabled={statusMutation.isPending}
            >
              <CheckCircle size={16} />
              Mark All as Paid
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Total Billed</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(payment.total_amount)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Company Reserve (30%)</p>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(payment.company_amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Developer Pool (70%)</p>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(payment.developer_amount)}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Linked Project</p>
              <Link to={`/projects/${payment.project_id}`} className="text-sm font-medium text-indigo-600 hover:underline">
                View Project Details
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Developer Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Developer</TableHead>
                  <TableHead className="text-right">Share %</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.developer_breakdown.map((dev) => (
                  <TableRow key={dev.id}>
                    <TableCell className="font-medium">Dev #{dev.developer_id}</TableCell>
                    <TableCell className="text-right">{dev.share_percentage}%</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(dev.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={dev.status === "paid" ? "active" : "inactive"}>
                        {dev.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        {dev.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 hover:text-indigo-700 h-8"
                            onClick={() => statusMutation.mutate({ developer_payment_id: dev.id })}
                            disabled={statusMutation.isPending}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

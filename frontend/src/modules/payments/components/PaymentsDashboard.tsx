import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listPayments, getPaymentSummary } from "../api";
import type { PaymentRead, PaymentSummaryRead } from "../types";
import { formatCurrency } from "@/lib/format";
import { Eye } from "lucide-react";

export const PaymentsDashboard: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRead[]>([]);
  const [summary, setSummary] = useState<PaymentSummaryRead | null>(null);

  useEffect(() => {
    listPayments().then(setPayments);
    getPaymentSummary().then(setSummary);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Payments Dashboard</h1>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-slate-500">Total Billed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_billed)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-slate-500">Company Reserve</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{formatCurrency(summary.total_company_reserve)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-slate-500">Developer Pool</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-700">{formatCurrency(summary.total_developer_disbursed)}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold uppercase text-slate-500">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                {formatCurrency(summary.by_status.pending.sum + summary.by_status.partial.sum)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Recent Distributions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No payments found.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">#{payment.id}</TableCell>
                    <TableCell>
                      <Link to={`/projects/${payment.project_id}`} className="text-indigo-600 hover:underline">
                        Project #{payment.project_id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(payment.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={payment.status === "paid" ? "active" : "inactive"}>
                        {payment.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/payments/${payment.id}`}
                        className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                      >
                        <Eye size={14} />
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

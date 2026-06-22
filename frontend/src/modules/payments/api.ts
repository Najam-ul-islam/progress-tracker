import { http } from "@/lib/http";
import type {
  PaymentDetailRead,
  PaymentGenerateRequest,
  PaymentRead,
  PaymentStatusPatch,
  PaymentSummaryRead,
} from "./types";

export const listPayments = async (projectId?: number): Promise<PaymentRead[]> => {
  const params = projectId ? { project_id: projectId } : {};
  const response = await http.get<PaymentRead[]>("/payments", { params });
  return response.data;
};

export const getPaymentSummary = async (): Promise<PaymentSummaryRead> => {
  const response = await http.get<PaymentSummaryRead>("/payments/summary");
  return response.data;
};

export const getRemainingBalance = async (projectId: number): Promise<{ remaining_balance: string }> => {
  const response = await http.get<{ remaining_balance: string }>(`/payments/remaining-balance/${projectId}`);
  return response.data;
};

export const generatePayment = async (projectId: number, data: PaymentGenerateRequest): Promise<PaymentDetailRead> => {
  const response = await http.post<PaymentDetailRead>(`/payments/generate/${projectId}`, data);
  return response.data;
};

export const getPaymentDetail = async (id: number): Promise<PaymentDetailRead> => {
  const response = await http.get<PaymentDetailRead>(`/payments/${id}`);
  return response.data;
};

export const updatePaymentStatus = async (id: number, data: PaymentStatusPatch): Promise<PaymentDetailRead> => {
  const response = await http.patch<PaymentDetailRead>(`/payments/${id}/status`, data);
  return response.data;
};

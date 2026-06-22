export type PaymentStatus = "pending" | "partial" | "paid";
export type DeveloperPaymentStatus = "pending" | "paid";

export interface PaymentGenerateRequest {
  total_amount: number;
  mark_as_paid?: boolean;
}

export interface PaymentStatusPatch {
  developer_payment_id?: number;
  target?: "all";
}

export interface DeveloperPaymentRead {
  id: number;
  payment_id: number;
  developer_id: number;
  module_id: number;
  share_percentage: number;
  amount: number;
  status: DeveloperPaymentStatus;
  created_at: string;
}

export interface DeveloperPaymentMineRead extends DeveloperPaymentRead {
  project_id: number;
}

export interface PaymentRead {
  id: number;
  project_id: number;
  total_amount: number;
  company_amount: number;
  developer_amount: number;
  status: PaymentStatus;
  created_at: string;
}

export interface PaymentDetailRead extends PaymentRead {
  developer_breakdown: DeveloperPaymentRead[];
}

export interface PaymentSummaryBucket {
  count: number;
  sum: number;
}

export interface PaymentSummaryRead {
  total_billed: number;
  total_company_reserve: number;
  total_developer_disbursed: number;
  by_status: Record<PaymentStatus, PaymentSummaryBucket>;
}

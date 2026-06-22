import { http } from "@/lib/http";
import type { DeveloperPaymentMineRead } from "../payments/types";
import type { DeveloperSelfReport } from "./types";

export const listMyEarnings = async (): Promise<DeveloperPaymentMineRead[]> => {
  const response = await http.get<DeveloperPaymentMineRead[]>("/payments/developer/me");
  return response.data;
};

export const getMySelfReport = async (): Promise<DeveloperSelfReport> => {
  const response = await http.get<DeveloperSelfReport>("/reports/developers/me");
  return response.data;
};

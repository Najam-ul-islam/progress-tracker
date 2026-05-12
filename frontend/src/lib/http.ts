import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { sessionStore } from "@/modules/auth/store/session.store";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const http = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStore.getState().accessToken;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";
    if (status === 401 && !url.includes("/auth/login") && !url.includes("/auth/register")) {
      sessionStore.getState().clear("session-ended");
    }
    return Promise.reject(error);
  }
);

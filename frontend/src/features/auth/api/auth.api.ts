import api from "../../../lib/http/axios";

export type StoreBranch = "manager" | "staff";
export type OfficeBranch = "audit" | "dm" | "marketing" | "hr";
export type InternalResetPortal = "store" | "office";

export const authApi = {
  loginStore: (username: string, password: string, branch: StoreBranch) =>
    api
      .post("/auth/login/store", { username, password, branch })
      .then((r) => r.data),

  loginOffice: (username: string, password: string, branch: OfficeBranch) =>
    api
      .post("/auth/login/office", { username, password, branch })
      .then((r) => r.data),

  loginPos: (username: string, password: string) =>
    api.post("/auth/login/pos", { username, password }).then((r) => r.data),

  customerLogin: (identifier: string, password: string) =>
    api
      .post("/auth/login/customer", { identifier, password })
      .then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refreshToken }).then((r) => r.data),

  customerCompleteAccountSendOtp: (email: string) =>
    api
      .post("/auth/customer/complete-account/send-otp", { email })
      .then((r) => r.data),

  customerCompleteAccountVerifyOtp: (email: string, otp: string) =>
    api
      .post("/auth/customer/complete-account/verify-otp", { email, otp })
      .then((r) => r.data),

  customerCompleteAccountFinish: (payload: {
    email: string;
    currentPassword: string;
    newPassword: string;
  }) =>
    api
      .post("/auth/customer/complete-account/finish", payload)
      .then((r) => r.data),

  me: () => api.get("/auth/me").then((r) => r.data),

  sendRegisterOtp: (email: string) =>
    api.post("/auth/customer/send-otp", { email }).then((r) => r.data),

  verifyRegisterOtp: (payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
    otp: string;
    gender: "male" | "female" | "other";
    birthday: string;
    city: string;
  }) => api.post("/auth/customer/verify-otp", payload).then((r) => r.data),

  sendResetOtp: (email: string) =>
    api.post("/auth/customer/send-reset-otp", { email }).then((r) => r.data),

  verifyResetOtp: (email: string, otp: string) =>
    api
      .post("/auth/customer/verify-reset-otp", { email, otp })
      .then((r) => r.data),

  resetPassword: (email: string, password: string) =>
    api
      .post("/auth/customer/reset-password", { email, password })
      .then((r) => r.data),

  sendInternalResetOtp: (portal: InternalResetPortal, email: string) =>
    api.post(`/auth/${portal}/send-reset-otp`, { email }).then((r) => r.data),

  verifyInternalResetOtp: (
    portal: InternalResetPortal,
    email: string,
    otp: string
  ) =>
    api
      .post(`/auth/${portal}/verify-reset-otp`, { email, otp })
      .then((r) => r.data),

  resetInternalPassword: (
    portal: InternalResetPortal,
    email: string,
    password: string
  ) =>
    api
      .post(`/auth/${portal}/reset-password`, { email, password })
      .then((r) => r.data),

  registerMembership: (payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    password: string;
    gender: "male" | "female" | "other";
    birthday: string;
    city: string;
  }) =>
    api.post("/auth/customer/register-membership", payload).then((r) => r.data),

  // ── KONEKT Multi-Tenant APIs ──
  registerOwner: (payload: {
    brandName: string;
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    address?: string;
  }) => api.post("/auth/register-owner", payload).then((r) => r.data),

  loginKonekt: (payload: { identifier: string; password: string }) =>
    api.post("/auth/login-konekt", payload).then((r) => r.data),

  demoLogin: (role: "owner" | "manager" | "staff") =>
    api.post("/auth/demo-login", { role }).then((r) => r.data),
};


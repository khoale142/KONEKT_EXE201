import type { InternalResetPortal } from "../api/auth.api";

type FlowMeta = {
  branchLabel: string;
  forgotPath: string;
  invalidRedirect: string;
  loginPath: string;
  portalLabel: string;
  resetPath: string;
  resetOtpPath: string;
};

const STORE_BRANCH_LABELS: Record<string, string> = {
  manager: "Store Manager",
  staff: "Staff / Trưởng ca",
};

const OFFICE_BRANCH_LABELS: Record<string, string> = {
  audit: "Audit",
  dm: "District Manager",
  hr: "Human Resources",
  marketing: "Marketing / Sale",
};

export function resolveInternalResetFlow(
  portal: InternalResetPortal,
  branch: string | undefined
): FlowMeta | null {
  if (!branch) return null;

  const branchLabel =
    portal === "store" ? STORE_BRANCH_LABELS[branch] : OFFICE_BRANCH_LABELS[branch];

  if (!branchLabel) return null;

  const invalidRedirect = portal === "store" ? "/login/store" : "/login/office";

  return {
    branchLabel,
    portalLabel: portal === "store" ? "nhân sự cửa hàng" : "nhân sự office",
    loginPath: `/login/${portal}/${branch}`,
    forgotPath: `/forgot-password/${portal}/${branch}`,
    resetOtpPath: `/reset-password/${portal}/${branch}/otp`,
    resetPath: `/reset-password/${portal}/${branch}`,
    invalidRedirect,
  };
}

import type { OpsNotificationItem } from "../types";

export function resolveOpsNotificationTarget(notification: OpsNotificationItem) {
  let rawDeepLink =
    typeof notification.data?.deepLink === "string" && notification.data.deepLink.trim()
      ? notification.data.deepLink.trim()
      : "";

  if (!rawDeepLink) return null;
  if (rawDeepLink === "/store/staff/schedule") {
    rawDeepLink = "/store/staff/schedules";
  }

  const employeeId = Number(notification.data?.employeeId);
  if (
    notification.type === "staff_request_processed" &&
    Number.isFinite(employeeId) &&
    employeeId > 0
  ) {
    rawDeepLink = `/store/manager/employees/${employeeId}`;
  } else if (notification.type === "staff_request_processed" && rawDeepLink === "/store/manager/help") {
    rawDeepLink = "/store/manager/employees";
  }

  const extras = new URLSearchParams();
  const storeId = Number(notification.data?.storeId);
  if (Number.isFinite(storeId) && storeId > 0) {
    extras.set("storeId", String(storeId));
  }

  const requestId = Number(notification.data?.requestId);
  if (Number.isFinite(requestId) && requestId > 0) {
    extras.set("requestId", String(requestId));
  }

  if (typeof notification.data?.requestType === "string" && notification.data.requestType.trim()) {
    extras.set("requestType", notification.data.requestType.trim());
  }

  if (typeof notification.data?.status === "string" && notification.data.status.trim()) {
    extras.set("requestStatus", notification.data.status.trim());
  }

  const queryString = extras.toString();
  if (!queryString) return rawDeepLink;

  const separator = rawDeepLink.includes("?") ? "&" : "?";
  return `${rawDeepLink}${separator}${queryString}`;
}

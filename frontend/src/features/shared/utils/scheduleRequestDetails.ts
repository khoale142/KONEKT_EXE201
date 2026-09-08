import { formatDateVN, formatTimeVN } from "./formatDateTime";

export type ScheduleRequestKind = "CHANGE_TIME" | "CHANGE_SHIFT" | "DROP_SHIFT" | string;

export type ScheduleRequestCurrentDetail = {
  workDate?: string | null;
  shiftType?: string | null;
  shiftLabel?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
};

export type ScheduleRequestDesiredDetail = {
  desiredWorkDate?: string | null;
  desiredShiftId?: number | null;
  desiredShiftLabel?: string | null;
  desiredStartTime?: string | null;
  desiredEndTime?: string | null;
};

export type ScheduleRequestDetail = {
  requestType?: ScheduleRequestKind;
  reason?: string | null;
  current?: ScheduleRequestCurrentDetail | null;
  desired?: ScheduleRequestDesiredDetail | null;
  decision?: {
    status?: string | null;
    note?: string | null;
    processedAt?: string | null;
  } | null;
  requestedAt?: string | null;
};

export type ScheduleRequestPresentation = {
  hasDetail: boolean;
  workDateLabel: string;
  currentTitle: string;
  currentTimeLabel: string;
  desiredPanelLabel: string;
  desiredTitle: string;
  desiredTimeLabel: string;
  reason: string;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatManualTimeRange(start?: string | null, end?: string | null): string {
  const normalizedStart = normalizeText(start);
  const normalizedEnd = normalizeText(end);
  return normalizedStart && normalizedEnd ? `${normalizedStart} - ${normalizedEnd}` : "";
}

function formatScheduledTimeRange(startAt?: string | null, endAt?: string | null): string {
  const from = normalizeText(startAt) ? formatTimeVN(startAt) : "";
  const to = normalizeText(endAt) ? formatTimeVN(endAt) : "";
  return from && to ? `${from} - ${to}` : "";
}

function getShiftTypeLabel(shiftType?: string | null): string {
  if (shiftType === "PART_TIME") return "Ca bán thời gian";
  if (shiftType === "FULL_TIME") return "Ca toàn thời gian";
  if (shiftType === "SM") return "Ca quản lý";
  return normalizeText(shiftType);
}

function getCurrentShiftTitle(current?: ScheduleRequestCurrentDetail | null): string {
  return normalizeText(current?.shiftLabel) || getShiftTypeLabel(current?.shiftType) || "Ca hiện tại";
}

function getCurrentShiftTimeLabel(current?: ScheduleRequestCurrentDetail | null): string {
  return (
    formatManualTimeRange(current?.startTime, current?.endTime) ||
    formatScheduledTimeRange(current?.scheduledStartAt, current?.scheduledEndAt) ||
    "Chưa có khung giờ"
  );
}

function getDesiredShiftTitle(kind: ScheduleRequestKind, desired?: ScheduleRequestDesiredDetail | null): string {
  if (kind === "CHANGE_SHIFT") {
    return normalizeText(desired?.desiredShiftLabel) || "Ca muốn đổi sang";
  }
  if (kind === "CHANGE_TIME") {
    return "Giờ làm mong muốn";
  }
  if (kind === "DROP_SHIFT") {
    return "Xin nghỉ ca hiện tại";
  }
  return "Yêu cầu";
}

function getDesiredShiftTimeLabel(kind: ScheduleRequestKind, desired?: ScheduleRequestDesiredDetail | null): string {
  if (kind === "DROP_SHIFT") {
    return "Không làm ca này";
  }

  const desiredRange =
    formatManualTimeRange(desired?.desiredStartTime, desired?.desiredEndTime) ||
    formatScheduledTimeRange(desired?.desiredStartTime, desired?.desiredEndTime);

  if (desiredRange) return desiredRange;

  if (kind === "CHANGE_SHIFT") {
    return "Theo khung giờ của ca mới";
  }

  if (kind === "CHANGE_TIME") {
    return "Chưa có khung giờ mong muốn";
  }

  return "—";
}

function formatWorkDateLabel(value?: string | null): string {
  const normalized = normalizeText(value);
  return normalized ? formatDateVN(normalized) : "—";
}

export function getScheduleRequestPresentation(params: {
  kind: ScheduleRequestKind;
  detail?: ScheduleRequestDetail | null;
  fallbackWorkDate?: string | null;
}): ScheduleRequestPresentation {
  const detail = params.detail;
  const current = detail?.current;
  const desired = detail?.desired;
  const reason = normalizeText(detail?.reason);
  const workDate =
    normalizeText(current?.workDate) ||
    normalizeText(desired?.desiredWorkDate) ||
    normalizeText(params.fallbackWorkDate);

  return {
    hasDetail: Boolean(current || desired || reason),
    workDateLabel: formatWorkDateLabel(workDate),
    currentTitle: getCurrentShiftTitle(current),
    currentTimeLabel: getCurrentShiftTimeLabel(current),
    desiredPanelLabel: params.kind === "DROP_SHIFT" ? "Yêu cầu" : "Ca mong muốn",
    desiredTitle: getDesiredShiftTitle(params.kind, desired),
    desiredTimeLabel: getDesiredShiftTimeLabel(params.kind, desired),
    reason,
  };
}

import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { staffAttendanceApi } from "../../api/staffAttendance.api";
import { storeStaffApi } from "../../api/storeStaff.api";
import {
  addDaysYMD,
  formatDateShortVN,
  formatTimeVN,
  getTodayVN,
  getWeekDays,
  getWeekStartMonday,
  WEEKDAY_LABELS,
} from "../../../shared/utils/formatDateTime";
import { scheduleShiftTitleDisplay } from "../../../shared/utils/employmentShiftTypes";
import {
  formatLateEarlyDisplay,
  getAttendanceStatusLabel,
  getScheduleHistoryOutcomeLabel,
} from "../../../shared/utils/attendanceStatus";
import { PageHeader } from "../../../shared/components/PageHeader";

function normalizeWorkDate(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

const TIME_OPTIONS = (() => {
  const opts: string[] = [];
  for (let h = 6; h <= 23; h++) {
    const hh = String(h).padStart(2, "0");
    opts.push(`${hh}:00`);
    if (h < 23) {
      opts.push(`${hh}:30`);
    }
  }
  return opts;
})();

type ScheduleItem = {
  id: number;
  storeId?: number;
  workDate: string;
  shiftId?: number | null;
  shiftType: string;
  shiftLabel: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
  status: string;
  storeName?: string | null;
  note?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  attendanceStatus?: string | null;
  classification?: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  } | null;
};

type ShiftChangeRequestItem = {
  id: number;
  status: string;
  createdAt?: string;
  detail?: any;
};

type StoreShiftOption = {
  id: number;
  name: string;
  startTime: string | null;
  endTime: string | null;
};

function canRequestTimeChange(shift: ScheduleItem | null | undefined): boolean {
  return String(shift?.shiftType || "").toUpperCase() === "PART_TIME";
}

function normalizeShiftName(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
};

function getAttendanceLabelLegacy(s: ScheduleItem): string {
  if (!s.attendanceStatus && !s.checkInAt && !s.checkOutAt) return "Chưa có dữ liệu chấm công";
  if (s.attendanceStatus === "closed") return "Đã check-out";
  if (s.checkInAt && !s.checkOutAt) return "Đã check-in, chưa check-out";
  if (!s.checkInAt) return "Chưa check-in";
  return "Đã check-out";
}

function scheduleAttendanceLine(s: ScheduleItem): string {
  const c = s.classification;
  if (c?.status) {
    const ended = new Date(s.scheduledEndAt).getTime() < Date.now();
    let line = ended ? getScheduleHistoryOutcomeLabel(c.status) : getAttendanceStatusLabel(c.status);
    const extra = formatLateEarlyDisplay(c.lateMinutes ?? 0, c.earlyLeaveMinutes ?? 0);
    if (extra !== "--") line += ` · ${extra}`;
    return line;
  }
  return getAttendanceLabelLegacy(s);
}

function getRequestStatusMeta(status?: string) {
  if (status === "approved") {
    return {
      label: "Đã chấp nhận",
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
      description: "Yêu cầu đã được quản lý duyệt.",
    };
  }

  if (status === "rejected") {
    return {
      label: "Đã từ chối",
      background: "#fee2e2",
      color: "#b91c1c",
      borderColor: "#fecaca",
      description: "Yêu cầu đã bị từ chối.",
    };
  }

  if (status === "expired") {
    return {
      label: "Đã hết hạn",
      background: "#fef3c7",
      color: "#b45309",
      borderColor: "#fde68a",
      description: "Yêu cầu đã quá giờ vào ca hiện tại nên tự hết hạn.",
    };
  }

  return {
    label: "Đang chờ xử lý",
    background: "rgba(47,93,58,0.12)",
    color: "#2f5d3a",
    borderColor: "#d1fae5",
    description: "Yêu cầu đã gửi và đang chờ quản lý xử lý.",
  };
}

function buildDecisionSummary(request?: ShiftChangeRequestItem) {
  if (!request) return "";
  const decisionNote = String(request.detail?.decision?.note || "").trim();
  const meta = getRequestStatusMeta(String(request.status || "").toLowerCase());
  return decisionNote ? `${meta.description} Ghi chú: ${decisionNote}` : meta.description;
}

function getRequestTypeLabel(request?: ShiftChangeRequestItem) {
  const type = String(request?.detail?.requestType || "").trim();
  if (type === "CHANGE_TIME") return "Đổi giờ làm";
  if (type === "CHANGE_SHIFT") return "Đổi ca";
  if (type === "DROP_SHIFT") return "Xin nghỉ ca";
  return type || "Yêu cầu đổi lịch";
}

function DayColumn({
  dayLabel,
  dateStr,
  shifts,
  latestRequestByScheduleId,
  onOpenRequest,
}: {
  dayLabel: string;
  dateStr: string;
  shifts: ScheduleItem[];
  latestRequestByScheduleId: Record<number, ShiftChangeRequestItem | undefined>;
  onOpenRequest: (shift: ScheduleItem) => void;
}) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 120,
        maxWidth: 200,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          padding: "10px 8px",
          background: "#2f5d3a",
          color: "#fff",
          textAlign: "center",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
      >
        {dayLabel}
      </div>
      <div style={{ padding: "6px 8px", fontSize: "0.8rem", color: "#718096", textAlign: "center" }}>
        {dateStr}
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 10 }}>
        {shifts.length === 0 ? (
          <div
            style={{
              padding: 12,
              textAlign: "center",
              color: "#718096",
              fontSize: "0.85rem",
              background: "#edf2f7",
              borderRadius: 8,
            }}
          >
            Chưa phân công
          </div>
        ) : (
          shifts.map((s) => {
            const latestRequest = latestRequestByScheduleId[s.id];
            const requestStatus = String(latestRequest?.status || "").toLowerCase();
            const requestMeta = latestRequest ? getRequestStatusMeta(requestStatus) : null;
            const requestSummary = buildDecisionSummary(latestRequest);
            const nowMs = Date.now();
            const startMs = new Date(s.scheduledStartAt).getTime();
            const hasReachedShiftStart = Number.isFinite(startMs) ? startMs <= nowMs : false;
            const hasAttendance = Boolean(s.checkInAt || s.checkOutAt);
            const blockedStatus = String(s.status || "").toLowerCase() !== "assigned";
            const hasAnyRequest = Boolean(latestRequest);
            const hasPending = requestStatus === "pending";
            const isAutoExpired = requestStatus === "expired";
            const canOpenRequestForm = !hasReachedShiftStart && !hasAttendance && !blockedStatus && !hasAnyRequest;

            return (
              <div
                key={s.id}
                style={{
                  padding: "10px 10px",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                }}
              >
                {requestMeta && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: 999, background: requestMeta.background, color: requestMeta.color }}>
                      {requestMeta.label}
                    </span>
                  </div>
                )}
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {scheduleShiftTitleDisplay({ shiftLabel: s.shiftLabel, shiftType: s.shiftType })}
                </div>
                <div style={{ color: "#4a5568", marginBottom: 2 }}>
                  {formatTimeVN(s.scheduledStartAt)} – {formatTimeVN(s.scheduledEndAt)}
                </div>
                {s.storeName && (
                  <div style={{ fontSize: "0.8rem", color: "#2f5d3a", marginBottom: 2 }}>
                    {s.storeName}
                  </div>
                )}
                {s.note && (
                  <div style={{ fontSize: "0.75rem", color: "#718096", fontStyle: "italic", marginBottom: 4 }}>
                    {s.note}
                  </div>
                )}
                {requestMeta && (
                  <div style={{ fontSize: "0.75rem", color: requestMeta.color, marginBottom: 4, lineHeight: 1.4 }}>
                    {requestSummary}
                  </div>
                )}
                <div style={{ fontSize: "0.75rem", color: "#718096", marginTop: 4, paddingTop: 4, borderTop: "1px solid #edf2f7" }}>
                  {s.status === "assigned" ? "Đã phân công" : s.status} · {scheduleAttendanceLine(s)}
                </div>
                <div style={{ marginTop: 8 }}>
                  {canOpenRequestForm ? (
                    <button
                      type="button"
                      className="cafe-btn-secondary"
                      style={{ padding: "5px 10px", fontSize: "0.76rem" }}
                      onClick={() => onOpenRequest(s)}
                    >
                      Yêu cầu đổi ca
                    </button>
                  ) : hasPending ? (
                    <span style={{ fontSize: "0.75rem", color: "#2f5d3a" }}>Yêu cầu đã gửi, đang chờ xử lý</span>
                  ) : isAutoExpired ? (
                    <span style={{ fontSize: "0.75rem", color: "#b45309" }}>Yêu cầu trước đã quá giờ vào ca và tự hết hạn</span>
                  ) : hasAnyRequest ? (
                    <span style={{ fontSize: "0.75rem", color: "#718096" }}>Ca này đã từng gửi yêu cầu đổi ca, không thể gửi lại</span>
                  ) : hasReachedShiftStart ? (
                    <span style={{ fontSize: "0.75rem", color: "#718096" }}>Đã quá giờ vào ca, không thể gửi yêu cầu</span>
                  ) : hasAttendance ? (
                    <span style={{ fontSize: "0.75rem", color: "#718096" }}>Ca đã chấm công, không thể đổi</span>
                  ) : blockedStatus ? (
                    <span style={{ fontSize: "0.75rem", color: "#718096" }}>Ca này không còn khả dụng trên lịch làm việc</span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#718096" }}>Ca này không khả dụng để gửi yêu cầu</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WeeklyScheduleGrid({
  weekDays,
  scheduleByDay,
  latestRequestByScheduleId,
  onOpenRequest,
}: {
  weekDays: string[];
  scheduleByDay: Map<string, ScheduleItem[]>;
  latestRequestByScheduleId: Record<number, ShiftChangeRequestItem | undefined>;
  onOpenRequest: (shift: ScheduleItem) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        paddingBottom: 8,
      }}
    >
      {weekDays.map((dateStr, i) => (
        <DayColumn
          key={dateStr}
          dayLabel={WEEKDAY_LABELS[i]}
          dateStr={formatDateShortVN(dateStr)}
          shifts={scheduleByDay.get(dateStr) ?? []}
          latestRequestByScheduleId={latestRequestByScheduleId}
          onOpenRequest={onOpenRequest}
        />
      ))}
    </div>
  );
}

export default function StaffSchedulePage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [requests, setRequests] = useState<ShiftChangeRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [openShift, setOpenShift] = useState<ScheduleItem | null>(null);
  const [availableShifts, setAvailableShifts] = useState<StoreShiftOption[]>([]);
  const [loadingShiftOptions, setLoadingShiftOptions] = useState(false);
  const [requestForm, setRequestForm] = useState({
    requestType: "DROP_SHIFT" as "DROP_SHIFT" | "CHANGE_TIME" | "CHANGE_SHIFT",
    reason: "",
    desiredShiftId: "",
    desiredStartTime: "06:00",
    desiredEndTime: "07:00",
  });

  const today = getTodayVN();
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(today));

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const dateFrom = weekStart;
  const dateTo = addDaysYMD(weekStart, 6);

  const scheduleByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const d of weekDays) map.set(d, []);
    for (const s of items) {
      const key = normalizeWorkDate(s.workDate);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const tA = new Date(a.scheduledStartAt).getTime();
        const tB = new Date(b.scheduledStartAt).getTime();
        return tA - tB;
      });
    }
    return map;
  }, [items, weekDays]);

  const latestRequestByScheduleId = useMemo(() => {
    const map: Record<number, ShiftChangeRequestItem | undefined> = {};
    for (const r of requests) {
      const scheduleId = Number(r?.detail?.scheduleId);
      if (!Number.isFinite(scheduleId)) continue;
      const current = map[scheduleId];
      const currentTime = current?.createdAt ? new Date(current.createdAt).getTime() : 0;
      const nextTime = r?.createdAt ? new Date(r.createdAt).getTime() : 0;
      if (!current || nextTime >= currentTime || Number(r.id) > Number(current.id)) {
        map[scheduleId] = r;
      }
    }
    return map;
  }, [requests]);

  const filteredAvailableShifts = useMemo(() => {
    if (!openShift) return availableShifts;

    const currentShiftId = Number(openShift.shiftId);
    const currentShiftLabel = normalizeShiftName(openShift.shiftLabel);

    return availableShifts.filter((shift) => {
      const shiftId = Number(shift.id);
      if (Number.isFinite(currentShiftId) && currentShiftId > 0 && shiftId === currentShiftId) {
        return false;
      }
      if (currentShiftLabel && normalizeShiftName(shift.name) === currentShiftLabel) {
        return false;
      }
      return true;
    });
  }, [availableShifts, openShift]);

  const highlightedRequest = useMemo(() => {
    const requestId = Number(searchParams.get("requestId"));
    const requestStatus = String(searchParams.get("requestStatus") || "").trim().toLowerCase();
    if (!Number.isFinite(requestId) || requestId <= 0) return null;

    const matchedRequest = requests.find((item) => Number(item.id) === requestId);
    const finalStatus = matchedRequest?.status || requestStatus;
    if (!finalStatus) return null;

    const decisionNote = String(matchedRequest?.detail?.decision?.note || "").trim();
    const requestType = String(matchedRequest?.detail?.requestType || "").trim();
    return {
      requestId,
      status: finalStatus,
      note: decisionNote,
      requestType,
      meta: getRequestStatusMeta(finalStatus),
    };
  }, [requests, searchParams]);

  const load = useCallback(async (from: string, to: string) => {
    try {
      setLoading(true);
      setError("");
      const res = await staffAttendanceApi.getMySchedules(from, to);
      setItems(res?.schedules || []);
      const reqRes = await staffAttendanceApi.getMyScheduleChangeRequests(from, to);
      setRequests(Array.isArray(reqRes?.requests) ? reqRes.requests : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không tải được lịch làm");
    } finally {
      setLoading(false);
    }
  }, []);

  const isOnSchedulePage = location.pathname === "/store/staff/schedules";

  useEffect(() => {
    void load(dateFrom, dateTo);
  }, [dateFrom, dateTo, load]);

  useEffect(() => {
    if (!isOnSchedulePage) return;
    const onVisible = () => void load(dateFrom, dateTo);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isOnSchedulePage, dateFrom, dateTo, load]);

  useEffect(() => {
    if (!openShift || requestForm.requestType !== "CHANGE_SHIFT") return;

    const storeId = Number(openShift.storeId);
    if (!Number.isFinite(storeId) || storeId <= 0) {
      setAvailableShifts([]);
      return;
    }

    let active = true;
    setLoadingShiftOptions(true);
    storeStaffApi
      .getStoreShifts(storeId)
      .then((res: { shifts?: StoreShiftOption[] }) => {
        if (!active) return;
        setAvailableShifts(Array.isArray(res?.shifts) ? res.shifts : []);
      })
      .catch(() => {
        if (!active) return;
        setAvailableShifts([]);
      })
      .finally(() => {
        if (active) setLoadingShiftOptions(false);
      });

    return () => {
      active = false;
    };
  }, [openShift, requestForm.requestType]);

  useEffect(() => {
    if (!openShift) return;
    if (requestForm.requestType === "CHANGE_TIME" && !canRequestTimeChange(openShift)) {
      setRequestForm((prev) => ({ ...prev, requestType: "DROP_SHIFT" }));
    }
  }, [openShift, requestForm.requestType]);

  const goPrevWeek = () => {
    const nextWeek = addDaysYMD(weekStart, -7);
    setWeekStart(nextWeek);
  };

  const goNextWeek = () => {
    const nextWeek = addDaysYMD(weekStart, 7);
    setWeekStart(nextWeek);
  };

  const handleWeekChange = (mondayYMD: string) => {
    setWeekStart(mondayYMD);
  };

  const submitShiftChangeRequest = async () => {
    if (!openShift) return;
    setRequestMsg("");
    const shiftStartMs = new Date(openShift.scheduledStartAt).getTime();

    if (!requestForm.reason.trim()) {
      setRequestMsg("Vui lòng nhập lý do yêu cầu.");
      return;
    }

    if (latestRequestByScheduleId[openShift.id]) {
      setRequestMsg("Mỗi ca chỉ được gửi yêu cầu đổi ca một lần.");
      return;
    }

    if (Number.isFinite(shiftStartMs) && shiftStartMs <= Date.now()) {
      setRequestMsg("Đã quá giờ vào ca hiện tại, yêu cầu không còn khả dụng.");
      return;
    }

    if (requestForm.requestType === "CHANGE_TIME") {
      if (!canRequestTimeChange(openShift)) {
        setRequestMsg("Chỉ nhân viên part-time mới được yêu cầu đổi thời gian làm.");
        return;
      }
      if (!requestForm.desiredStartTime || !requestForm.desiredEndTime || requestForm.desiredStartTime >= requestForm.desiredEndTime) {
        setRequestMsg("Giờ mong muốn không hợp lệ (giờ kết thúc phải lớn hơn giờ bắt đầu).");
        return;
      }
      if (
        requestForm.desiredStartTime < "06:00" ||
        requestForm.desiredStartTime > "23:00" ||
        requestForm.desiredEndTime < "06:00" ||
        requestForm.desiredEndTime > "23:00"
      ) {
        setRequestMsg("Giờ mong muốn chỉ trong khoảng 06:00 đến 23:00.");
        return;
      }
    }

    if (requestForm.requestType === "CHANGE_SHIFT" && !requestForm.desiredShiftId) {
      setRequestMsg("Vui lòng nhập ca mong muốn.");
      return;
    }

    if (requestForm.requestType === "CHANGE_SHIFT") {
      const selectedShift = availableShifts.find(
        (shift) => String(shift.id) === requestForm.desiredShiftId,
      );
      const currentShiftId = Number(openShift.shiftId);
      const selectedShiftId = Number(requestForm.desiredShiftId);
      const sameShiftById =
        Number.isFinite(currentShiftId) &&
        currentShiftId > 0 &&
        Number.isFinite(selectedShiftId) &&
        selectedShiftId === currentShiftId;
      const sameShiftByLabel =
        normalizeShiftName(selectedShift?.name) !== "" &&
        normalizeShiftName(selectedShift?.name) === normalizeShiftName(openShift.shiftLabel);

      if (sameShiftById || sameShiftByLabel) {
        setRequestMsg("Ca mong muốn phải khác với ca đang được phân công.");
        return;
      }
    }

    try {
      const storeIdRaw: any = (openShift as any).storeId;
      const storeId = Number(storeIdRaw);
      await staffAttendanceApi.createMyScheduleChangeRequest({
        storeId,
        scheduleId: Number(openShift.id),
        requestType: requestForm.requestType,
        reason: requestForm.reason.trim(),
        desiredShiftId:
          requestForm.requestType === "CHANGE_SHIFT" && requestForm.desiredShiftId
            ? Number(requestForm.desiredShiftId)
            : undefined,
        desiredStartTime: requestForm.requestType === "CHANGE_TIME" ? requestForm.desiredStartTime : undefined,
        desiredEndTime: requestForm.requestType === "CHANGE_TIME" ? requestForm.desiredEndTime : undefined,
        desiredShiftLabel:
          requestForm.requestType === "CHANGE_SHIFT"
            ? availableShifts.find((shift) => String(shift.id) === requestForm.desiredShiftId)?.name
            : undefined,
      });
      setRequestMsg("Đã gửi yêu cầu đổi ca.");
      await load(dateFrom, dateTo);
      setOpenShift(null);
      setAvailableShifts([]);
      setRequestForm({
        requestType: "DROP_SHIFT",
        reason: "",
        desiredShiftId: "",
        desiredStartTime: "06:00",
        desiredEndTime: "07:00",
      });
    } catch (err: any) {
      setRequestMsg(err?.response?.data?.message || "Gửi yêu cầu thất bại.");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        backTo="/store/staff"
        backLabel="Trang nhân viên"
        title="Lịch làm theo tuần"
        subtitle="Theo dõi lịch làm từ Thứ 2 đến Chủ nhật, bao gồm thời gian ca và trạng thái chấm công."
      />
      <div style={cardStyle}>
        {highlightedRequest && (
          <div
            style={{
              padding: 14,
              marginBottom: 16,
              borderRadius: 12,
              border: `1px solid ${highlightedRequest.meta.borderColor}`,
              background: highlightedRequest.meta.background,
              color: highlightedRequest.meta.color,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {highlightedRequest.meta.label} cho yêu cầu #{highlightedRequest.requestId}
            </div>
            <div style={{ fontSize: "0.92rem", lineHeight: 1.5 }}>
              {highlightedRequest.meta.description}
              {highlightedRequest.requestType ? ` Loại yêu cầu: ${highlightedRequest.requestType}.` : ""}
              {highlightedRequest.note ? ` Ghi chú từ quản lý: ${highlightedRequest.note}` : ""}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Tuần</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="cafe-btn-secondary"
              onClick={goPrevWeek}
              disabled={loading}
              style={{ padding: "8px 12px" }}
            >
              ← Tuần trước
            </button>
            <span
              style={{
                minWidth: 180,
                textAlign: "center",
                fontWeight: 600,
                color: "#2f5d3a",
              }}
            >
              {formatDateShortVN(dateFrom)} – {formatDateShortVN(dateTo)}
            </span>
            <button
              type="button"
              className="cafe-btn-secondary"
              onClick={goNextWeek}
              disabled={loading}
              style={{ padding: "8px 12px" }}
            >
              Tuần sau →
            </button>
            <label htmlFor="staff-schedule-filter-week-date" style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>
              Hoặc chọn ngày trong tuần:{" "}
              <input
                id="staff-schedule-filter-week-date"
                type="date"
                value={weekStart}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) handleWeekChange(getWeekStartMonday(v));
                }}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e0" }}
              />
            </label>
            <button
              type="button"
              className="cafe-btn-secondary"
              onClick={() => void load(dateFrom, dateTo)}
              disabled={loading}
              style={{ padding: "8px 12px", marginLeft: 8 }}
            >
              Làm mới
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              background: "#fff1f0",
              color: "#c53030",
              borderRadius: 10,
            }}
          >
            {error}
          </div>
        )}

        {loading && <p>Đang tải...</p>}

        {!loading && items.length === 0 && (
          <p style={{ color: "#666" }}>Chưa có lịch làm trong tuần này.</p>
        )}

        {!loading && items.length > 0 && (
          <WeeklyScheduleGrid
            weekDays={weekDays}
            scheduleByDay={scheduleByDay}
            latestRequestByScheduleId={latestRequestByScheduleId}
            onOpenRequest={(s) => {
              setOpenShift(s);
              setAvailableShifts([]);
              setRequestMsg("");
              setRequestForm({
                requestType: "DROP_SHIFT",
                reason: "",
                desiredShiftId: "",
                desiredStartTime: "06:00",
                desiredEndTime: "07:00",
              });
            }}
          />
        )}

        {requests.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h3 style={{ margin: "0 0 12px", color: "#111827" }}>Lịch sử yêu cầu</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {requests.slice(0, 12).map((request) => {
                const meta = getRequestStatusMeta(String(request.status || "").toLowerCase());
                const note = String(request.detail?.decision?.note || "").trim();
                const requestedAt = String(request.createdAt || request.detail?.requestedAt || "").trim();
                return (
                  <div
                    key={request.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "12px 14px",
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                          <strong style={{ color: "#111827" }}>{getRequestTypeLabel(request)}</strong>
                          <span style={{ fontSize: "0.74rem", padding: "2px 8px", borderRadius: 999, background: meta.background, color: meta.color, fontWeight: 600 }}>
                            {meta.label}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#4b5563", lineHeight: 1.5 }}>
                          {meta.description}
                          {note ? ` Ghi chú quản lý: ${note}` : ""}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {requestedAt ? new Date(requestedAt).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {openShift && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
            <div style={{ width: 560, maxWidth: "92vw", background: "#fff", borderRadius: 14, padding: 16 }}>
              <h3 style={{ margin: "0 0 10px", color: "#2f5d3a" }}>Yêu cầu đổi ca</h3>
              <div style={{ fontSize: "0.9rem", color: "#4a5568", marginBottom: 12 }}>
                Ca hiện tại: {scheduleShiftTitleDisplay({ shiftLabel: openShift.shiftLabel, shiftType: openShift.shiftType })} ({formatDateShortVN(normalizeWorkDate(openShift.workDate))} · {formatTimeVN(openShift.scheduledStartAt)}-{formatTimeVN(openShift.scheduledEndAt)})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>Loại yêu cầu</div>
                  <select
                    className="cafe-select"
                    value={requestForm.requestType}
                    onChange={(e) =>
                      setRequestForm((p) => ({
                        ...p,
                        requestType: e.target.value as any,
                        desiredShiftId: "",
                      }))
                    }
                    style={{ width: "100%", height: 36 }}
                  >
                    <option value="DROP_SHIFT">Xin bỏ ca</option>
                    {canRequestTimeChange(openShift) && (
                      <option value="CHANGE_TIME">Xin đổi thời gian làm</option>
                    )}
                    <option value="CHANGE_SHIFT">Xin đổi sang ca khác</option>
                  </select>
                </label>
                {requestForm.requestType === "CHANGE_SHIFT" && (
                  <label>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Ca mong muốn</div>
                    <select
                      className="cafe-select"
                      value={requestForm.desiredShiftId}
                      onChange={(e) =>
                        setRequestForm((p) => ({
                          ...p,
                          desiredShiftId: e.target.value,
                        }))
                      }
                      disabled={loadingShiftOptions}
                      style={{ width: "100%", height: 36, marginBottom: 8 }}
                    >
                      <option value="">
                        {loadingShiftOptions
                          ? "Đang tải danh sách ca..."
                          : filteredAvailableShifts.length > 0
                            ? "Chọn ca mong muốn"
                            : "Không còn ca thay thế phù hợp"}
                      </option>
                      {filteredAvailableShifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name}
                          {shift.startTime && shift.endTime ? ` (${shift.startTime}-${shift.endTime})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {requestForm.requestType === "CHANGE_TIME" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <label>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>Bắt đầu</div>
                      <select
                        className="cafe-select"
                        value={requestForm.desiredStartTime}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setRequestForm((p) => {
                            let nextEnd = p.desiredEndTime;
                            if (newStart >= p.desiredEndTime) {
                              const found = TIME_OPTIONS.find((t) => t > newStart);
                              if (found) nextEnd = found;
                            }
                            return { ...p, desiredStartTime: newStart, desiredEndTime: nextEnd };
                          });
                        }}
                        style={{ width: "100%", height: 36 }}
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>Kết thúc</div>
                      <select
                        className="cafe-select"
                        value={requestForm.desiredEndTime}
                        onChange={(e) => setRequestForm((p) => ({ ...p, desiredEndTime: e.target.value }))}
                        style={{ width: "100%", height: 36 }}
                      >
                        {TIME_OPTIONS.filter((t) => t > requestForm.desiredStartTime).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                <label>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>Lý do</div>
                  <textarea
                    className="cafe-input"
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm((p) => ({ ...p, reason: e.target.value }))}
                    rows={3}
                    placeholder="Nhập lý do yêu cầu đổi ca"
                    style={{ width: "100%", resize: "vertical" }}
                  />
                </label>
              </div>
              {requestMsg && <div style={{ marginTop: 10, fontSize: "0.85rem", color: requestMsg.includes("thất bại") || requestMsg.includes("Vui lòng") ? "#c53030" : "#2f5d3a" }}>{requestMsg}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button type="button" className="cafe-btn-secondary" onClick={() => setOpenShift(null)}>Đóng</button>
                <button type="button" className="cafe-btn-primary" onClick={submitShiftChangeRequest}>Gửi yêu cầu</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

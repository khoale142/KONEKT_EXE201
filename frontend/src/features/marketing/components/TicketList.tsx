import type { Complaint } from "../../head-officer/api/head-officer.api";
import { formatDate } from "../../../utils/dateUtils";

/* ─── Design tokens ─── */
const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: "#fed7d7", color: "#c53030", label: "Mới" },
  in_progress: { bg: "#c6f6d5", color: "#276749", label: "Đã giao" },
  resolved:    { bg: "#fefcbf", color: "#975a16", label: "Chờ đóng" },
  closed:      { bg: "#e2e8f0", color: "#4a5568", label: "Đã đóng" },
};

const PRIORITY_META: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: "#fed7d7", color: "#c53030", label: "Cao" },
  medium: { bg: "#fefcbf", color: "#975a16", label: "TB" },
  low:    { bg: "#c6f6d5", color: "#276749", label: "Thấp" },
};

const FILTER_TABS = [
  { key: "all",         label: "Tất cả" },
  { key: "open",        label: "Mới" },
  { key: "in_progress", label: "Đã giao" },
  { key: "resolved",    label: "Chờ đóng" },
  { key: "closed",      label: "Đã đóng" },
] as const;

export type FilterKey = (typeof FILTER_TABS)[number]["key"];

type Props = {
  tickets: Complaint[];
  selectedId: number | null;
  filter: FilterKey;
  onFilterChange: (f: FilterKey) => void;
  onSelect: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
};

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function TicketList({ tickets, selectedId, filter, onFilterChange, onSelect, search, onSearchChange }: Props) {
  const countByStatus = (k: FilterKey) =>
    k === "all" ? tickets.length : tickets.filter((t) => t.status === k).length;

  const filtered = tickets.filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        t.store_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f7fafc", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      {/* Search */}
      <div style={{ padding: "12px 12px 8px" }}>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm ticket..."
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 13,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, padding: "0 12px 8px", flexWrap: "wrap" }}>
        {FILTER_TABS.map((tab) => {
          const cnt = countByStatus(tab.key);
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onFilterChange(tab.key)}
              style={{
                padding: "3px 10px",
                borderRadius: 14,
                border: active ? "1.5px solid #3d503c" : "1.5px solid transparent",
                background: active ? "#f0fff4" : "#edf2f7",
                color: active ? "#276749" : "#4a5568",
                fontWeight: active ? 700 : 500,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {tab.label}{" "}
              <span style={{ background: active ? "#3d503c" : "#a0aec0", color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: 10, marginLeft: 2 }}>
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "#a0aec0", fontSize: 13 }}>
            Không có ticket nào
          </div>
        )}
        {filtered.map((t) => {
          const sm = STATUS_META[t.status] ?? STATUS_META.open;
          const pm = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
          const isActive = selectedId === t.id;
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                background: isActive ? "#f0fff4" : "white",
                borderLeft: isActive ? "3px solid #3d503c" : "3px solid transparent",
                transition: "background 0.12s",
              }}
            >
              <div style={{ display: "flex", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
                <Badge {...sm} />
                <Badge {...pm} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, lineHeight: 1.35 }}>
                {t.subject}
              </div>
              <div style={{ color: "#718096", fontSize: 11 }}>
                {t.store_name} · {t.customer_name}
              </div>
              <div style={{ color: "#a0aec0", fontSize: 10, marginTop: 3 }}>
                {formatDate(t.created_at)}
                {t.assigned_to_name ? ` · → ${t.assigned_to_name}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

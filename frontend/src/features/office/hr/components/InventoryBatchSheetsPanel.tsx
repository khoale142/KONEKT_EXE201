import type {
  InventorySheet,
  InventorySheetItem,
} from "../../../staff/api/inventoryAudit.api";

function fmtQty(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return n.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function fmtMoney(value: number | string | null | undefined) {
  if (value == null || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n)) return "--";
  return `${n.toLocaleString("vi-VN")} đ`;
}

function getAuditLabel(status?: string) {
  const s = String(status || "normal").toLowerCase();
  if (s === "critical") return "Nghiêm trọng";
  if (s === "audit") return "Cần kiểm tra";
  return "Bình thường";
}

function getAuditBg(status?: string) {
  const s = String(status || "normal").toLowerCase();
  if (s === "critical") return "#dc2626";
  if (s === "audit") return "#d97706";
  return "#16a34a";
}

export default function InventoryBatchSheetsPanel({
  sheets,
}: {
  sheets: Array<InventorySheet & { items: InventorySheetItem[] }>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid #e5e7eb",
              background: "#f8fafc",
            }}
          >
            <div style={{ fontWeight: 700 }}>{sheet.title}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              {(sheet.items || []).length} dòng • phụ trách:{" "}
              {sheet.responsible_user_name || "--"}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 1100,
              }}
            >
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: 10 }}>Mã hàng</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Tên hàng</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Đơn vị</th>
                  <th style={{ textAlign: "right", padding: 10 }}>Tồn đầu</th>
                  <th style={{ textAlign: "right", padding: 10 }}>Dùng lý thuyết</th>
                  <th style={{ textAlign: "right", padding: 10 }}>Tồn cuối LT</th>
                  <th style={{ textAlign: "right", padding: 10 }}>Tồn thực tế</th>
                  <th style={{ textAlign: "right", padding: 10 }}>Lệch</th>
                  <th style={{ textAlign: "right", padding: 10 }}>% lệch</th>
                  <th style={{ textAlign: "right", padding: 10 }}>Giá trị</th>
                  <th style={{ textAlign: "center", padding: 10 }}>Cảnh báo</th>
                  <th style={{ textAlign: "left", padding: 10 }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {(sheet.items || []).map((item) => {
                  const rowBg =
                    item.audit_status === "critical"
                      ? "#fef2f2"
                      : item.audit_status === "audit"
                        ? "#fffbeb"
                        : "#ffffff";

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderTop: "1px solid #f1f5f9",
                        background: rowBg,
                      }}
                    >
                      <td style={{ padding: 10 }}>{item.ingredient_code}</td>
                      <td style={{ padding: 10 }}>{item.ingredient_name}</td>
                      <td style={{ padding: 10 }}>
                        {item.storage_unit || item.usage_unit || "--"}
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {fmtQty(item.opening_qty)}
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {fmtQty(item.theoretical_used_qty)}
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {fmtQty(item.theoretical_closing_qty)}
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {fmtQty(item.actual_closing_qty)}
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {fmtQty(item.variance_qty)}
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {Number(item.variance_percent || 0).toLocaleString("vi-VN")}%
                      </td>
                      <td style={{ padding: 10, textAlign: "right" }}>
                        {fmtMoney(item.estimated_line_value)}
                      </td>
                      <td style={{ padding: 10, textAlign: "center" }}>
                        <span
                          style={{
                            background: getAuditBg(item.audit_status),
                            color: "#fff",
                            borderRadius: 999,
                            padding: "4px 8px",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {getAuditLabel(item.audit_status)}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}>{item.note || "--"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

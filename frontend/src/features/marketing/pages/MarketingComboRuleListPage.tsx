import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { marketingApi } from "../api/marketing.api";

type ComboRuleListResponse = Awaited<
  ReturnType<typeof marketingApi.listComboRules>
>;
type ComboRuleItem = ComboRuleListResponse["items"][number];

type FlashNotice = {
  type: "success" | "error";
  message: string;
} | null;

function formatMoney(n: number) {
  return `${Number(n || 0).toLocaleString()}đ`;
}

export default function MarketingComboRuleListPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = useState<ComboRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [keyword, setKeyword] = useState("");
  const [isActive, setIsActive] = useState<"" | "true" | "false">("");
  const [flashNotice, setFlashNotice] = useState<FlashNotice>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await marketingApi.listComboRules({
        keyword: keyword.trim() || undefined,
        isActive: isActive === "" ? undefined : isActive === "true",
        limit: 200,
        offset: 0,
      });
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Không tải được danh sách combo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const navNotice = (location.state as any)?.notice;
    if (!navNotice?.message) return;

    setFlashNotice(navNotice);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const activeCount = useMemo(() => items.filter((x) => x.isActive).length, [items]);
  const inactiveCount = Math.max(0, items.length - activeCount);

  return (
    <div style={pageStyle}>
      {flashNotice ? (
        <div
          style={
            flashNotice.type === "success"
              ? successBannerStyle
              : errorBannerStyle
          }
        >
          <div>{flashNotice.message}</div>
          <button
            type="button"
            onClick={() => setFlashNotice(null)}
            style={bannerCloseButtonStyle}
          >
            Đóng
          </button>
        </div>
      ) : null}

      <section style={heroStyle}>
        <div style={heroLeftStyle}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: 8 }}>Quản lý combo giảm giá</h1>
            <p style={heroTextStyle}>
              Combo hiện tại của hệ thống là combo giảm giá theo món-size cụ thể.
            </p>
          </div>

          <div style={heroStatsRowStyle}>
            <div style={heroStatCardStyle}>
              <div style={heroStatLabelStyle}>Tổng combo</div>
              <div style={heroStatValueStyle}>{items.length}</div>
            </div>
            <div style={heroStatCardStyle}>
              <div style={heroStatLabelStyle}>Đang bật</div>
              <div style={{ ...heroStatValueStyle, color: "#166534" }}>
                {activeCount}
              </div>
            </div>
            <div style={heroStatCardStyle}>
              <div style={heroStatLabelStyle}>Đang tắt</div>
              <div style={{ ...heroStatValueStyle, color: "#b91c1c" }}>
                {inactiveCount}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/office/marketing/contents" style={secondaryLinkStyle}>
            Nội dung marketing
          </Link>
          <Link to="/office/marketing/menu" style={secondaryLinkStyle}>
            Quản lý menu
          </Link>
          <Link to="/office/marketing/combos/new" style={primaryLinkStyle}>
            Tạo combo mới
          </Link>
        </div>
      </section>

      <section style={filterCardStyle}>
        <div style={filterGridStyle}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Từ khóa</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tên hoặc code combo..."
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Trạng thái</span>
            <select
              value={isActive}
              onChange={(event) => setIsActive(event.target.value as any)}
              style={inputStyle}
            >
              <option value="">Tất cả</option>
              <option value="true">Đang bật</option>
              <option value="false">Đang tắt</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button type="button" style={primaryButtonStyle} onClick={load}>
            Lọc
          </button>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => {
              setKeyword("");
              setIsActive("");
            }}
          >
            Reset
          </button>
        </div>
      </section>

      {loading ? <div style={panelStyle}>Đang tải danh sách combo...</div> : null}
      {err ? <div style={{ ...panelStyle, color: "#b91c1c" }}>{err}</div> : null}

      {!loading && !err ? (
        <section style={tableCardStyle}>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: "28%" }}>Code</th>
                  <th style={{ ...thStyle, width: "28%" }}>Tên combo</th>
                  <th style={{ ...thStyle, width: "14%" }}>Giá combo</th>
                  <th style={{ ...thStyle, width: "10%" }}>Số món</th>
                  <th style={{ ...thStyle, width: "12%" }}>Trạng thái</th>
                  <th style={{ ...thStyle, width: "8%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>
                      <div style={codeTextStyle}>{item.code}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={nameCellStyle}>{item.name}</div>
                      <div style={subtleCellStyle}>ID: {item.id}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={priceCellStyle}>{formatMoney(item.comboPrice)}</div>
                    </td>
                    <td style={tdStyle}>{item.groupCount}</td>
                    <td style={tdStyle}>
                      <span style={item.isActive ? activeBadgeStyle : inactiveBadgeStyle}>
                        {item.isActive ? "Đang bật" : "Đang tắt"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Link
                        to={`/office/marketing/combos/${item.id}/edit`}
                        style={actionLinkStyle}
                      >
                        Sửa
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td style={emptyCellStyle} colSpan={6}>
                      Chưa có combo nào phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const pageStyle: React.CSSProperties = { display: "grid", gap: 16 };

const heroStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9dce1",
  borderRadius: 18,
  padding: 22,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const heroLeftStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const heroTextStyle: React.CSSProperties = { color: "#6b7280", margin: 0 };

const heroStatsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  width: "100%",
  maxWidth: 520,
};

const heroStatCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#f8fafc",
  padding: "14px 16px",
};

const heroStatLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  marginBottom: 6,
};

const heroStatValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#111827",
};

const filterCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9dce1",
  borderRadius: 18,
  padding: 18,
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #d9dce1",
  borderRadius: 12,
  padding: "10px 12px",
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
};

const panelStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9dce1",
  borderRadius: 18,
  padding: 18,
};

const tableCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d9dce1",
  borderRadius: 18,
  padding: 18,
};

const tableWrapStyle: React.CSSProperties = { overflowX: "auto" };

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid #e5e7eb",
  fontSize: 13,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.25,
};

const tdStyle: React.CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
  overflow: "hidden",
};

const subtleCellStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  marginTop: 4,
};

const codeTextStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#374151",
  wordBreak: "break-word",
};

const nameCellStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#111827",
  wordBreak: "break-word",
};

const priceCellStyle: React.CSSProperties = {
  fontWeight: 700,
  color: "#111827",
};

const activeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontWeight: 700,
  fontSize: 13,
};

const inactiveBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 12px",
  borderRadius: 999,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  fontWeight: 700,
  fontSize: 13,
};

const emptyCellStyle: React.CSSProperties = {
  padding: 18,
  color: "#6b7280",
  textAlign: "center",
};

const actionLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  border: "1px solid #d9dce1",
  borderRadius: 10,
  padding: "8px 12px",
  color: "#374151",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 56,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #2f5c4f",
  background: "#2f5c4f",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d9dce1",
  background: "#fff",
  color: "#374151",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
};

const secondaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  border: "1px solid #d9dce1",
  background: "#fff",
  color: "#374151",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
};

const primaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  border: "1px solid #2f5c4f",
  background: "#2f5c4f",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
};

const successBannerStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#ecfdf5",
  color: "#166534",
  borderRadius: 16,
  padding: "14px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  fontWeight: 700,
};

const errorBannerStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  borderRadius: 16,
  padding: "14px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  fontWeight: 700,
};

const bannerCloseButtonStyle: React.CSSProperties = {
  border: "1px solid currentColor",
  background: "transparent",
  color: "inherit",
  borderRadius: 10,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 700,
  whiteSpace: "nowrap",
};
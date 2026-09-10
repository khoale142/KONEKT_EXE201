import { useState, useEffect } from "react";
import {
  UserPlus,
  CheckCircle2,
  Store,
  UserCheck,
  RefreshCw,
  AlertCircle,
  Sliders,
  X,
} from "lucide-react";
import {
  workspaceApi,
  StoreJoinRequestItem,
  PermissionDefinition,
} from "../../../workspace/api/workspace.api";

export default function StaffJoinRequestsPage() {

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StoreJoinRequestItem[]>([]);
  const [permissionDefs, setPermissionDefs] = useState<PermissionDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Approve & Granular Permissions
  const [approvingReq, setApprovingReq] = useState<StoreJoinRequestItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<"store_manager" | "shift_leader" | "staff">("staff");
  const [activePermissions, setActivePermissions] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);

  // Modal Reject
  const [rejectingReq, setRejectingReq] = useState<StoreJoinRequestItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [reqList, defs] = await Promise.all([
        workspaceApi.getStaffRequests(),
        workspaceApi.getPermissions(),
      ]);
      setRequests(reqList);
      setPermissionDefs(defs);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể tải danh sách yêu cầu nhân sự");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openApproveModal = (req: StoreJoinRequestItem) => {
    setApprovingReq(req);
    const pos = req.desiredPosition?.toLowerCase() || "";
    let initRole: "store_manager" | "shift_leader" | "staff" = "staff";

    if (pos.includes("quản lý") || pos.includes("manager")) {
      initRole = "store_manager";
    } else if (pos.includes("trưởng ca") || pos.includes("leader")) {
      initRole = "shift_leader";
    }

    setSelectedRole(initRole);

    // Bật các quyền mặc định theo role
    const defaultPerms = permissionDefs
      .filter((p) => {
        if (initRole === "store_manager") return p.defaultManager;
        if (initRole === "shift_leader") return p.defaultLeader ?? p.defaultStaff;
        return p.defaultStaff;
      })
      .map((p) => p.key);
    setActivePermissions(defaultPerms);
  };

  const handleRoleChange = (role: "store_manager" | "shift_leader" | "staff") => {
    setSelectedRole(role);
    const defaultPerms = permissionDefs
      .filter((p) => {
        if (role === "store_manager") return p.defaultManager;
        if (role === "shift_leader") return p.defaultLeader ?? p.defaultStaff;
        return p.defaultStaff;
      })
      .map((p) => p.key);
    setActivePermissions(defaultPerms);
  };

  const togglePermission = (key: string) => {
    setActivePermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleConfirmApprove = async () => {
    if (!approvingReq) return;
    try {
      setApproving(true);
      await workspaceApi.approveStaffRequest(approvingReq.id, {
        role: selectedRole,
        storeId: approvingReq.storeId,
        customPermissions: activePermissions,
      });

      setSuccessMsg(`Đã phê duyệt và phân quyền cho ${approvingReq.fullName} thành công.`);
      setApprovingReq(null);
      void loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể phê duyệt yêu cầu");
    } finally {
      setApproving(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingReq) return;
    try {
      setRejecting(true);
      await workspaceApi.rejectStaffRequest(rejectingReq.id, rejectReason.trim() || undefined);

      setSuccessMsg(`Đã từ chối yêu cầu của ${rejectingReq.fullName}.`);
      setRejectingReq(null);
      setRejectReason("");
      void loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err?.response?.data?.message || "Không thể từ chối yêu cầu");
    } finally {
      setRejecting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const displayedRequests = requests.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 0 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#3D503C",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserPlus size={20} />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#2C3B2B", margin: 0 }}>
              Duyệt Nhân Sự & Phân Quyền Tính Năng
            </h1>
            {pendingCount > 0 && (
              <span
                style={{
                  background: "#FEF3C7",
                  color: "#B45309",
                  border: "1px solid #FCD34D",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                {pendingCount} chờ xử lý
              </span>
            )}
          </div>
          <p style={{ color: "#687668", fontSize: "0.88rem", margin: 0 }}>
            Danh sách nhân sự / đối tác nhập mã mời của từng chi nhánh để xin vào làm việc. Chủ quán có
            thể phê duyệt, chọn vai trò và tùy biến bật/tắt từng tính năng chi tiết cho từng người.
          </p>
        </div>

        {/* Action button */}
        <a
          href="/office/hr?tab=employees"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderRadius: 10,
            background: "#FEF8EE",
            border: "1px solid #E4DFD6",
            color: "#3D503C",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
            transition: "all 0.15s ease",
          }}
        >
          <UserCheck size={16} />
          Danh sách nhân sự chính thức →
        </a>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          background: "#FFFFFF",
          padding: "6px 8px",
          borderRadius: 10,
          border: "1px solid #E4DFD6",
          width: "fit-content",
        }}
      >
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            border: "none",
            fontSize: 12.5,
            fontWeight: statusFilter === "all" ? 700 : 500,
            cursor: "pointer",
            background: statusFilter === "all" ? "#2B402D" : "transparent",
            color: statusFilter === "all" ? "#FFFFFF" : "#5A6E5D",
          }}
        >
          Tất cả ({requests.length})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("pending")}
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            border: "none",
            fontSize: 12.5,
            fontWeight: statusFilter === "pending" ? 700 : 500,
            cursor: "pointer",
            background: statusFilter === "pending" ? "#D97706" : "transparent",
            color: statusFilter === "pending" ? "#FFFFFF" : "#92400E",
          }}
        >
          Chờ xử lý ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("approved")}
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            border: "none",
            fontSize: 12.5,
            fontWeight: statusFilter === "approved" ? 700 : 500,
            cursor: "pointer",
            background: statusFilter === "approved" ? "#166534" : "transparent",
            color: statusFilter === "approved" ? "#FFFFFF" : "#166534",
          }}
        >
          Đã duyệt ({approvedCount})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("rejected")}
          style={{
            padding: "6px 14px",
            borderRadius: 7,
            border: "none",
            fontSize: 12.5,
            fontWeight: statusFilter === "rejected" ? 700 : 500,
            cursor: "pointer",
            background: statusFilter === "rejected" ? "#991B1B" : "transparent",
            color: statusFilter === "rejected" ? "#FFFFFF" : "#991B1B",
          }}
        >
          Đã từ chối ({rejectedCount})
        </button>
      </div>

      {successMsg && (
        <div
          style={{
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            color: "#166534",
            padding: "12px 18px",
            borderRadius: 10,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            padding: "12px 18px",
            borderRadius: 10,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Table Container */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          border: "1px solid #E8E0D5",
          overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
        }}
      >
        {loading ? (
          <div style={{ padding: "50px", textAlign: "center", color: "#687668" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px", color: "#2B402D" }} />
            <div>Đang tải yêu cầu nhân sự...</div>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#687668" }}>
            <UserCheck size={36} strokeWidth={1.8} style={{ margin: "0 auto 12px", color: "#A0B8A3" }} />
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#2A3B2C", marginBottom: 4 }}>
              Không có yêu cầu nào
            </div>
            <div style={{ fontSize: "0.85rem" }}>
              Khi nhân sự nhập mã mời nội bộ của các chi nhánh, yêu cầu kích hoạt sẽ xuất hiện tại đây.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#FAF6F3", borderBottom: "1px solid #E8E0D5", color: "#5A6E5D" }}>
                  <th style={{ padding: "12px 18px", fontWeight: 800 }}>Ứng Viên</th>
                  <th style={{ padding: "12px 18px", fontWeight: 800 }}>Chi Nhánh Đăng Ký</th>
                  <th style={{ padding: "12px 18px", fontWeight: 800 }}>Vị Trí & Lời Nhắn</th>
                  <th style={{ padding: "12px 18px", fontWeight: 800 }}>Thời Gian</th>
                  <th style={{ padding: "12px 18px", fontWeight: 800 }}>Trạng Thái</th>
                  <th style={{ padding: "12px 18px", fontWeight: 800, textAlign: "right" }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {displayedRequests.map((r) => {
                  const isPending = r.status === "pending";

                  return (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: "1px solid #F4EFEB",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#FAF8F5")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 800, color: "#2A3B2C" }}>{r.fullName}</div>
                        <div style={{ fontSize: "0.78rem", color: "#687668" }}>{r.email}</div>
                        {r.phone && <div style={{ fontSize: "0.78rem", color: "#687668" }}>{r.phone}</div>}
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 700, color: "#2B402D", display: "flex", alignItems: "center", gap: 5 }}>
                          <Store size={14} />
                          {r.storeName}
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px", maxWidth: 260 }}>
                        <div style={{ fontWeight: 700 }}>{r.desiredPosition || "Nhân viên vận hành"}</div>
                        {r.note && (
                          <div style={{ fontSize: "0.78rem", color: "#687668", fontStyle: "italic", marginTop: 2 }}>
                            "{r.note}"
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px", color: "#687668", fontSize: "0.82rem" }}>
                        {new Date(r.createdAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        {r.status === "pending" && (
                          <span style={{ background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A", padding: "3px 8px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700 }}>
                            Chờ duyệt
                          </span>
                        )}
                        {r.status === "approved" && (
                          <span style={{ background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0", padding: "3px 8px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700 }}>
                            Đã duyệt ({r.assignedRole === "store_manager" ? "Quản lý" : r.assignedRole === "shift_leader" ? "Trưởng ca" : "Nhân viên"})
                          </span>
                        )}
                        {r.status === "rejected" && (
                          <span style={{ background: "#FEF2F2", color: "#991B1B", border: "1px solid #FCA5A5", padding: "3px 8px", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700 }}>
                            Từ chối
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        {isPending ? (
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => openApproveModal(r)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "6px 12px",
                                borderRadius: 7,
                                border: "none",
                                background: "#2B402D",
                                color: "#FFFFFF",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              <Sliders size={13} />
                              Duyệt & Phân quyền
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectingReq(r)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 7,
                                border: "1px solid #E8E0D5",
                                background: "#FFFFFF",
                                color: "#991B1B",
                                fontSize: "0.8rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DUYỆT & TÙY BIẾN PHÂN QUYỀN (Granular Permission Overrides) */}
      {approvingReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FAF6F3",
              border: "1px solid #E8E0D5",
              borderRadius: 16,
              maxWidth: 580,
              width: "100%",
              padding: "28px 26px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setApprovingReq(null)}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                border: "none",
                background: "transparent",
                color: "#687668",
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Sliders size={20} color="#2B402D" />
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#2A3B2C" }}>
                Duyệt & Phân Quyền Tính Năng
              </h2>
            </div>
            <p style={{ color: "#687668", fontSize: "0.85rem", margin: "0 0 18px 0" }}>
              Cấp quyền cho <strong>{approvingReq.fullName}</strong> tại chi nhánh{" "}
              <strong>{approvingReq.storeName}</strong>.
            </p>

            {/* 1. Chọn Base Role */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, marginBottom: 8, color: "#2A3B2C" }}>
                1. Vai trò phân công (Base Role)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {/* Staff */}
                <div
                  onClick={() => handleRoleChange("staff")}
                  style={{
                    border: `2px solid ${selectedRole === "staff" ? "#3D5E46" : "#DFD6C7"}`,
                    background: selectedRole === "staff" ? "#EBF3EC" : "#FFFFFF",
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#27402F" }}>
                    Nhân Viên (staff)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#556B5A", marginTop: 4, lineHeight: 1.4 }}>
                    Bán hàng POS, Bếp KDS, chấm công ca.
                  </div>
                </div>

                {/* Shift Leader */}
                <div
                  onClick={() => handleRoleChange("shift_leader")}
                  style={{
                    border: `2px solid ${selectedRole === "shift_leader" ? "#3D5E46" : "#DFD6C7"}`,
                    background: selectedRole === "shift_leader" ? "#EBF3EC" : "#FFFFFF",
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#27402F" }}>
                    Trưởng Ca (leader)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#556B5A", marginTop: 4, lineHeight: 1.4 }}>
                    Toàn quyền Staff + Chốt ca kiểm quỹ, duyệt kiểm hàng ca.
                  </div>
                </div>

                {/* Store Manager */}
                <div
                  onClick={() => handleRoleChange("store_manager")}
                  style={{
                    border: `2px solid ${selectedRole === "store_manager" ? "#3D5E46" : "#DFD6C7"}`,
                    background: selectedRole === "store_manager" ? "#EBF3EC" : "#FFFFFF",
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#27402F" }}>
                    Quản Lý (manager)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#556B5A", marginTop: 4, lineHeight: 1.4 }}>
                    Toàn quyền Leader + Phân ca, duyệt đổi ca, xem báo cáo doanh thu.
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Bảng Tùy Biến Bật / Tắt Quyền Hạn Chi Tiết */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2A3B2C" }}>
                  2. Tùy biến tính năng (Owner Permission Overrides)
                </label>
                <span style={{ fontSize: "0.75rem", color: "#687668" }}>
                  Bật/tắt các quyền cụ thể bên dưới:
                </span>
              </div>

              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8E0D5",
                  borderRadius: 10,
                  padding: "8px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {permissionDefs.map((p) => {
                  const isChecked = activePermissions.includes(p.key);

                  return (
                    <label
                      key={p.key}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "8px 4px",
                        cursor: "pointer",
                        borderBottom: "1px solid #FAF6F3",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(p.key)}
                        style={{ marginTop: 3, accentColor: "#2B402D", width: 16, height: 16 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.86rem", color: isChecked ? "#2A3B2C" : "#8C9B8E" }}>
                          {p.label}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#687668" }}>
                          {p.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setApprovingReq(null)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #D1DBD2",
                  background: "#FFFFFF",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={approving}
                onClick={handleConfirmApprove}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#2B402D",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  cursor: approving ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {approving && <RefreshCw size={15} className="animate-spin" />}
                {approving ? "Đang xử lý..." : "Xác nhận duyệt & Cấp quyền"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TỪ CHỐI */}
      {rejectingReq && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#FAF6F3",
              border: "1px solid #E8E0D5",
              borderRadius: 14,
              maxWidth: 420,
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
            }}
          >
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 8px 0", color: "#991B1B" }}>
              Từ Chối Yêu Cầu
            </h3>
            <p style={{ color: "#687668", fontSize: "0.85rem", margin: "0 0 16px 0" }}>
              Bạn có chắc chắn muốn từ chối yêu cầu gia nhập của <strong>{rejectingReq.fullName}</strong>?
            </p>

            <textarea
              placeholder="Nhập lý do từ chối (tùy chọn)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #D1DBD2",
                fontSize: "0.88rem",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 16,
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 7,
                  border: "1px solid #D1DBD2",
                  background: "#FFFFFF",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={rejecting}
                onClick={handleConfirmReject}
                style={{
                  padding: "8px 16px",
                  borderRadius: 7,
                  border: "none",
                  background: "#DC2626",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  cursor: rejecting ? "not-allowed" : "pointer",
                }}
              >
                {rejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

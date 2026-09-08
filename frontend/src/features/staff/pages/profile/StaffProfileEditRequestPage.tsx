import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  profileUpdateRequestApi,
  type Profile,
  type ProfileDocument,
} from "../../api/profileUpdateRequest.api";
import { userDocumentsApi, type UserDocument } from "../../api/userDocuments.api";
import { ProfileToastBanner } from "./profileUi";
import { ymdOnly } from "./dateCompare";
import { PageHeader } from "../../../shared/components/PageHeader";

function genderLabel(g: string | null | undefined): string {
  const x = String(g || "").toLowerCase();
  if (x === "male") return "Nam";
  if (x === "female") return "Nữ";
  if (x === "other") return "Khác";
  return g?.trim() ? String(g) : "—";
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

const sectionBox: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 };

type AllowedDocumentType = "profile_photo" | "degree" | "certificate" | "health_record";

type SessionUploadedDocument = {
  documentType: AllowedDocumentType;
  fileName: string;
};

const DOCUMENT_TYPE_OPTIONS: Array<{ value: AllowedDocumentType; label: string }> = [
  { value: "profile_photo", label: "Ảnh thẻ" },
  { value: "degree", label: "Bằng cấp (PDF)" },
  { value: "certificate", label: "Chứng chỉ (PDF)" },
  { value: "health_record", label: "Hồ sơ sức khỏe (PDF)" },
];

const DOCUMENT_TYPE_LABELS: Record<AllowedDocumentType, string> = {
  profile_photo: "Ảnh thẻ",
  degree: "Bằng cấp",
  certificate: "Chứng chỉ",
  health_record: "Hồ sơ sức khỏe",
};

const DOCUMENT_TYPE_ACCEPT: Record<AllowedDocumentType, string> = {
  profile_photo: "image/jpeg,image/jpg,image/png,image/webp,application/pdf",
  degree: "application/pdf",
  certificate: "application/pdf",
  health_record: "application/pdf",
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function getFullFileUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "").trim();
  if (!base) return url;
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

function toProfileDocument(doc: UserDocument): ProfileDocument {
  return {
    id: doc.id,
    documentType: doc.documentType,
    fileName: doc.fileName,
    fileUrl: doc.fileUrl,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt,
  };
}

function buildDocumentNote(docNote: string, uploadedDocuments: SessionUploadedDocument[]): string {
  const manualNote = docNote.trim();
  if (uploadedDocuments.length === 0) return manualNote;
  const uploadSummary = uploadedDocuments
    .map((doc) => `${DOCUMENT_TYPE_LABELS[doc.documentType]}: ${doc.fileName}`)
    .join("; ");
  if (!manualNote) return `Đã upload file bổ sung: ${uploadSummary}`;
  return `${manualNote}\nFile vừa upload: ${uploadSummary}`;
}

/** Chỉ gồm các trường thực sự khác hồ sơ hiện tại (backend cũng kiểm tra lại). */
function buildChangedPayload(params: {
  profile: Profile;
  bankForm: { bankName: string; bankAccountNumber: string; bankAccountHolder: string; bankBranch: string };
  addressForm: { permanentAddress: string; currentAddress: string };
  idForm: { idCardNumber: string; idCardIssueDate: string; idCardIssuePlace: string };
  emergencyForm: {
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelationship: string;
  };
  docNote: string;
  overallNote: string;
  uploadedDocuments: SessionUploadedDocument[];
}): Record<string, unknown> {
  const { profile, bankForm, addressForm, idForm, emergencyForm, docNote, overallNote, uploadedDocuments } = params;
  const out: Record<string, unknown> = {};

  const setIfChanged = (key: keyof Profile | string, formVal: string, profileVal: string | null | undefined) => {
    if (norm(formVal) !== norm(profileVal)) {
      const t = norm(formVal);
      out[key] = t === "" ? null : t;
    }
  };

  setIfChanged("bankName", bankForm.bankName, profile.bankName);
  setIfChanged("bankAccountNumber", bankForm.bankAccountNumber, profile.bankAccountNumber);
  setIfChanged("bankAccountHolder", bankForm.bankAccountHolder, profile.bankAccountHolder);
  setIfChanged("bankBranch", bankForm.bankBranch, profile.bankBranch);

  setIfChanged("permanentAddress", addressForm.permanentAddress, profile.permanentAddress);
  setIfChanged("currentAddress", addressForm.currentAddress, profile.currentAddress);

  setIfChanged("idCardNumber", idForm.idCardNumber, profile.idCardNumber);
  setIfChanged("idCardIssueDate", idForm.idCardIssueDate, profile.idCardIssueDate);
  setIfChanged("idCardIssuePlace", idForm.idCardIssuePlace, profile.idCardIssuePlace);

  setIfChanged("emergencyContactName", emergencyForm.emergencyContactName, profile.emergencyContactName);
  setIfChanged("emergencyContactPhone", emergencyForm.emergencyContactPhone, profile.emergencyContactPhone);
  setIfChanged(
    "emergencyContactRelationship",
    emergencyForm.emergencyContactRelationship,
    profile.emergencyContactRelationship
  );

  const mergedDocumentNote = buildDocumentNote(docNote, uploadedDocuments);
  if (mergedDocumentNote) {
    out.documentNote = mergedDocumentNote;
  }

  const n = overallNote.trim();
  if (n) {
    out.requestNote = n;
  }

  return out;
}

export default function StaffProfileEditRequestPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ variant: "ok" | "err"; text: string } | null>(null);
  const [documentStatus, setDocumentStatus] = useState<{ variant: "ok" | "err"; text: string } | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<AllowedDocumentType>("certificate");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<SessionUploadedDocument[]>([]);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    bankAccountNumber: "",
    bankAccountHolder: "",
    bankBranch: "",
  });
  const [addressForm, setAddressForm] = useState({
    permanentAddress: "",
    currentAddress: "",
  });
  const [idForm, setIdForm] = useState({
    idCardNumber: "",
    idCardIssueDate: "",
    idCardIssuePlace: "",
  });
  const [emergencyForm, setEmergencyForm] = useState({
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
  });
  const [docNote, setDocNote] = useState("");
  const [overallNote, setOverallNote] = useState("");

  const syncProfile = useCallback((p: Profile) => {
    setProfile(p);
    setBankForm({
      bankName: p.bankName ?? "",
      bankAccountNumber: p.bankAccountNumber ?? "",
      bankAccountHolder: p.bankAccountHolder ?? "",
      bankBranch: p.bankBranch ?? "",
    });
    setAddressForm({
      permanentAddress: p.permanentAddress ?? "",
      currentAddress: p.currentAddress ?? "",
    });
    setIdForm({
      idCardNumber: p.idCardNumber ?? "",
      idCardIssueDate: p.idCardIssueDate ?? "",
      idCardIssuePlace: p.idCardIssuePlace ?? "",
    });
    setEmergencyForm({
      emergencyContactName: p.emergencyContactName ?? "",
      emergencyContactPhone: p.emergencyContactPhone ?? "",
      emergencyContactRelationship: p.emergencyContactRelationship ?? "",
    });
  }, []);

  useEffect(() => {
    profileUpdateRequestApi
      .getMyProfile()
      .then((p) => {
        syncProfile(p);
        setBankForm({
          bankName: p.bankName ?? "",
          bankAccountNumber: p.bankAccountNumber ?? "",
          bankAccountHolder: p.bankAccountHolder ?? "",
          bankBranch: p.bankBranch ?? "",
        });
        setAddressForm({
          permanentAddress: p.permanentAddress ?? "",
          currentAddress: p.currentAddress ?? "",
        });
        setIdForm({
          idCardNumber: p.idCardNumber ?? "",
          idCardIssueDate: p.idCardIssueDate ?? "",
          idCardIssuePlace: p.idCardIssuePlace ?? "",
        });
        setEmergencyForm({
          emergencyContactName: p.emergencyContactName ?? "",
          emergencyContactPhone: p.emergencyContactPhone ?? "",
          emergencyContactRelationship: p.emergencyContactRelationship ?? "",
        });
      })
      .catch(() => setToast({ variant: "err", text: "Không tải được hồ sơ." }))
      .finally(() => setLoading(false));
  }, []);

  const changeCount = useMemo(() => {
    if (!profile) return 0;
    const p = buildChangedPayload({
      profile,
      bankForm,
      addressForm,
      idForm,
      emergencyForm,
      docNote,
      overallNote,
      uploadedDocuments,
    });
    return Object.keys(p).length;
  }, [profile, bankForm, addressForm, idForm, emergencyForm, docNote, overallNote, uploadedDocuments]);

  const documents = profile?.documents ?? [];
  const latestDocuments = useMemo(() => {
    const seenTypes = new Set<string>();
    return documents.filter((doc) => {
      if (seenTypes.has(doc.documentType)) return false;
      seenTypes.add(doc.documentType);
      return true;
    });
  }, [documents]);

  const handleDocumentUpload = async (file: File | null) => {
    if (!file) return;
    setDocumentStatus(null);

    try {
      setUploadingDocument(true);
      const uploaded = await userDocumentsApi.uploadMine(selectedDocumentType, file);
      setProfile((current) =>
        current
          ? {
              ...current,
              documents: [toProfileDocument(uploaded), ...(current.documents ?? [])],
            }
          : current
      );
      setUploadedDocuments((current) => [
        ...current,
        {
          documentType: selectedDocumentType,
          fileName: uploaded.fileName,
        },
      ]);
      setDocumentStatus({
        variant: "ok",
        text: `Đã tải lên ${DOCUMENT_TYPE_LABELS[selectedDocumentType].toLowerCase()}.`,
      });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Tải lên hồ sơ đính kèm thất bại.";
      setDocumentStatus({ variant: "err", text: msg });
    } finally {
      setUploadingDocument(false);
    }
  };

  const submitAll = async () => {
    if (!profile) return;
    setToast(null);
    const payload = buildChangedPayload({
      profile,
      bankForm,
      addressForm,
      idForm,
      emergencyForm,
      docNote,
      overallNote,
      uploadedDocuments,
    });
    if (Object.keys(payload).length === 0) {
      setToast({ variant: "err", text: "Chưa có thay đổi nào so với hồ sơ hiện tại." });
      return;
    }
    try {
      setSubmitting(true);
      await profileUpdateRequestApi.createRequest(payload);
      navigate("/store/staff/profile", {
        state: { profileToast: "Đã gửi một phiếu yêu cầu tổng hợp. Quản lý/HR sẽ xử lý khi có thể." },
      });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gửi yêu cầu thất bại.";
      setToast({ variant: "err", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 880,
        margin: "0 auto",
        display: "flex",
        justifyContent: "flex-start",
      }}
    >
      {toast ? (
        <ProfileToastBanner message={toast.text} variant={toast.variant} onDismiss={() => setToast(null)} />
      ) : null}
      <div style={{ width: "100%", maxWidth: 720 }}>
        <PageHeader
          backTo="/store/staff/profile"
          backLabel="Hồ sơ cá nhân"
          title="Yêu cầu chỉnh sửa hồ sơ"
          subtitle="Chỉnh sửa các trường được phép, rồi gửi một phiếu duy nhất — chỉ những trường bạn thay đổi mới được gửi lên."
        />

        <div style={cardStyle}>
          <div style={{ display: "grid", gap: 18 }}>
            <section style={sectionBox}>
              <h3 style={{ margin: "0 0 8px" }}>Phân quyền chỉnh sửa</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#4a5568", fontSize: 14, lineHeight: 1.6 }}>
                <li>
                  <strong>Chỉ xem, không gửi qua form này:</strong> họ tên, SĐT, email, giới tính, ngày sinh (do quản lý cửa hàng); tên đăng nhập, vai trò, cửa hàng, loại hợp đồng (do quản trị).
                </li>
                <li>
                  <strong>Có thể gửi trong phiếu tổng hợp:</strong> ngân hàng, địa chỉ, CCCD, liên hệ khẩn cấp, ghi chú hồ sơ đính kèm, ghi chú chung cho quản lý/HR.
                </li>
              </ul>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Thông tin cá nhân (tham khảo)</h3>
              <p style={{ color: "#64748b", margin: "0 0 12px", fontSize: 14 }}>
                Muốn sửa các trường này, vui lòng liên hệ trực tiếp quản lý cửa hàng.
              </p>
              {profile ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                    fontSize: 14,
                  }}
                >
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Họ và tên</div>
                    <div style={{ fontWeight: 600 }}>{profile.fullName?.trim() || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Số điện thoại</div>
                    <div style={{ fontWeight: 600 }}>{profile.phone?.trim() || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Email</div>
                    <div style={{ fontWeight: 600 }}>{profile.email?.trim() || "—"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Giới tính</div>
                    <div style={{ fontWeight: 600 }}>{genderLabel(profile.gender)}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Ngày sinh</div>
                    <div style={{ fontWeight: 600 }}>{ymdOnly(profile.dateOfBirth ?? null) || "—"}</div>
                  </div>
                </div>
              ) : null}
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Ngân hàng</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="Ngân hàng"
                />
                <input
                  className="cafe-input"
                  value={bankForm.bankAccountNumber}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                  placeholder="Số tài khoản"
                />
                <input
                  className="cafe-input"
                  value={bankForm.bankAccountHolder}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankAccountHolder: e.target.value }))}
                  placeholder="Chủ tài khoản"
                />
                <input
                  className="cafe-input"
                  value={bankForm.bankBranch}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankBranch: e.target.value }))}
                  placeholder="Chi nhánh"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Địa chỉ</h3>
              <div style={{ display: "grid", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={addressForm.permanentAddress}
                  onChange={(e) => setAddressForm((p) => ({ ...p, permanentAddress: e.target.value }))}
                  placeholder="Địa chỉ thường trú"
                />
                <input
                  className="cafe-input"
                  value={addressForm.currentAddress}
                  onChange={(e) => setAddressForm((p) => ({ ...p, currentAddress: e.target.value }))}
                  placeholder="Địa chỉ hiện tại"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Giấy tờ tùy thân</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={idForm.idCardNumber}
                  onChange={(e) => setIdForm((p) => ({ ...p, idCardNumber: e.target.value }))}
                  placeholder="Số CCCD/CMND"
                />
                <input
                  className="cafe-input"
                  type="date"
                  value={idForm.idCardIssueDate}
                  onChange={(e) => setIdForm((p) => ({ ...p, idCardIssueDate: e.target.value }))}
                />
                <input
                  className="cafe-input"
                  value={idForm.idCardIssuePlace}
                  onChange={(e) => setIdForm((p) => ({ ...p, idCardIssuePlace: e.target.value }))}
                  placeholder="Nơi cấp"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Liên hệ khẩn cấp</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={emergencyForm.emergencyContactName}
                  onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
                  placeholder="Tên liên hệ khẩn cấp"
                />
                <input
                  className="cafe-input"
                  value={emergencyForm.emergencyContactPhone}
                  onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))}
                  placeholder="SĐT liên hệ khẩn cấp"
                />
                <input
                  className="cafe-input"
                  value={emergencyForm.emergencyContactRelationship}
                  onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactRelationship: e.target.value }))}
                  placeholder="Quan hệ"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Hồ sơ đính kèm</h3>
              <p style={{ color: "#666", marginTop: 0, fontSize: 14 }}>
                Mô tả nội dung cần bổ sung hoặc cập nhật file (quản lý/HR xử lý thủ công).
              </p>
              {documentStatus ? (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: documentStatus.variant === "ok" ? "#f0fff4" : "#fff1f0",
                    color: documentStatus.variant === "ok" ? "#2f855a" : "#c53030",
                  }}
                >
                  {documentStatus.text}
                </div>
              ) : null}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 220px) minmax(0, 1fr)",
                  gap: 12,
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <select
                  className="cafe-input"
                  value={selectedDocumentType}
                  onChange={(e) => setSelectedDocumentType(e.target.value as AllowedDocumentType)}
                  disabled={uploadingDocument}
                >
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 14px",
                    border: "1px dashed #94a3b8",
                    borderRadius: 12,
                    cursor: uploadingDocument ? "wait" : "pointer",
                    color: "#334155",
                  }}
                >
                  <span>{uploadingDocument ? "Đang tải lên..." : "Chọn file để tải lên"}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {selectedDocumentType === "profile_photo" ? "Ảnh/PDF" : "PDF"}
                  </span>
                  <input
                    type="file"
                    accept={DOCUMENT_TYPE_ACCEPT[selectedDocumentType]}
                    disabled={uploadingDocument}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      void handleDocumentUpload(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <textarea
                className="cafe-input"
                value={docNote}
                onChange={(e) => setDocNote(e.target.value)}
                placeholder="Ví dụ: cần cập nhật bản scan CCCD mới..."
                style={{ minHeight: 90, marginBottom: 12 }}
              />
              {uploadedDocuments.length > 0 ? (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>File vừa upload trong phiếu này</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#334155" }}>
                    {uploadedDocuments.map((doc, index) => (
                      <li key={`${doc.documentType}-${doc.fileName}-${index}`}>
                        {DOCUMENT_TYPE_LABELS[doc.documentType]}: {doc.fileName}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>File đã có trong hồ sơ</div>
                {latestDocuments.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 14 }}>Chưa có file đính kèm nào.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {latestDocuments.map((doc) => (
                      <a
                        key={doc.id}
                        href={getFullFileUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "10px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          color: "#1d4ed8",
                          textDecoration: "none",
                        }}
                      >
                        <span>
                          [{DOCUMENT_TYPE_LABELS[doc.documentType as AllowedDocumentType] ?? doc.documentType}] {doc.fileName}
                        </span>
                        <span style={{ color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                          {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString("vi-VN") : "-"}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Ghi chú chung (tuỳ chọn)</h3>
              <p style={{ color: "#64748b", marginTop: 0, fontSize: 14 }}>
                Gửi kèm lời nhắn cho quản lý/HR về toàn bộ phiếu (không thay thế nội dung các trường bên trên).
              </p>
              <textarea
                className="cafe-input"
                value={overallNote}
                onChange={(e) => setOverallNote(e.target.value)}
                placeholder="Ví dụ: em đổi địa chỉ và STK cùng lúc vì chuyển tỉnh..."
                style={{ minHeight: 80 }}
              />
            </section>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: 8,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: 14, color: "#475569" }}>
                Số trường sẽ gửi: <strong>{changeCount}</strong>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link to="/store/staff/profile" className="cafe-btn-secondary" style={{ textDecoration: "none" }}>
                  Huỷ
                </Link>
                <button
                  type="button"
                  className="cafe-btn-primary"
                  disabled={submitting || uploadingDocument || changeCount === 0}
                  onClick={() => void submitAll()}
                >
                  {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

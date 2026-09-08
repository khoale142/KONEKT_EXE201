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

type AllowedDocumentType = "profile_photo" | "degree" | "certificate" | "health_record";

type SessionUploadedDocument = {
  documentType: AllowedDocumentType;
  fileName: string;
};

const DOCUMENT_TYPE_OPTIONS: Array<{ value: AllowedDocumentType; label: string }> = [
  { value: "profile_photo", label: "Anh the" },
  { value: "degree", label: "Bang cap (PDF)" },
  { value: "certificate", label: "Chung chi (PDF)" },
  { value: "health_record", label: "Ho so suc khoe (PDF)" },
];

const DOCUMENT_TYPE_LABELS: Record<AllowedDocumentType, string> = {
  profile_photo: "Anh the",
  degree: "Bang cap",
  certificate: "Chung chi",
  health_record: "Ho so suc khoe",
};

const DOCUMENT_TYPE_ACCEPT: Record<AllowedDocumentType, string> = {
  profile_photo: "image/jpeg,image/jpg,image/png,image/webp,application/pdf",
  degree: "application/pdf",
  certificate: "application/pdf",
  health_record: "application/pdf",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

const sectionBox: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 };

function genderLabel(g: string | null | undefined): string {
  const x = String(g || "").toLowerCase();
  if (x === "male") return "Nam";
  if (x === "female") return "Nu";
  if (x === "other") return "Khac";
  return g?.trim() ? String(g) : "-";
}

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
  if (!manualNote) {
    return `Da upload file bo sung: ${uploadSummary}`;
  }
  return `${manualNote}\nFile vua upload: ${uploadSummary}`;
}

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
      const trimmed = norm(formVal);
      out[key] = trimmed === "" ? null : trimmed;
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

  const requestNote = overallNote.trim();
  if (requestNote) {
    out.requestNote = requestNote;
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
      })
      .catch(() => setToast({ variant: "err", text: "Khong tai duoc ho so." }))
      .finally(() => setLoading(false));
  }, [syncProfile]);

  const changeCount = useMemo(() => {
    if (!profile) return 0;
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
    return Object.keys(payload).length;
  }, [profile, bankForm, addressForm, idForm, emergencyForm, docNote, overallNote, uploadedDocuments]);

  const documents = profile?.documents ?? [];

  async function handleDocumentUpload(file: File | null) {
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
        text: `Da tai len ${DOCUMENT_TYPE_LABELS[selectedDocumentType].toLowerCase()}.`,
      });
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Tai len ho so dinh kem that bai.";
      setDocumentStatus({ variant: "err", text: message });
    } finally {
      setUploadingDocument(false);
    }
  }

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
      setToast({ variant: "err", text: "Chua co thay doi nao so voi ho so hien tai." });
      return;
    }
    try {
      setSubmitting(true);
      await profileUpdateRequestApi.createRequest(payload);
      navigate("/store/staff/profile", {
        state: { profileToast: "Da gui mot phieu yeu cau tong hop. Quan ly/HR se xu ly khi co the." },
      });
    } catch (e: unknown) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Gui yeu cau that bai.";
      setToast({ variant: "err", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Dang tai...</p>
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
          backLabel="Ho so ca nhan"
          title="Yeu cau chinh sua ho so"
          subtitle="Chinh sua cac truong duoc phep, tai len ho so dinh kem neu can, roi gui mot phieu duy nhat."
        />

        <div style={cardStyle}>
          <div style={{ display: "grid", gap: 18 }}>
            <section style={sectionBox}>
              <h3 style={{ margin: "0 0 8px" }}>Phan quyen chinh sua</h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#4a5568", fontSize: 14, lineHeight: 1.6 }}>
                <li>
                  <strong>Chi xem, khong gui qua form nay:</strong> ho ten, SDT, email, gioi tinh, ngay sinh; ten dang
                  nhap, vai tro, cua hang, loai hop dong.
                </li>
                <li>
                  <strong>Co the gui trong phieu tong hop:</strong> ngan hang, dia chi, CCCD, lien he khan cap, ho so dinh
                  kem, ghi chu cho quan ly/HR.
                </li>
              </ul>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Thong tin ca nhan (tham khao)</h3>
              <p style={{ color: "#64748b", margin: "0 0 12px", fontSize: 14 }}>
                Muon sua cac truong nay, vui long lien he truc tiep quan ly cua hang.
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
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Ho va ten</div>
                    <div style={{ fontWeight: 600 }}>{profile.fullName?.trim() || "-"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>So dien thoai</div>
                    <div style={{ fontWeight: 600 }}>{profile.phone?.trim() || "-"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Email</div>
                    <div style={{ fontWeight: 600 }}>{profile.email?.trim() || "-"}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Gioi tinh</div>
                    <div style={{ fontWeight: 600 }}>{genderLabel(profile.gender)}</div>
                  </div>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Ngay sinh</div>
                    <div style={{ fontWeight: 600 }}>{ymdOnly(profile.dateOfBirth ?? null) || "-"}</div>
                  </div>
                </div>
              ) : null}
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Ngan hang</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="Ngan hang"
                />
                <input
                  className="cafe-input"
                  value={bankForm.bankAccountNumber}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                  placeholder="So tai khoan"
                />
                <input
                  className="cafe-input"
                  value={bankForm.bankAccountHolder}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankAccountHolder: e.target.value }))}
                  placeholder="Chu tai khoan"
                />
                <input
                  className="cafe-input"
                  value={bankForm.bankBranch}
                  onChange={(e) => setBankForm((p) => ({ ...p, bankBranch: e.target.value }))}
                  placeholder="Chi nhanh"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Dia chi</h3>
              <div style={{ display: "grid", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={addressForm.permanentAddress}
                  onChange={(e) => setAddressForm((p) => ({ ...p, permanentAddress: e.target.value }))}
                  placeholder="Dia chi thuong tru"
                />
                <input
                  className="cafe-input"
                  value={addressForm.currentAddress}
                  onChange={(e) => setAddressForm((p) => ({ ...p, currentAddress: e.target.value }))}
                  placeholder="Dia chi hien tai"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Giay to tuy than</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={idForm.idCardNumber}
                  onChange={(e) => setIdForm((p) => ({ ...p, idCardNumber: e.target.value }))}
                  placeholder="So CCCD/CMND"
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
                  placeholder="Noi cap"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Lien he khan cap</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <input
                  className="cafe-input"
                  value={emergencyForm.emergencyContactName}
                  onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
                  placeholder="Ten lien he khan cap"
                />
                <input
                  className="cafe-input"
                  value={emergencyForm.emergencyContactPhone}
                  onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))}
                  placeholder="SDT lien he khan cap"
                />
                <input
                  className="cafe-input"
                  value={emergencyForm.emergencyContactRelationship}
                  onChange={(e) => setEmergencyForm((p) => ({ ...p, emergencyContactRelationship: e.target.value }))}
                  placeholder="Quan he"
                />
              </div>
            </section>

            <section style={sectionBox}>
              <h3 style={{ marginTop: 0 }}>Ho so dinh kem</h3>
              <p style={{ color: "#666", marginTop: 0, fontSize: 14, lineHeight: 1.6 }}>
                Ban co the tai file ngay trong form nay. Sau khi upload, ten file moi se duoc dua vao noi dung yeu cau de
                quan ly/HR de doi chieu.
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
                  <span>{uploadingDocument ? "Dang tai len..." : "Chon file de tai len"}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {selectedDocumentType === "profile_photo" ? "Anh/PDF" : "PDF"}
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
                placeholder="Ghi chu them ve file vua bo sung, vi du: cap nhat ban scan CCCD moi..."
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
                  <div style={{ fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>File vua upload trong phieu nay</div>
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
                <div style={{ fontWeight: 700, color: "#0f172a" }}>File da co trong ho so</div>
                {documents.length === 0 ? (
                  <div style={{ color: "#64748b", fontSize: 14 }}>Chua co file dinh kem nao.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {documents.map((doc) => (
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
              <h3 style={{ marginTop: 0 }}>Ghi chu chung (tuy chon)</h3>
              <p style={{ color: "#64748b", marginTop: 0, fontSize: 14 }}>Gui kem loi nhan cho quan ly/HR ve toan bo phieu.</p>
              <textarea
                className="cafe-input"
                value={overallNote}
                onChange={(e) => setOverallNote(e.target.value)}
                placeholder="Vi du: em doi dia chi va STK cung luc vi chuyen tinh..."
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
                So truong se gui: <strong>{changeCount}</strong>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link to="/store/staff/profile" className="cafe-btn-secondary" style={{ textDecoration: "none" }}>
                  Huy
                </Link>
                <button
                  type="button"
                  className="cafe-btn-primary"
                  disabled={submitting || uploadingDocument || changeCount === 0}
                  onClick={() => void submitAll()}
                >
                  {submitting ? "Dang gui..." : "Gui yeu cau"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

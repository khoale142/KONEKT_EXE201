import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import HrPageHeader from "../components/HrPageHeader";
import {
  hrEmployeeProfileApi,
  type HrEmployeeDocument,
  type HrEmployeeProfile,
} from "../api/hrEmployeeProfile.api";
import { clearHrEmployeeDirectoryCache } from "../api/hrEmployeeDirectory.api";
import { headOfficerApi } from "../../../head-officer/api/head-officer.api";
import { employmentTypeLabelVi } from "../../../shared/utils/employmentShiftTypes";
import { dash } from "../../../shared/dashboard/dashboardUi";

const pageFont = 'var(--font-sans, "DM Sans", system-ui, sans-serif)';

const cardStyle: React.CSSProperties = {
  background: "#fffdf9",
  borderRadius: 16,
  border: "1px solid #ddd8cc",
  padding: 20,
  boxShadow: "0 10px 28px rgba(47, 93, 58, 0.08)",
  fontFamily: pageFont,
};

function getFileUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base =
    (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "").trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");

  if (!base) return url;
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function formatCurrencyVnd(value: number | null | undefined) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${safeValue.toLocaleString("vi-VN")} \u0111`;
}

function groupDocuments(documents: HrEmployeeDocument[]) {
  return {
    profile_photo: documents.filter((doc) => doc.documentType === "profile_photo"),
    degree: documents.filter((doc) => doc.documentType === "degree"),
    certificate: documents.filter((doc) => doc.documentType === "certificate"),
    health_record: documents.filter((doc) => doc.documentType === "health_record"),
    other: documents.filter(
      (doc) =>
        !["profile_photo", "degree", "certificate", "health_record"].includes(doc.documentType),
    ),
  };
}

export default function HREmployeeDetailWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [search] = useSearchParams();

  const userId = Number(id);
  const storeId = Number(search.get("storeId"));
  const promptUpdateWage = search.get("prompt") === "update-wage";
  const postApproveMessage =
    typeof (location.state as { postApproveMessage?: unknown } | null)?.postApproveMessage === "string"
      ? String((location.state as { postApproveMessage?: string }).postApproveMessage)
      : "";

  const [profile, setProfile] = useState<HrEmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditingWage, setIsEditingWage] = useState(promptUpdateWage);
  const [wageInput, setWageInput] = useState("0");
  const [wageError, setWageError] = useState("");
  const [wageMessage, setWageMessage] = useState<string | null>(null);
  const [wageSaving, setWageSaving] = useState(false);
  const wageInputRef = useRef<HTMLInputElement | null>(null);

  const isPartTimeEmployee = profile?.employmentType === "part_time";
  const shouldPromptHourlyWage = promptUpdateWage && isPartTimeEmployee;
  const hireApprovalNotice = postApproveMessage
    ? isPartTimeEmployee
      ? postApproveMessage
      : "Nh\u00e2n vi\u00ean to\u00e0n th\u1eddi gian s\u1ebd theo flow l\u01b0\u01a1ng th\u00e1ng, kh\u00f4ng c\u1ea7n c\u1eadp nh\u1eadt l\u01b0\u01a1ng gi\u1edd t\u1ea1i \u0111\u00e2y."
    : "";

  useEffect(() => {
    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(storeId) || storeId <= 0) {
      setError("Thi\u1ebfu th\u00f4ng tin nh\u00e2n vi\u00ean ho\u1eb7c c\u1eeda h\u00e0ng (`storeId` tr\u00ean URL).");
      setLoading(false);
      return;
    }

    hrEmployeeProfileApi
      .getEmployeeProfile(storeId, userId)
      .then((data) => {
        setProfile(data);
        setError("");
      })
      .catch((e: unknown) => {
        const res = (e as { response?: { data?: { message?: string }; status?: number } })?.response;
        const msg = res?.data?.message;
        setError(
          msg && typeof msg === "string"
            ? msg
            : res?.status === 404
              ? "Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1 nh\u00e2n vi\u00ean."
              : "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c h\u1ed3 s\u01a1 nh\u00e2n vi\u00ean. Vui l\u00f2ng th\u1eed l\u1ea1i.",
        );
      })
      .finally(() => setLoading(false));
  }, [storeId, userId]);

  useEffect(() => {
    setWageInput(profile?.hourlyWage != null ? String(Number(profile.hourlyWage)) : "0");
  }, [profile?.hourlyWage]);

  useEffect(() => {
    if (!shouldPromptHourlyWage) return;
    setIsEditingWage(true);
  }, [shouldPromptHourlyWage]);

  useEffect(() => {
    if (!isEditingWage || !isPartTimeEmployee) return;
    wageInputRef.current?.focus();
    wageInputRef.current?.select();
  }, [isEditingWage, isPartTimeEmployee]);

  useEffect(() => {
    if (isPartTimeEmployee) return;
    setIsEditingWage(false);
    setWageError("");
  }, [isPartTimeEmployee]);

  async function handleSaveWage() {
    if (!profile || !isPartTimeEmployee) return;

    const normalized = wageInput.trim();
    const nextWage = Number(normalized);

    if (!normalized) {
      setWageError("Vui l\u00f2ng nh\u1eadp l\u01b0\u01a1ng gi\u1edd.");
      return;
    }

    if (!Number.isFinite(nextWage) || nextWage < 0) {
      setWageError("L\u01b0\u01a1ng gi\u1edd ph\u1ea3i l\u00e0 s\u1ed1 kh\u00f4ng \u00e2m.");
      return;
    }

    setWageSaving(true);
    setWageError("");
    setWageMessage(null);

    try {
      const updated = await headOfficerApi.updateStaffWage(profile.id, storeId, nextWage);
      clearHrEmployeeDirectoryCache();
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              hourlyWage: Number(updated.hourly_wage ?? nextWage),
            }
          : prev,
      );
      setWageInput(String(Number(updated.hourly_wage ?? nextWage)));
      setIsEditingWage(false);
      setWageMessage("\u0110\u00e3 c\u1eadp nh\u1eadt l\u01b0\u01a1ng gi\u1edd cho nh\u00e2n vi\u00ean.");

      if (shouldPromptHourlyWage) {
        navigate(`/office/hr/employees/${profile.id}?storeId=${storeId}`, { replace: true });
      }
    } catch (e: any) {
      setWageError(e?.response?.data?.message || "Kh\u00f4ng l\u01b0u \u0111\u01b0\u1ee3c l\u01b0\u01a1ng gi\u1edd. Vui l\u00f2ng th\u1eed l\u1ea1i.");
    } finally {
      setWageSaving(false);
    }
  }

  const docs = useMemo(() => groupDocuments(profile?.documents ?? []), [profile?.documents]);
  const avatarDisplayUrl =
    (profile?.avatarUrl && getFileUrl(profile.avatarUrl)) ||
    (docs.profile_photo[0]?.mimeType?.startsWith("image/")
      ? getFileUrl(docs.profile_photo[0].fileUrl)
      : "");
  const avatarPlaceholder = (profile?.fullName ?? "").trim().slice(0, 1).toUpperCase() || "\u2014";

  return (
    <div style={{ fontFamily: pageFont, fontWeight: 500 }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/office/hr/employees" style={{ color: "#3182ce", fontWeight: 600, textDecoration: "none" }}>
          {"\u2190 Danh s\u00e1ch nh\u00e2n s\u1ef1"}
        </Link>
      </div>

      <HrPageHeader
        title={"H\u1ed3 s\u01a1 nh\u00e2n vi\u00ean"}
        description={"HR xem h\u1ed3 s\u01a1 nh\u00e2n vi\u00ean v\u00e0 c\u1eadp nh\u1eadt l\u01b0\u01a1ng gi\u1edd ngay tr\u00ean trang chi ti\u1ebft."}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <HeaderMetric label={"Vai tr\u00f2"} value={profile?.roleName ?? "\u2014"} />
          <HeaderMetric label={"Lo\u1ea1i h\u00ecnh"} value={employmentTypeLabelVi(profile?.employmentType)} />
          <HeaderMetric label={"L\u01b0\u01a1ng gi\u1edd"} value={formatCurrencyVnd(profile?.hourlyWage)} />
        </div>
      </HrPageHeader>

      {hireApprovalNotice ? (
        <div style={promptNoticeStyle}>
          <strong style={{ display: "block", marginBottom: 4 }}>{"Nh\u00e2n vi\u00ean m\u1edbi \u0111\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t."}</strong>
          {hireApprovalNotice}
        </div>
      ) : null}

      {shouldPromptHourlyWage ? (
        <div style={warningNoticeStyle}>
          {"Vui l\u00f2ng c\u1eadp nh\u1eadt l\u01b0\u01a1ng gi\u1edd cho nh\u00e2n vi\u00ean n\u00e0y ngay trong b\u01b0\u1edbc ti\u1ebfp theo \u0111\u1ec3 flow tuy\u1ec3n d\u1ee5ng kh\u00f4ng b\u1ecb gi\u00e1n \u0111o\u1ea1n."}
        </div>
      ) : null}

      {wageMessage ? <div style={successNoticeStyle}>{wageMessage}</div> : null}

      {loading ? <p style={{ color: dash.muted }}>{"\u0110ang t\u1ea3i..."}</p> : null}
      {error ? (
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
      ) : null}

      {profile ? (
        <div style={{ display: "grid", gap: 18 }}>
          <section style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 20,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 14,
                  background: "#e8e8e8",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatarDisplayUrl ? (
                  <img
                    src={avatarDisplayUrl}
                    alt={profile.fullName ?? "\u1ea2nh \u0111\u1ea1i di\u1ec7n"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 32, fontWeight: 600, color: "#888" }}>{avatarPlaceholder}</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 260 }}>
                <h2 style={{ marginTop: 0, marginBottom: 4, color: "#16301f", fontWeight: 600 }}>
                  {profile.fullName ?? "H\u1ed3 s\u01a1 nh\u00e2n vi\u00ean"}
                </h2>
                <p style={{ color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                  {"Th\u00f4ng tin h\u1ed3 s\u01a1, li\u00ean h\u1ec7, gi\u1ea5y t\u1edd v\u00e0 t\u00e0i li\u1ec7u \u0111\u00ednh k\u00e8m \u0111\u01b0\u1ee3c t\u1ed5ng h\u1ee3p \u0111\u1ec3 HR tra c\u1ee9u nhanh khi x\u1eed l\u00fd nh\u00e2n s\u1ef1."}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <FieldCard label={"H\u1ecd t\u00ean"} value={profile.fullName} />
              <FieldCard label={"S\u1ed1 \u0111i\u1ec7n tho\u1ea1i"} value={profile.phone} />
              <FieldCard label="Email" value={profile.email} />
              <FieldCard label="Username" value={profile.username} />
              <FieldCard label={"Ng\u00e0y sinh"} value={formatDate(profile.dateOfBirth)} />
              <FieldCard label={"Gi\u1edbi t\u00ednh"} value={profile.gender} />
              <FieldCard label={"Vai tr\u00f2"} value={profile.roleName} />
              <FieldCard label={"Lo\u1ea1i h\u00ecnh l\u00e0m vi\u1ec7c"} value={employmentTypeLabelVi(profile.employmentType)} />
              <FieldCard
                label={"C\u1eeda h\u00e0ng"}
                value={profile.storeNames?.length ? profile.storeNames.join(", ") : "\u2014"}
                wide
              />
              <FieldCard
                label={"\u0110\u1ecba ch\u1ec9"}
                value={profile.address ?? profile.currentAddress ?? profile.permanentAddress}
                wide
              />
              <FieldCard label="CCCD / CMND" value={profile.idCardNumber} />
              <FieldCard label={"Ng\u00e0y c\u1ea5p CCCD"} value={formatDate(profile.idCardIssueDate)} />
              <FieldCard label={"N\u01a1i c\u1ea5p CCCD"} value={profile.idCardIssuePlace} />
              <FieldCard label={"Ng\u01b0\u1eddi li\u00ean h\u1ec7 kh\u1ea9n c\u1ea5p"} value={profile.emergencyContactName} />
              <FieldCard label={"S\u0110T kh\u1ea9n c\u1ea5p"} value={profile.emergencyContactPhone} />
              <FieldCard label={"Quan h\u1ec7 kh\u1ea9n c\u1ea5p"} value={profile.emergencyContactRelationship} />
            </div>
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: "#16301f" }}>{"Th\u00f4ng tin nh\u1eadn l\u01b0\u01a1ng"}</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <FieldCard label={"Ng\u00e2n h\u00e0ng"} value={profile.bankName} />
              <FieldCard label={"S\u1ed1 t\u00e0i kho\u1ea3n"} value={profile.bankAccountNumber} />
              <FieldCard label={"Ch\u1ee7 t\u00e0i kho\u1ea3n"} value={profile.bankAccountHolder} />
              <FieldCard label={"Chi nh\u00e1nh"} value={profile.bankBranch} />
              <FieldCard
                label={"L\u01b0\u01a1ng theo gi\u1edd"}
                value={isPartTimeEmployee ? formatCurrencyVnd(profile.hourlyWage) : "Kh\u00f4ng \u00e1p d\u1ee5ng"}
              />
              <FieldCard
                label={"L\u01b0\u01a1ng c\u01a1 b\u1ea3n"}
                value={profile.baseSalary != null ? formatCurrencyVnd(profile.baseSalary) : "\u2014"}
              />
            </div>

            {isPartTimeEmployee ? (
              <div style={wageEditorCardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#16301f" }}>{"C\u1eadp nh\u1eadt l\u01b0\u01a1ng gi\u1edd"}</div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
                      {"D\u00f9ng cho flow onboarding sau khi duy\u1ec7t tuy\u1ec3n d\u1ee5ng v\u00e0 \u0111\u1ec3 HR ch\u1ec9nh m\u1ee9c l\u01b0\u01a1ng gi\u1edd ch\u00ednh th\u1ee9c."}
                    </div>
                  </div>
                  {!isEditingWage ? (
                    <button type="button" style={wagePrimaryBtnStyle} onClick={() => setIsEditingWage(true)}>
                      {"Ch\u1ec9nh s\u1eeda l\u01b0\u01a1ng"}
                    </button>
                  ) : null}
                </div>

                {isEditingWage ? (
                  <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#33523f" }}>{"L\u01b0\u01a1ng gi\u1edd m\u1edbi"}</span>
                      <input
                        ref={wageInputRef}
                        type="number"
                        min={0}
                        step={1000}
                        value={wageInput}
                        onChange={(e) => setWageInput(e.target.value)}
                        style={wageInputStyle}
                        placeholder={"V\u00ed d\u1ee5: 25000"}
                      />
                    </label>

                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {"Gi\u00e1 tr\u1ecb hi\u1ec7n t\u1ea1i: "}<strong>{formatCurrencyVnd(profile.hourlyWage)}</strong>
                    </div>

                    {wageError ? <div style={wageErrorStyle}>{wageError}</div> : null}

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                      {!shouldPromptHourlyWage ? (
                        <button
                          type="button"
                          style={wageSecondaryBtnStyle}
                          onClick={() => {
                            setIsEditingWage(false);
                            setWageError("");
                            setWageInput(profile?.hourlyWage != null ? String(Number(profile.hourlyWage)) : "0");
                          }}
                          disabled={wageSaving}
                        >
                          {"\u0110\u00f3ng"}
                        </button>
                      ) : null}
                      <button type="button" style={wagePrimaryBtnStyle} onClick={handleSaveWage} disabled={wageSaving}>
                        {wageSaving ? "\u0110ang l\u01b0u..." : "L\u01b0u l\u01b0\u01a1ng gi\u1edd"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: "#16301f" }}>{"H\u1ed3 s\u01a1 \u0111\u00ednh k\u00e8m"}</h3>
            <DocumentSection title={"\u1ea2nh th\u1ebb"} documents={docs.profile_photo} />
            <DocumentSection title={"B\u1eb1ng c\u1ea5p"} documents={docs.degree} />
            <DocumentSection title={"Ch\u1ee9ng ch\u1ec9"} documents={docs.certificate} />
            <DocumentSection title={"H\u1ed3 s\u01a1 kh\u00e1m s\u1ee9c kh\u1ecfe"} documents={docs.health_record} />
            {docs.other.length ? <DocumentSection title={"T\u00e0i li\u1ec7u kh\u00e1c"} documents={docs.other} /> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.12)",
        borderRadius: dash.radiusMd,
        padding: "14px 16px",
        border: "1px solid rgba(255,255,255,0.18)",
      }}
    >
      <div style={{ fontSize: "0.72rem", opacity: 0.84, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.01em" }}>{value || "\u2014"}</div>
    </div>
  );
}

function FieldCard({
  label,
  value,
  wide,
}: {
  label: string;
  value: string | number | null | undefined;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        border: "1px solid #d7e5d8",
        background: "#f7fbf6",
        minHeight: 84,
        gridColumn: wide ? "span 2" : undefined,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#16301f", lineHeight: 1.6, wordBreak: "break-word" }}>
        {value || "\u2014"}
      </div>
    </div>
  );
}

function DocumentSection({
  title,
  documents,
}: {
  title: string;
  documents: HrEmployeeDocument[];
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 600, marginBottom: 10, color: "#33523f" }}>{title}</div>
      {documents.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 14 }}>{"Ch\u01b0a c\u00f3 t\u00e0i li\u1ec7u."}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {documents.map((document) => (
            <a
              key={document.id}
              href={getFileUrl(document.fileUrl)}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                minWidth: 180,
                maxWidth: 240,
                textDecoration: "none",
                color: "#16301f",
                padding: "12px 14px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              {document.mimeType?.startsWith("image/") ? (
                <img
                  src={getFileUrl(document.fileUrl)}
                  alt={document.fileName}
                  style={{
                    width: "100%",
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 10,
                    marginBottom: 10,
                    border: "1px solid #e5e7eb",
                  }}
                />
              ) : null}
              <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-word" }}>{document.fileName}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{formatDate(document.uploadedAt)}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const promptNoticeStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  color: "#1e3a8a",
  fontWeight: 500,
};

const warningNoticeStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #fcd34d",
  background: "#fffbeb",
  color: "#92400e",
  fontWeight: 500,
};

const successNoticeStyle: React.CSSProperties = {
  marginBottom: 12,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#166534",
  fontWeight: 500,
};

const wageEditorCardStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px solid #cfe3d0",
  background: "#f8fcf7",
};

const wageInputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 260,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 14,
};

const wagePrimaryBtnStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2f5d3a",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const wageSecondaryBtnStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#1f2937",
  fontWeight: 600,
  cursor: "pointer",
};

const wageErrorStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fff1f2",
  border: "1px solid #fda4af",
  color: "#be123c",
  fontSize: 13,
  fontWeight: 500,
};
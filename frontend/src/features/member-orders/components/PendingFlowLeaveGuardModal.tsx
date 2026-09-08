type PendingFlowLeaveGuardModalProps = {
  open: boolean;
  title: string;
  description: string;
  stayLabel?: string;
  leaveLabel?: string;
  onStay: () => void;
  onLeave: () => void;
};

export default function PendingFlowLeaveGuardModal({
  open,
  title,
  description,
  stayLabel = "Ở lại",
  leaveLabel = "Thoát trang",
  onStay,
  onLeave,
}: PendingFlowLeaveGuardModalProps) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onStay}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        padding: 20,
        background:
          "linear-gradient(180deg, rgba(34, 45, 33, 0.46) 0%, rgba(34, 45, 33, 0.62) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-flow-leave-guard-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 24,
          padding: 28,
          background:
            "linear-gradient(180deg, rgba(250, 248, 245, 0.98) 0%, rgba(245, 240, 232, 0.98) 100%)",
          border: "1px solid rgba(107, 83, 68, 0.16)",
          boxShadow: "0 28px 64px rgba(45, 59, 45, 0.24)",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            background: "rgba(107, 83, 68, 0.12)",
            color: "var(--cafe-brown)",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          !
        </div>

        <h2
          id="pending-flow-leave-guard-title"
          style={{
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2rem",
            lineHeight: 1.1,
            color: "var(--cafe-olive-dark)",
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: "14px 0 0",
            color: "var(--cafe-text-muted)",
            fontSize: "0.98rem",
            lineHeight: 1.7,
          }}
        >
          {description}
        </p>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button type="button" className="cafe-btn-secondary" onClick={onStay}>
            {stayLabel}
          </button>
          <button
            type="button"
            className="cafe-btn-primary"
            onClick={onLeave}
            style={{
              boxShadow: "0 12px 24px rgba(107, 83, 68, 0.16)",
            }}
          >
            {leaveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

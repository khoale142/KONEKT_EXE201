import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import { memberApi } from "../api/member.api";

type CheckinPayload = {
  today: string;
  checkedInToday: boolean;
  streak?: number;
  pointsAwarded?: number;
  streakIfCheckInToday?: number;
  pointsPreview?: number;
};

export default function MemberRewardsPage() {
  const navigate = useNavigate();
  const [points, setPoints] = useState<number | null>(null);
  const [checkin, setCheckin] = useState<CheckinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [profileRes, cRes] = await Promise.all([
        memberApi.getProfile(),
        memberApi.getRewardsCheckin(),
      ]);
      setPoints(Number(profileRes.customer?.points ?? 0));
      setCheckin(cRes.checkin);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        navigate("/login/customer", { replace: true });
        return;
      }
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="cafe-theme" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <CafeHeader />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 48px", flex: 1 }}>
        <h1 style={{ fontSize: "1.65rem", color: "var(--cafe-olive-dark)", marginBottom: 8 }}>Điểm thưởng</h1>
        <p style={{ color: "var(--cafe-text-muted)", marginTop: 0, marginBottom: 24, lineHeight: 1.55 }}>
          Check-in chuỗi ngày được thực hiện <strong>tự động khi bạn đăng nhập hoặc mở lại trang khách hàng</strong>
          {" "}trong ngày (mỗi ngày một lần, giờ Việt Nam). Bạn cũng sẽ nhận thông báo trên chuông. Dùng điểm đổi voucher tại cửa hàng.
        </p>

        {loading ? (
          <p style={{ color: "var(--cafe-text-muted)" }}>Đang tải…</p>
        ) : err ? (
          <p style={{ color: "#b71c1c" }}>{err}</p>
        ) : (
          <>
            <section
              className="store-card"
              style={{
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)" }}>Điểm hiện có</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--cafe-brown)" }}>
                  {points != null ? points.toLocaleString("vi-VN") : "—"}
                </div>
              </div>
              <Link to="/customer/vouchers" className="cafe-btn-primary" style={{ textDecoration: "none" }}>
                Đổi điểm lấy voucher →
              </Link>
            </section>

            <section className="store-card" style={{ marginBottom: 20 }}>
              <h2 className="store-card-title" style={{ marginTop: 0 }}>
                Check-in chuỗi ngày
              </h2>
              {checkin?.checkedInToday ? (
                <p style={{ margin: 0, color: "var(--cafe-text)", lineHeight: 1.6 }}>
                  Hôm nay bạn đã check-in. Chuỗi hiện tại: <strong>{checkin.streak}</strong> ngày
                  {checkin.pointsAwarded != null ? ` (+${checkin.pointsAwarded} điểm)` : ""}.
                </p>
              ) : (
                <p style={{ margin: 0, color: "var(--cafe-text)", lineHeight: 1.6 }}>
                  Hôm nay bạn chưa có lượt check-in trên hệ thống. Lượt check-in sẽ được ghi nhận khi bạn{" "}
                  <strong>mở lại trang khách hàng</strong> hoặc đăng nhập trong ngày (giờ Việt Nam). Khi được ghi nhận,
                  bạn sẽ nhận khoảng{" "}
                  <strong>{checkin?.pointsPreview ?? "—"}</strong> điểm
                  {checkin?.streakIfCheckInToday != null ? (
                    <>
                      {" "}
                      (chuỗi dự kiến: <strong>{checkin.streakIfCheckInToday}</strong> ngày)
                    </>
                  ) : null}
                  .
                </p>
              )}
            </section>

            <section className="store-card">
              <h2 className="store-card-title" style={{ marginTop: 0 }}>
                Đổi điểm
              </h2>
              <p style={{ margin: "0 0 12px", color: "var(--cafe-text)", lineHeight: 1.6 }}>
                Dùng điểm tích lũy (từ đơn hàng, check-in) để đổi voucher giảm giá — danh sách và lịch sử nằm ở trang voucher.
              </p>
              <Link to="/customer/vouchers" className="cafe-btn-secondary" style={{ textDecoration: "none", display: "inline-block" }}>
                Mở trang voucher & tem
              </Link>
            </section>
          </>
        )}
      </main>
      <CafeFooter />
    </div>
  );
}

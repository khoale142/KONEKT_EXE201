import { useEffect, useState } from "react";
import { staffAttendanceApi } from "../api/staffAttendance.api";
import { getCurrentPosition } from "../../shared/hooks/useGeolocation";
import { useAuthStore } from "../../../app/store/auth.store";
import {
  DashboardShell,
  DashboardHero,
  RoleBadge,
  DashboardSection,
  FeatureCard,
  FeatureGrid,
  DashIcons,
  type FeatureCardItem,
} from "../../shared/dashboard/dashboardUi";
import { StaffCheckInWidget } from "../components/StaffCheckInWidget";
import { StaffHistoryWidget } from "../components/StaffHistoryWidget";

type TodayResponse = {
  schedule: {
    workDate: string;
    shiftType: string;
    shiftLabel: string | null;
    scheduledStartAt: string;
    scheduledEndAt: string;
    lateGraceMinutes?: number;
  } | null;
  attendance: {
    checkInAt: string | null;
    checkOutAt: string | null;
  } | null;
  attendanceStatus?: "NOT_STARTED" | "CHECKED_IN" | "COMPLETED";
  classification?: {
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
  } | null;
};

const QUICK_LINKS: readonly FeatureCardItem[] = [
  {
    to: "/store/staff/profile",
    title: "Hồ sơ cá nhân",
    description: "Xem thông tin, CCCD, liên hệ khẩn cấp và tài liệu đính kèm.",
    icon: DashIcons.user,
    featured: true,
  },
  {
    to: "/store/staff/profile/edit-request",
    title: "Chỉnh sửa hồ sơ",
    description: "Gửi yêu cầu cập nhật hồ sơ để quản lý và HR duyệt.",
    icon: DashIcons.edit,
  },
  {
    to: "/store/staff/schedules",
    title: "Lịch làm việc",
    description: "Theo dõi các ca làm đã được phân công theo ngày.",
    icon: DashIcons.calendar,
  },
  {
    to: "/store/staff/payroll",
    title: "Bảng lương",
    description: "Xem tổng giờ làm và lương tháng của bạn.",
    icon: DashIcons.wallet,
  },
] as const;

export default function StaffDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const isShiftLeader = roles.includes("shift_leader");
  const isStoreManager = roles.includes("store_manager");

  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadToday = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await staffAttendanceApi.getTodayStatus();
      setData(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Không tải được dữ liệu hôm nay");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToday();
  }, []);

  const handleCheckIn = async () => {
    let posResult: Awaited<ReturnType<typeof getCurrentPosition>> = { ok: false, error: "" };
    try {
      setSubmitting(true);
      setError("");
      posResult = await getCurrentPosition();
      const payload: { note: string; latitude?: number; longitude?: number } = {
        note: "Đã đến ca",
      };
      if (posResult.ok) {
        payload.latitude = posResult.latitude;
        payload.longitude = posResult.longitude;
      }
      await staffAttendanceApi.checkIn(payload);
      await loadToday();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || (!posResult.ok ? posResult.error : "Check-in thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    let posResult: Awaited<ReturnType<typeof getCurrentPosition>> = { ok: false, error: "" };
    try {
      setSubmitting(true);
      setError("");
      posResult = await getCurrentPosition();
      const payload: { note: string; latitude?: number; longitude?: number } = {
        note: "Kết thúc ca",
      };
      if (posResult.ok) {
        payload.latitude = posResult.latitude;
        payload.longitude = posResult.longitude;
      }
      await staffAttendanceApi.checkOut(payload);
      await loadToday();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || (!posResult.ok ? posResult.error : "Check-out thất bại"));
    } finally {
      setSubmitting(false);
    }
  };

  const name = user?.fullName || user?.username || "bạn";
  const badgeText = isShiftLeader ? "Shift Leader" : "Nhân viên";

  const inventoryCards: FeatureCardItem[] = [
    {
      to: "/store/staff/inventory-shift",
      title: "Kiểm kê tồn kho",
      description: isShiftLeader
        ? "Mở phiên kiểm hàng, đối chiếu tồn kho và gửi duyệt."
        : "Khai báo tồn hàng cuối ca và gửi theo quy trình.",
      icon: DashIcons.clipboard,
      featured: true,
    },
    {
      to: "/store/staff/inventory-receipts",
      title: "Nhập hàng",
      description: "Tạo phiếu nhập kho khi cửa hàng nhận hàng thực tế.",
      icon: DashIcons.assign,
    },
    {
      to: "/inventory/disposals/create",
      title: "Báo hủy hàng",
      description: "Tạo phiếu hủy hàng cho mặt hàng hỏng, lỗi hoặc hết hạn.",
      icon: DashIcons.edit,
    },
    {
      to: "/inventory/disposals/my",
      title: "Lịch sử hủy hàng",
      description: "Xem các phiếu hủy hàng do bạn đã tạo.",
      icon: DashIcons.clock,
    },
  ];

  const approvalCards: FeatureCardItem[] = [];
  if (isShiftLeader) {
    approvalCards.push(
      {
        to: "/store/inventory/leader-approval",
        title: "Xác nhận phiếu kiểm hàng",
        description: "Trưởng ca kiểm tra batch kiểm hàng trước khi gửi tiếp.",
        icon: DashIcons.users,
        featured: true,
      },
      {
        to: "/store/inventory/receipt-leader-approval",
        title: "Xác nhận phiếu nhập hàng",
        description: "Duyệt phiếu nhập kho do nhân viên gửi lên.",
        icon: DashIcons.assign,
      }
    );
  }
  if (isStoreManager) {
    approvalCards.push({
      to: "/store/inventory/store-manager-approval",
      title: "Duyệt phiếu kiểm hàng",
      description: "Quản lý cửa hàng duyệt phiếu kiểm hàng sau trưởng ca.",
      icon: DashIcons.chart,
      featured: true,
    });
  }

  return (
    <DashboardShell>
      <DashboardHero
        badge={<RoleBadge>{badgeText}</RoleBadge>}
        title={`Xin chào, ${name}`}
        subtitle="Cổng nhân viên để chấm công hôm nay, theo dõi lịch làm và truy cập nhanh các tác vụ trong ca."
      />

      <StaffCheckInWidget
        data={data}
        loading={loading}
        error={error}
        submitting={submitting}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      <DashboardSection title="Lịch sử chấm công" description="Theo dõi 5 ca làm gần nhất của bạn.">
        <StaffHistoryWidget />
      </DashboardSection>

      <DashboardSection
        title="Truy cập nhanh"
        description="Các chức năng cá nhân được dùng thường xuyên."
        emphasized
      >
        <FeatureGrid>
          {QUICK_LINKS.map((item) => (
            <FeatureCard
              key={item.to}
              to={item.to}
              title={item.title}
              description={item.description}
              icon={item.icon}
              featured={item.featured}
            />
          ))}
        </FeatureGrid>
      </DashboardSection>

      <DashboardSection
        title="Tác vụ trong ca"
        description="Các nghiệp vụ tồn kho, nhập hàng và hủy hàng trong ngày."
      >
        <FeatureGrid>
          {inventoryCards.map((item) => (
            <FeatureCard
              key={item.to}
              to={item.to}
              title={item.title}
              description={item.description}
              icon={item.icon}
              featured={item.featured}
            />
          ))}
        </FeatureGrid>
      </DashboardSection>

      {approvalCards.length > 0 && (
        <DashboardSection
          title="Phê duyệt"
          description="Các thao tác xác nhận dành cho trưởng ca và quản lý cửa hàng."
        >
          <FeatureGrid>
            {approvalCards.map((item) => (
              <FeatureCard
                key={item.to}
                to={item.to}
                title={item.title}
                description={item.description}
                icon={item.icon}
                featured={item.featured}
              />
            ))}
          </FeatureGrid>
        </DashboardSection>
      )}
    </DashboardShell>
  );
}

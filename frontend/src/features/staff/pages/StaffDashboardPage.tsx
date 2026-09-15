import { useEffect, useState } from "react";
import { staffAttendanceApi } from "../api/staffAttendance.api";
import { getCurrentPosition } from "../../shared/hooks/useGeolocation";
import { useAuthStore, hasPermission } from "../../../app/store/auth.store";
import {
  DashboardShell,
  DashboardHero,
  RoleBadge,
  DashboardSection,
  FeatureCard,
  FeatureGrid,
  type FeatureCardItem,
} from "../../shared/dashboard/dashboardUi";
import { StaffCheckInWidget } from "../components/StaffCheckInWidget";
import { StaffHistoryWidget } from "../components/StaffHistoryWidget";
import {
  ShoppingCart,
  Coffee,
  Calculator,
  Calendar,
  Wallet,
  User,
  ClipboardList,
  PackageCheck,
  Trash2,
  Clock,
  CheckCircle2,
  Building2,
  ShieldCheck,
} from "lucide-react";

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
  const badgeText = isShiftLeader
    ? "Trưởng Ca (Shift Leader)"
    : isStoreManager
      ? "Quản Lý Cửa Hàng"
      : "Nhân Viên Vận Hành";

  const storeDisplayName = user?.storeName || (user?.storeId ? `Chi nhánh #${user.storeId}` : "KONEKT Coffee");

  // 1. TÁC VỤ BÁN HÀNG & PHA CHẾ (1-TAP OPERATIONS)
  const posOperations: FeatureCardItem[] = [];

  if (hasPermission(user, "pos.access")) {
    posOperations.push({
      to: "/pos/order",
      title: "Mở POS Bán Hàng",
      description: "Giao diện thu ngân order món, in bill và thanh toán VietQR / tiền mặt.",
      icon: <ShoppingCart size={22} color="#3D5E46" />,
      featured: true,
    });
  }

  // Everyone can usually see KDS, or maybe we check `kds.access`. For now, leave it.
  posOperations.push({
    to: "/pos/kds",
    title: "Màn Hình Bếp (KDS)",
    description: "Theo dõi order cần pha chế theo thời gian thực cho Barista / Bếp.",
    icon: <Coffee size={22} color="#3D5E46" />,
    featured: true,
  });

  if (hasPermission(user, "shift.operate") || hasPermission(user, "shift.reconcile")) {
    posOperations.push({
      to: "/pos/shift-reconciliation",
      title: "Kiểm Quỹ & Chốt Ca",
      description: "Kiểm đếm tiền két đầu ca, chốt doanh thu tiền mặt và bàn giao ca.",
      icon: <Calculator size={22} color="#3D5E46" />,
      featured: true,
    });
  }

  // 2. LỊCH LÀM VIỆC & QUYỀN LỢI CÁ NHÂN
  const personalCards: FeatureCardItem[] = [
    {
      to: "/store/staff/schedules",
      title: "Lịch làm việc của tôi",
      description: "Theo dõi các ca làm việc đã được xếp lịch trong tuần.",
      icon: <Calendar size={22} color="#3D5E46" />,
      featured: true,
    },
    {
      to: "/store/staff/payroll",
      title: "Bảng lương & Giờ công",
      description: "Xem tổng giờ làm, công chuẩn và thu nhập trong tháng.",
      icon: <Wallet size={22} color="#3D5E46" />,
    },
    {
      to: "/store/staff/profile",
      title: "Hồ sơ cá nhân",
      description: "Xem thông tin nhân sự, số điện thoại và thông tin liên hệ.",
      icon: <User size={22} color="#3D5E46" />,
    },
  ];

  // 3. TÁC VỤ KHO & VẬN HÀNH CA
  const inventoryCards: FeatureCardItem[] = [
    {
      to: "/store/staff/inventory-shift",
      title: "Kiểm kê tồn kho ca",
      description: isShiftLeader
        ? "Mở phiên kiểm hàng, đối chiếu số lượng thực tế và gửi duyệt."
        : "Khai báo tồn nguyên vật liệu cuối ca theo quy trình.",
      icon: <ClipboardList size={22} color="#3D5E46" />,
      featured: true,
    },
    {
      to: "/store/staff/inventory-receipts",
      title: "Nhập hàng vào kho",
      description: "Tạo phiếu nhập nguyên vật liệu khi cửa hàng nhận hàng thực tế.",
      icon: <PackageCheck size={22} color="#3D5E46" />,
    },
    {
      to: "/inventory/disposals/create",
      title: "Báo hủy hàng hỏng",
      description: "Tạo phiếu hủy nguyên vật liệu hỏng, quá hạn hoặc đổ vỡ.",
      icon: <Trash2 size={22} color="#3D5E46" />,
    },
    {
      to: "/inventory/disposals/my",
      title: "Lịch sử báo hủy",
      description: "Xem các phiếu báo hủy do bạn đã lập trong tháng.",
      icon: <Clock size={22} color="#3D5E46" />,
    },
  ];

  // 4. PHÊ DUYỆT (DÀNH CHO SHIFT LEADER & STORE MANAGER)
  const approvalCards: FeatureCardItem[] = [];
  if (isShiftLeader || isStoreManager) {
    approvalCards.push(
      {
        to: "/store/inventory/leader-approval",
        title: "Duyệt phiếu kiểm hàng ca",
        description: "Trưởng ca kiểm tra và xác nhận biên bản kiểm kho của nhân viên.",
        icon: <ShieldCheck size={22} color="#3D5E46" />,
        featured: true,
      },
      {
        to: "/store/inventory/receipt-leader-approval",
        title: "Duyệt phiếu nhập hàng ca",
        description: "Xác nhận số lượng nguyên vật liệu nhập kho thực tế.",
        icon: <CheckCircle2 size={22} color="#3D5E46" />,
      }
    );
  }

  if (isStoreManager) {
    approvalCards.push({
      to: "/store/manager",
      title: "Trung Tâm Quản Lý Chi Nhánh",
      description: "Phân ca nhân viên, duyệt đổi ca và xem báo cáo doanh thu cửa hàng.",
      icon: <Building2 size={22} color="#3D5E46" />,
      featured: true,
    });
  }

  return (
    <DashboardShell>
      <DashboardHero
        badge={<RoleBadge>{badgeText}</RoleBadge>}
        title={`Xin chào, ${name}`}
        subtitle={`Cổng nhân viên ${storeDisplayName} · Chấm công hôm nay, bán hàng POS và quản lý ca làm việc.`}
      />

      {/* SECTION 1: TÁC VỤ VẬN HÀNH & BÁN HÀNG TỨC THÌ */}
      <DashboardSection
        title="Vận hành & Bán hàng"
        description="Mở nhanh giao diện Web POS thu ngân, màn hình bếp KDS hoặc chốt ca kiểm quỹ."
        emphasized
      >
        <FeatureGrid>
          {posOperations.map((item) => (
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

      {/* SECTION 2: CHẤM CÔNG CA HÔM NAY */}
      <StaffCheckInWidget
        data={data}
        loading={loading}
        error={error}
        submitting={submitting}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

      {/* SECTION 3: LỊCH SỬ CHẤM CÔNG */}
      <DashboardSection title="Lịch sử chấm công" description="Theo dõi các ca làm việc gần nhất của bạn.">
        <StaffHistoryWidget />
      </DashboardSection>

      {/* SECTION 4: LỊCH LÀM & QUYỀN LỢI CÁ NHÂN */}
      <DashboardSection
        title="Lịch làm việc & Cá nhân"
        description="Theo dõi lịch phân ca và thông tin thu nhập."
      >
        <FeatureGrid>
          {personalCards.map((item) => (
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

      {/* SECTION 5: TỒN KHO & HÀNG HÓA CA */}
      <DashboardSection
        title="Kho & Hàng hóa trong ca"
        description="Kiểm kê tồn kho, tạo phiếu nhập hàng và báo hủy nguyên vật liệu."
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

      {/* SECTION 6: KHU VỰC PHÊ DUYỆT CỦA TRƯỞNG CA & QUẢN LÝ */}
      {approvalCards.length > 0 && (
        <DashboardSection
          title="Phê duyệt & Điều hành"
          description="Dành riêng cho Trưởng ca (Shift Leader) và Quản lý cửa hàng."
          emphasized
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

export type SystemPermission =
  | "can_invite_staff"
  | "can_manage_staff"
  | "can_view_revenue"
  | "can_manage_inventory"
  | "can_approve_disposal"
  | "can_manage_schedules"
  | "can_adjust_prices";

export interface PermissionDefinition {
  key: SystemPermission;
  label: string;
  description: string;
  defaultManager: boolean;
  defaultLeader?: boolean;
  defaultStaff: boolean;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "can_invite_staff",
    label: "Mời & duyệt nhân sự vào Store",
    description: "Xem mã mời Store, chia sẻ mã và duyệt yêu cầu kích hoạt nhân viên mới",
    defaultManager: false,
    defaultLeader: false,
    defaultStaff: false,
  },
  {
    key: "can_manage_staff",
    label: "Quản lý hồ sơ nhân viên",
    description: "Xem danh sách, thông tin liên hệ và lịch sử nhân sự tại chi nhánh",
    defaultManager: true,
    defaultLeader: false,
    defaultStaff: false,
  },
  {
    key: "can_view_revenue",
    label: "Xem báo cáo doanh thu",
    description: "Theo dõi số liệu bán hàng, hóa đơn và doanh thu theo ngày/tháng",
    defaultManager: true,
    defaultLeader: false,
    defaultStaff: false,
  },
  {
    key: "can_manage_inventory",
    label: "Quản lý kho & Phiếu nhập",
    description: "Thực hiện kiểm kê kho ca, tạo và duyệt phiếu nhập nguyên vật liệu",
    defaultManager: true,
    defaultLeader: true,
    defaultStaff: false,
  },
  {
    key: "can_approve_disposal",
    label: "Duyệt hủy hàng & Thất thoát",
    description: "Xem xét và phê duyệt các báo cáo hủy món / hao hụt tại cửa hàng",
    defaultManager: true,
    defaultLeader: false,
    defaultStaff: false,
  },
  {
    key: "can_manage_schedules",
    label: "Lập lịch & Xếp ca làm việc",
    description: "Tạo lịch làm việc tuần, phân ca và duyệt đổi ca cho nhân viên",
    defaultManager: true,
    defaultLeader: false,
    defaultStaff: false,
  },
  {
    key: "can_adjust_prices",
    label: "Giảm giá & Áp dụng voucher tại POS",
    description: "Thao tác chiết khấu món, nhập mã khuyến mãi hoặc giảm giá hóa đơn khi bán hàng",
    defaultManager: true,
    defaultLeader: true,
    defaultStaff: true,
  },
];

export function getDefaultPermissionsForRole(role: string): string[] {
  if (role === "owner" || role === "platform_admin") {
    return PERMISSION_DEFINITIONS.map((p) => p.key);
  }
  if (role === "store_manager") {
    return PERMISSION_DEFINITIONS.filter((p) => p.defaultManager).map((p) => p.key);
  }
  if (role === "shift_leader") {
    return PERMISSION_DEFINITIONS.filter((p) => p.defaultLeader ?? p.defaultStaff).map((p) => p.key);
  }
  return PERMISSION_DEFINITIONS.filter((p) => p.defaultStaff).map((p) => p.key);
}

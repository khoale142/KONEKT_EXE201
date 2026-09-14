import RequireAuth from './guards/RequireAuth';
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Navigate,
  useRouteError,
  useNavigate,
  isRouteErrorResponse,
} from "react-router-dom";
import type { PropsWithChildren } from "react";
import { useAuthStore } from "../../app/store/auth.store";

import PortalSelectPage from "../../features/auth/pages/PortalSelectPage";
import CustomerLoginPage from "../../features/auth/pages/CustomerLoginPage";
import CustomerRegisterPage from "../../features/auth/pages/CustomerRegisterPage";
import AccountRegisterPage from "../../features/auth/pages/AccountRegisterPage";
import StaffJoinStorePage from "../../features/workspace/pages/StaffJoinStorePage";
import CustomerForgotPasswordPage from "../../features/auth/pages/CustomerForgotPasswordPage";
import CustomerResetOtpPage from "../../features/auth/pages/CustomerResetOtpPage";
import CustomerResetPasswordPage from "../../features/auth/pages/CustomerResetPasswordPage";
import InternalForgotPasswordPage from "../../features/auth/pages/InternalForgotPasswordPage";
import InternalResetOtpPage from "../../features/auth/pages/InternalResetOtpPage";
import InternalResetPasswordPage from "../../features/auth/pages/InternalResetPasswordPage";
import StoreLoginPage from "../../features/auth/pages/StoreLoginPage";
import StoreBranchSelectPage from "../../features/auth/pages/StoreBranchSelectPage";
import OfficeLoginPage from "../../features/auth/pages/OfficeLoginPage";
import OfficeBranchSelectPage from "../../features/auth/pages/OfficeBranchSelectPage";
import PosLoginPage from "../../features/auth/pages/PosLoginPage";
import MerchantLoginPage from "../../features/auth/pages/MerchantLoginPage";
import SelectTenantPage from "../../features/workspace/pages/SelectTenantPage";
import SelectStorePage from "../../features/workspace/pages/SelectStorePage";
import TenantJoinPage from "../../features/workspace/pages/TenantJoinPage";
import TenantJoinRequestsPage from "../../features/workspace/pages/TenantJoinRequestsPage";
import OwnerMenuHubPage from "../../features/owner-menu/pages/OwnerMenuHubPage";
import OwnerInventoryHubPage from "../../features/owner-inventory/pages/OwnerInventoryHubPage";
import OwnerPromotionsHubPage from "../../features/owner-promotions/pages/OwnerPromotionsHubPage";
import OwnerHRHubPage from "../../features/office/hr/pages/OwnerHRHubPage";

import AuthLayout from "../../shared/layouts/AuthLayout";
import StoreLayout from "../../shared/layouts/StoreLayout";

import CafeHeader from "../../shared/components/CafeHeader";
import OfficeLayout from "../../shared/layouts/OfficeWorkspaceLayout";
import useIsMobileViewport from "../../shared/hooks/useIsMobileViewport";

import RequirePortal from "./guards/RequirePortal";
import RequireRole from "./guards/RequireRole";

// Head Officer pages
import DashboardPage from "../../features/head-officer/pages/DashboardPage";
import RevenueReportPage from "../../features/head-officer/pages/RevenueReportPage";
import PayrollReportPage from "../../features/head-officer/pages/PayrollReportPage";

// Marketing pages
import DiscoverPage from "../../features/marketing/pages/DiscoverPage.tsx";
import MarketingContentDetailPage from "../../features/marketing/pages/MarketingContentDetailPage.tsx";
import MarketingContentEditorPage from "../../features/marketing/pages/MarketingContentEditorPage.tsx";
import MarketingContentsPage from "../../features/marketing/pages/MarketingContentsPage.tsx";
import MarketingComplaintsPage from "../../features/marketing/pages/MarketingComplaintsPage";
import MarketingComboRuleListPage from "../../features/marketing/pages/MarketingComboRuleListPage";
import MarketingComboRuleEditorPage from "../../features/marketing/pages/MarketingComboRuleEditorPage";

// Audit pages
import StoreDataPage from "../../features/audit/pages/StoreDataPage";
import AuditFlagsPage from "../../features/audit/pages/AuditFlagsPage";
import AuditReportsPage from "../../features/audit/pages/AuditReportsPage";
import RequireStoreRole from "./guards/RequireStoreRole";
import InventoryAuditApprovalPage from "../../features/head-officer/pages/InventoryAuditApprovalPage";
import StoreDisposalReportCreatePage from "../../features/staff/pages/StoreDisposalReportCreatePage";
import MyDisposalReportsPage from "../../features/staff/pages/MyDisposalReportsPage";
import StoreDisposalManagerPage from "../../features/staff/pages/StoreDisposalManagerPage";
import DisposalOrderApprovalHistoryPage from "../../features/head-officer/pages/DisposalOrderApprovalHistoryPage";
import StoreDisposalOrdersHistoryPage from "../../features/staff/pages/StoreDisposalOrdersHistoryPage";
import StoreDisposalOrderDetailPage from "../../features/staff/pages/StoreDisposalOrderDetailPage";
import StoreDisposalReportActionPage from "../../features/staff/pages/StoreDisposalReportActionPage";
import DisposalReportExplainPage from "../../features/staff/pages/DisposalReportExplainPage";
import DisposalOrderApprovalDetailPage from "../../features/head-officer/pages/DisposalOrderApprovalDetailPage";

import HREmployeeDetailPage from "../../features/office/hr/pages/HREmployeeDetailWorkspacePage";
import HRAttendancePage from "../../features/office/hr/pages/HRAttendanceWorkspaceV2Page";
import HRRoleUpdateRequestsPage from "../../features/office/hr/pages/HRRoleUpdateRequestsPage";
import HRStaffingRequestsPage from "../../features/office/hr/pages/HRStaffingRequestsPage";
import HRSchedulesPage from "../../features/office/hr/pages/HRSchedulesWorkspaceV2Page";

import PosOrderPage from "../../features/pos/pages/PosOrderPage";
import PosKdsViewPage from "../../features/pos/pages/PosKdsViewPage";
import PosHeldOrdersPage from "../../features/pos/pages/PosHeldOrdersPage";
import PosPaidOrdersPage from "../../features/pos/pages/PosPaidOrdersPage";
import PosWorkspaceLayout from "../../features/pos/layouts/PosWorkspaceLayout";
import PosStoreReportPage from "../../features/pos/pages/PosStoreReportPage";
import CustomerChatPage from "../../features/chat/pages/CustomerChatPage";
import CustomerHomePage from "../../features/customer/pages/CustomerHomePage";
import ChatButton from "../../shared/components/ChatButton";
import MemberProfilePage from "../../features/member/pages/MemberProfilePage";
import MenuPage from "../../features/menu/pages/MenuPage";
import StoreLocationsPage from "../../features/stores/pages/StoreLocationsPage";
import PosShiftReconciliationPage from "../../features/pos/pages/PosShiftReconciliationPage";
import StoreDetailPage from "../../features/stores/pages/StoreDetailPage";
import CustomerCompleteAccountPage from "../../features/auth/pages/CustomerCompleteAccountPage";
import PublicPickupBoardPage from "../../features/public/pages/PublicPickupBoardPage";
import MarketingMenuListPage from "../../features/marketing/pages/MarketingMenuListPage";
import MarketingMenuEditorPage from "../../features/marketing/pages/MarketingMenuEditorPage";

import CustomerPromotionsPage from "../../features/member/pages/CustomerPromotionsPage";
import MemberRewardsPage from "../../features/member/pages/MemberRewardsPage";
import CustomerVouchersPage from "../../features/member/pages/CustomerVouchersPage";
import CustomerSupportPage from "../../features/customer/pages/CustomerSupportPage";
import PaymentResultPage from "../../features/payment/pages/PaymentResultPage";
import PosActionLogsPage from "../../features/pos/pages/PosActionLogsPage";
import MemberOrderStoreSelectPage from "../../features/member-orders/pages/MemberOrderStoreSelectPage";
import MemberOrderMenuPage from "../../features/member-orders/pages/MemberOrderMenuPage";
import MemberCartPage from "../../features/member-orders/pages/MemberCartPage";
import MemberCheckoutPage from "../../features/member-orders/pages/MemberCheckoutPage";
import MemberPaymentResultPage from "../../features/member-orders/pages/MemberPaymentResultPage";
import MemberOrdersPage from "../../features/member-orders/pages/MemberOrdersPage";
import MemberOrderDetailPage from "../../features/member-orders/pages/MemberOrderDetailPage";
import MemberResumePaymentPage from "../../features/member-orders/pages/MemberResumePaymentPage";
import MemberOrderIssuesPage from "../../features/member-orders/pages/MemberOrderIssuesPage";
import MemberOrderIssueCreatePage from "../../features/member-orders/pages/MemberOrderIssueCreatePage";
import CustomerNotificationsPage from "../../features/notifications/pages/CustomerNotificationsPage";

//Staff pages
import StaffSchedulePage from "../../features/staff/pages/schedule/StaffSchedulePage";
import StaffDashboardPage from "../../features/staff/pages/StaffDashboardPage";
import ManagerSchedulePage from "../../features/store-manager/pages/schedule/ManagerSchedulePage";
import ManagerDashboardPage from "../../features/store-manager/pages/ManagerDashboardPage";
import StoreManagerInsightsPage from "../../features/store-manager/pages/StoreManagerInsightsPage";
import StoreManagerHelpPage from "../../features/store-manager/pages/StoreManagerHelpPage";
import StoreManagerStoreReportPage from "../../features/store-manager/pages/StoreManagerStoreReportPage";
import AssignSchedulePage from "../../features/store-manager/pages/schedule/AssignSchedulePage";
import StoreAttendancePage from "../../features/store-manager/pages/StoreAttendancePage";
import ReconciliationPage from "../../features/store-manager/pages/ReconciliationPage";
import InventoryShiftPage from "../../features/staff/pages/InventoryShiftPage";
import StaffProfilePage from "../../features/staff/pages/profile/StaffProfilePage";
import StaffProfileEditRequestPage from "../../features/staff/pages/profile/StaffProfileEditRequestPage";
import StaffProfileRequestHistoryPage from "../../features/staff/pages/profile/StaffProfileRequestHistoryPage";
import PayrollPage from "../../features/staff/pages/PayrollPage";
import ShiftLeaderInventoryApprovalPage from "../../features/staff/pages/ShiftLeaderInventoryApprovalPage";
import StoreManagerInventoryApprovalPage from "../../features/staff/pages/StoreManagerInventoryApprovalPage";
import StaffRequestPage from "../../features/staff/pages/StaffRequestPage";
import StoreEmployeesPage from "../../features/store-manager/pages/StoreEmployeesPage";
import ManagerEmployeeProfilePage from "../../features/store-manager/pages/profile/ManagerEmployeeProfilePage";
import ProfileUpdateRequestsPage from "../../features/store-manager/pages/profile/ProfileUpdateRequestsPage";
import StaffFeatureScope from "../../features/staff/StaffFeatureScope";
import StorePayrollPage from "../../features/store-manager/pages/StorePayrollPage";
import ScheduleRequestsPage from "../../features/store-manager/pages/schedule/ScheduleRequestsPage";
import ScheduleRequestHistoryPage from "../../features/store-manager/pages/schedule/ScheduleRequestHistoryPage";

import InventoryShiftHistoryPage from "../../features/staff/pages/InventoryShiftHistoryPage";
import InventoryReceiptPage from "../../features/staff/pages/InventoryReceiptPage";
import ShiftLeaderInventoryReceiptApprovalPage from "../../features/staff/pages/ShiftLeaderInventoryReceiptApprovalPage";
import StoreManagerInventoryReceiptApprovalPage from "../../features/staff/pages/StoreManagerInventoryReceiptApprovalPage";

/** Redirect /office → trang chính của từng role */
function OfficeLanding() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);

  if (roles.includes("marketing_sale"))
    return <Navigate to="/office/marketing/contents" replace />;
  if (roles.includes("auditor"))
    return <Navigate to="/office/audit/stores" replace />;
  if (roles.includes("hr_manager"))
    return <Navigate to="/office/hr/payroll" replace />;

  return <DashboardPage />;
}

function ErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = isRouteErrorResponse(error)
    ? error.status === 404
      ? "Không tìm thấy trang"
      : error.data?.message || "Đã xảy ra lỗi"
    : error instanceof Error
      ? error.message
      : "Đã xảy ra lỗi";

  return (
    <div
      className="cafe-theme"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
      }}
    >
      <div
        className="cafe-card"
        style={{ padding: 40, textAlign: "center", maxWidth: 400 }}
      >
        <p className="cafe-error" style={{ marginBottom: 24 }}>
          {message}
        </p>
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button className="cafe-btn-secondary" onClick={() => navigate(-1)}>
            Quay lại
          </button>
          <Link
            to="/"
            className="cafe-btn-primary"
            style={{ padding: "12px 24px", textDecoration: "none" }}
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}

function PosMobileFallback() {
  return (
    <div
      className="cafe-theme"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="cafe-card" style={{ maxWidth: 420, padding: 28, textAlign: "center" }}>
        <h1 className="cafe-title" style={{ marginBottom: 12 }}>
          POS hiện chỉ hỗ trợ màn hình lớn
        </h1>
        <p className="cafe-subtitle" style={{ marginBottom: 20 }}>
          Để tránh vỡ giao diện khi thao tác bán hàng, vui lòng dùng máy tính hoặc tablet xoay ngang
          khi truy cập POS trên server.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <Link to="/" className="cafe-btn-secondary" style={{ textDecoration: "none" }}>
            Về trang chủ
          </Link>
          <Link to="/login/pos" className="cafe-btn-primary" style={{ textDecoration: "none" }}>
            Về đăng nhập POS
          </Link>
        </div>
      </div>
    </div>
  );
}

function PosViewportGuard({ children }: PropsWithChildren) {
  const isMobile = useIsMobileViewport();

  if (isMobile) {
    return <PosMobileFallback />;
  }

  return <>{children}</>;
}

function StoreManagerHome() {
  return (
    <StaffFeatureScope>
      <StoreLayout>
        <ManagerDashboardPage />
      </StoreLayout>
    </StaffFeatureScope>
  );
}

function StoreStaffHome() {
  return (
    <StaffFeatureScope>
      <StoreLayout>
        <StaffDashboardPage />
      </StoreLayout>
    </StaffFeatureScope>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <PortalSelectPage /> },
  { path: "/menu", element: <MenuPage /> },
  { path: "/stores", element: <StoreLocationsPage /> },
  { path: "/discover", element: <DiscoverPage /> },
  {
    path: "/discover/:slug",
    element: <MarketingContentDetailPage />,
    errorElement: <ErrorFallback />,
  },

  {
    path: "/workspace/select-tenant",
    element: <RequireAuth><SelectTenantPage /></RequireAuth>,
  },
  {
    path: "/workspace/select-store",
    element: <RequireAuth><SelectStorePage /></RequireAuth>,
  },
  {
    path: "/workspace/join-store",
    element: <RequireAuth><StaffJoinStorePage /></RequireAuth>,
  },
  {
    path: "/workspace/join-store-invite",
    element: <RequireAuth><TenantJoinPage /></RequireAuth>,
  },
  { path: "/workspace/join-tenant", element: <Navigate to="/workspace/join-store-invite" replace /> },
  {
    path: "/workspace/tenant-join-requests",
    element: <RequireAuth><TenantJoinRequestsPage /></RequireAuth>,
  },
  {
    path: "/login",
    element: <MerchantLoginPage />,
  },
  {
    path: "/login/merchant",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login/customer",
    element: (
      <AuthLayout>
        <CustomerLoginPage />
      </AuthLayout>
    ),
  },
  {
    path: "/register/account",
    element: <AccountRegisterPage />,
  },
  {
    path: "/register/owner",
    element: <Navigate to="/register/account" replace />,
  },
  {
    path: "/register/staff",
    element: <Navigate to="/register/account" replace />,
  },
  {
    path: "/register/customer",
    element: (
      <AuthLayout>
        <CustomerRegisterPage />
      </AuthLayout>
    ),
  },
  {
    path: "/forgot-password/customer",
    element: (
      <AuthLayout>
        <CustomerForgotPasswordPage />
      </AuthLayout>
    ),
  },
  {
    path: "/forgot_password/customer",
    element: (
      <AuthLayout>
        <CustomerForgotPasswordPage />
      </AuthLayout>
    ),
  },
  {
    path: "/reset-password/customer/otp",
    element: (
      <AuthLayout>
        <CustomerResetOtpPage />
      </AuthLayout>
    ),
  },
  {
    path: "/reset-password/customer",
    element: (
      <AuthLayout>
        <CustomerResetPasswordPage />
      </AuthLayout>
    ),
  },

  {
    path: "/login/store",
    element: (
      <AuthLayout>
        <StoreBranchSelectPage />
      </AuthLayout>
    ),
  },
  {
    path: "/login/store/:branch",
    element: (
      <AuthLayout>
        <StoreLoginPage />
      </AuthLayout>
    ),
  },
  {
    path: "/forgot-password/store/:branch",
    element: (
      <AuthLayout>
        <InternalForgotPasswordPage portal="store" />
      </AuthLayout>
    ),
  },
  {
    path: "/reset-password/store/:branch/otp",
    element: (
      <AuthLayout>
        <InternalResetOtpPage portal="store" />
      </AuthLayout>
    ),
  },
  {
    path: "/reset-password/store/:branch",
    element: (
      <AuthLayout>
        <InternalResetPasswordPage portal="store" />
      </AuthLayout>
    ),
  },

  {
    path: "/login/office",
    element: (
      <AuthLayout>
        <OfficeBranchSelectPage />
      </AuthLayout>
    ),
  },
  {
    path: "/login/office/:branch",
    element: (
      <AuthLayout>
        <OfficeLoginPage />
      </AuthLayout>
    ),
  },
  {
    path: "/forgot-password/office/:branch",
    element: (
      <AuthLayout>
        <InternalForgotPasswordPage portal="office" />
      </AuthLayout>
    ),
  },
  {
    path: "/reset-password/office/:branch/otp",
    element: (
      <AuthLayout>
        <InternalResetOtpPage portal="office" />
      </AuthLayout>
    ),
  },
  {
    path: "/reset-password/office/:branch",
    element: (
      <AuthLayout>
        <InternalResetPasswordPage portal="office" />
      </AuthLayout>
    ),
  },

  {
    path: "/login/pos",
    element: (
      <AuthLayout>
        <PosLoginPage />
      </AuthLayout>
    ),
  },

  // Customer zone
  {
    path: "/customer",
    element: (
      <RequirePortal portal="CUSTOMER">
        <CustomerHomePage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/complete-account",
    element: (
      <RequirePortal portal="CUSTOMER">
        <AuthLayout>
          <CustomerCompleteAccountPage />
        </AuthLayout>
      </RequirePortal>
    ),
  },
  {
    path: "/customer/profile",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberProfilePage />
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/chat",
    element: (
      <RequirePortal portal="CUSTOMER">
        <CustomerChatPage />
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/promotions",
    element: (
      <RequirePortal portal="CUSTOMER">
        <CustomerPromotionsPage />
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/promotions/:id",
    element: (
      <RequirePortal portal="CUSTOMER">
        <CustomerPromotionsPage />
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/rewards",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberRewardsPage />
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/vouchers",
    element: (
      <RequirePortal portal="CUSTOMER">
        <CustomerVouchersPage />
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/support",
    element: (
      <RequirePortal portal="CUSTOMER">
        <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <CafeHeader />
          <main style={{ flex: 1 }}>
            <CustomerSupportPage />
          </main>
          <ChatButton />
        </div>
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/vouchers/:id",
    element: (
      <RequirePortal portal="CUSTOMER">
        <CustomerVouchersPage />
      </RequirePortal>
    ),
    errorElement: <ErrorFallback />,
  },
  {
    path: "/payment/result",
    element: <PaymentResultPage />,
    errorElement: <ErrorFallback />,
  },
  {
    path: "/customer/order",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberOrderStoreSelectPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/order/menu",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberOrderMenuPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/order/cart",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberCartPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/order/checkout",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberCheckoutPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/order/result",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberPaymentResultPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/orders",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberOrdersPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/issues",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberOrderIssuesPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/orders/:id/payment",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberResumePaymentPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/orders/:id/payment/success",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberPaymentResultPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/orders/:id",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberOrderDetailPage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/orders/:id/issue",
    element: (
      <RequirePortal portal="CUSTOMER">
        <MemberOrderIssueCreatePage />
      </RequirePortal>
    ),
  },
  {
    path: "/customer/notifications",
    element: (
      <RequirePortal portal="CUSTOMER">
        <CustomerNotificationsPage />
      </RequirePortal>
    ),
  },
  { path: "/head-officer/disposals", element: <Navigate to="/office/dm/inventory-waste/disposals" replace /> },
  { path: "/head-officer/disposals/history", element: <Navigate to="/office/dm/disposals/history" replace /> },
  { path: "/office/dm/disposals", element: <Navigate to="/office/dm/inventory-waste/disposals" replace /> },
  {
    path: "/office/dm/disposals/history",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["district_manager", "admin"]}>
          <OfficeLayout>
            <DisposalOrderApprovalHistoryPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/dm/disposals/:id",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["district_manager", "admin"]}>
          <OfficeLayout>
            <DisposalOrderApprovalDetailPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },

  // Store zone
  {
    path: "/store",
    element: <Navigate to="/login/store" replace />,
  },
  {
    path: "/store/manager",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StoreManagerHome />
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/schedules",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <ManagerSchedulePage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/assign-schedule",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <AssignSchedulePage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/attendance",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StoreAttendancePage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/reconciliation",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <ReconciliationPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/attendance-insights",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StoreManagerInsightsPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/store-report",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StoreManagerStoreReportPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/employees",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StoreEmployeesPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/employees/:employeeId",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <ManagerEmployeeProfilePage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/profile-requests",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <ProfileUpdateRequestsPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/schedule-requests",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <ScheduleRequestsPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/inventory-shift",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <InventoryShiftPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/staff-requests",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StoreLayout>
          <StaffRequestPage />
        </StoreLayout>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/audit-reports",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StoreLayout>
          <AuditReportsPage viewMode="sm" />
        </StoreLayout>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/payroll",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StorePayrollPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },

  {
    path: "/stores/:id",
    element: <StoreDetailPage />,
  },
  {
    path: "/inventory/disposals/create",
    element: (
      <RequirePortal portal="STORE">
        <StoreDisposalReportCreatePage />
      </RequirePortal>
    ),
  },
  {
    path: "/inventory/disposals/my",
    element: (
      <RequirePortal portal="STORE">
        <MyDisposalReportsPage />
      </RequirePortal>
    ),
  },
  {
    path: "/inventory/disposals/my/:id/explain",
    element: (
      <RequirePortal portal="STORE">
        <DisposalReportExplainPage />
      </RequirePortal>
    ),
  },
  {
    path: "/inventory/disposals/manage",
    element: (
      <RequirePortal portal="STORE">
        <StoreDisposalManagerPage />
      </RequirePortal>
    ),
  },
  {
    path: "/inventory/disposals/review-report/:id/:action",
    element: (
      <RequirePortal portal="STORE">
        <StoreDisposalReportActionPage />
      </RequirePortal>
    ),
  },
  {
    path: "/inventory/disposals/history",
    element: (
      <RequirePortal portal="STORE">
        <StoreDisposalOrdersHistoryPage />
      </RequirePortal>
    ),
  },
  {
    path: "/inventory/disposals/history/:id",
    element: (
      <RequirePortal portal="STORE">
        <StoreDisposalOrderDetailPage />
      </RequirePortal>
    ),
  },

  // Staff zone
  {
    path: "/store/staff",
    element: (
      <RequireStoreRole allowedRoles={["staff", "shift_leader"]}>
        <StoreStaffHome />
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/staff/schedules",
    element: (
      <RequireStoreRole allowedRoles={["staff", "shift_leader"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StaffSchedulePage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/staff/inventory-shift",
    element: (
      <RequireStoreRole allowedRoles={["staff", "shift_leader"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <InventoryShiftPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/staff/profile",
    element: (
      <RequireStoreRole allowedRoles={["staff", "shift_leader"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StaffProfilePage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/schedule-requests/history",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <ScheduleRequestHistoryPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/manager/help",
    element: (
      <RequireStoreRole allowedRoles={["store_manager"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StoreManagerHelpPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/staff/payroll",
    element: (
      <RequireStoreRole allowedRoles={["staff", "shift_leader"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <PayrollPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/staff/inventory-history",
    element: (
      <RequireStoreRole
        allowedRoles={["staff", "shift_leader", "store_manager"]}
      >
        <StoreLayout>
          <InventoryShiftHistoryPage />
        </StoreLayout>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/staff/inventory-receipts",
    element: (
      <RequireStoreRole
        allowedRoles={["staff", "shift_leader", "store_manager"]}
      >
        <StoreLayout>
          <InventoryReceiptPage />
        </StoreLayout>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/inventory/leader-approval",
    element: (
      <RequirePortal portal="STORE">
        <RequireRole allowedRoles={["shift_leader"]}>
          <StoreLayout>
            <ShiftLeaderInventoryApprovalPage />
          </StoreLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/store/inventory/receipt-leader-approval",
    element: (
      <RequirePortal portal="STORE">
        <RequireRole allowedRoles={["shift_leader"]}>
          <StoreLayout>
            <ShiftLeaderInventoryReceiptApprovalPage />
          </StoreLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/store/inventory/receipt-store-manager-approval",
    element: (
      <RequirePortal portal="STORE">
        <RequireRole allowedRoles={["store_manager"]}>
          <StoreLayout>
            <StoreManagerInventoryReceiptApprovalPage />
          </StoreLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/store/staff/profile/edit-request",
    element: (
      <RequireStoreRole allowedRoles={["staff", "shift_leader"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StaffProfileEditRequestPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },
  {
    path: "/store/staff/profile/requests",
    element: (
      <RequireStoreRole allowedRoles={["staff", "shift_leader"]}>
        <StaffFeatureScope>
          <StoreLayout>
            <StaffProfileRequestHistoryPage />
          </StoreLayout>
        </StaffFeatureScope>
      </RequireStoreRole>
    ),
  },

  // Office / Head Officer zone — role district_manager, admin, owner
  // OFFICE
  {
    path: "/office",
    element: (
      <RequirePortal portal="OFFICE">
        <OfficeLayout>
          <OfficeLanding />
        </OfficeLayout>
      </RequirePortal>
    ),
  },
  {
    path: "/office/dashboard",
    element: (
      <RequirePortal portal="OFFICE">
        <OfficeLayout>
          <DashboardPage />
        </OfficeLayout>
      </RequirePortal>
    ),
  },
  {
    path: "/office/audit",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole
          allowedRoles={[
            "district_manager",
            "admin",
            "marketing_sale",
            "auditor",
          ]}
        >
          <OfficeLayout>
            <OfficeLanding />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/dm",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["district_manager", "admin"]}>
          <OfficeLayout>
            <DashboardPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  { path: "/office/audit/inventory-shift", element: <Navigate to="/office/dm/inventory-shift" replace /> },
  { path: "/office/dm/inventory-receipts", element: <Navigate to="/office/dm/inventory-waste/receipts" replace /> },
  {
    path: "/office/dm/inventory-shift",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["district_manager", "admin"]}>
          <OfficeLayout>
            <InventoryAuditApprovalPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <Navigate to="/office/marketing/contents" replace />
        </RequireRole>
      </RequirePortal>
    ),
  },

  // Reports
  {
    path: "/office/reports/revenue",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["district_manager", "admin"]}>
          <OfficeLayout>
            <RevenueReportPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/reports/payroll",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["district_manager", "admin"]}>
          <OfficeLayout>
            <PayrollReportPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  // ── Unified Hub 1: Menu & BOM Hub ──
  {
    path: "/office/menu",
    element: (
      <RequirePortal portal="OFFICE">
        <OfficeLayout>
          <OwnerMenuHubPage />
        </OfficeLayout>
      </RequirePortal>
    ),
  },
  { path: "/office/menu/products", element: <Navigate to="/office/menu?tab=products" replace /> },
  { path: "/office/menu/recipes", element: <Navigate to="/office/menu?tab=recipes" replace /> },
  { path: "/office/menu/categories", element: <Navigate to="/office/menu?tab=categories" replace /> },

  // ── Unified Hub 2: Inventory & Supplies Hub ──
  {
    path: "/office/inventory",
    element: (
      <RequirePortal portal="OFFICE">
        <OfficeLayout>
          <OwnerInventoryHubPage />
        </OfficeLayout>
      </RequirePortal>
    ),
  },

  // ── Unified Hub 3: Promotions & Offers Hub ──
  {
    path: "/office/promotions",
    element: (
      <RequirePortal portal="OFFICE">
        <OfficeLayout>
          <OwnerPromotionsHubPage />
        </OfficeLayout>
      </RequirePortal>
    ),
  },

  // ── Unified Hub 4: HR Management Hub ──
  {
    path: "/office/hr",
    element: (
      <RequirePortal portal="OFFICE">
        <OfficeLayout>
          <OwnerHRHubPage />
        </OfficeLayout>
      </RequirePortal>
    ),
  },
  { path: "/office/hr/staff-requests", element: <Navigate to="/office/hr?tab=requests" replace /> },
  { path: "/office/hr/requests", element: <Navigate to="/office/hr?tab=requests" replace /> },
  { path: "/office/hr/requests/staffing", element: <Navigate to="/office/hr?tab=requests" replace /> },
  { path: "/office/hr/requests/role-updates", element: <Navigate to="/office/hr?tab=requests" replace /> },
  { path: "/office/hr/employees", element: <Navigate to="/office/hr?tab=employees" replace /> },
  {
    path: "/office/hr/employees/:id",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["hr_manager", "admin", "owner"]}>
          <OfficeLayout>
            <HREmployeeDetailPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  { path: "/office/hr/payroll", element: <Navigate to="/office/hr?tab=payroll" replace /> },
  { path: "/office/hr/schedules", element: <Navigate to="/office/hr?tab=schedules" replace /> },
  { path: "/office/hr/attendance", element: <Navigate to="/office/hr?tab=attendance" replace /> },
  { path: "/office/hr/profile-requests", element: <Navigate to="/office/hr?tab=employees" replace /> },
  { path: "/office/hr/profile-requests/:id", element: <Navigate to="/office/hr?tab=employees" replace /> },
  {
    path: "/store/inventory/store-manager-approval",
    element: (
      <RequirePortal portal="STORE">
        <RequireRole allowedRoles={["store_manager"]}>
          <StoreLayout>
            <StoreManagerInventoryApprovalPage />
          </StoreLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/hr/requests/staffing",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["hr_manager", "admin"]}>
          <OfficeLayout>
            <HRStaffingRequestsPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/hr/requests/role-updates",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["hr_manager", "admin"]}>
          <OfficeLayout>
            <HRRoleUpdateRequestsPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/hr/attendance",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["hr_manager", "admin"]}>
          <OfficeLayout>
            <HRAttendancePage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/hr/schedules",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["hr_manager", "admin"]}>
          <OfficeLayout>
            <HRSchedulesPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  { path: "/office/inventory-waste", element: <Navigate to="/office/inventory?tab=waste" replace /> },
  { path: "/office/dm/inventory-waste", element: <Navigate to="/office/inventory?tab=waste" replace /> },
  { path: "/office/dm/inventory-shift", element: <Navigate to="/office/inventory?tab=shifts" replace /> },
  { path: "/office/complaints", element: <Navigate to="/office/dashboard" replace /> },
  {
    path: "/pos/held-orders",
    element: (
      <RequirePortal portal="POS">
        <PosViewportGuard>
          <PosHeldOrdersPage />
        </PosViewportGuard>
      </RequirePortal>
    ),
  },
  {
    path: "/pos/paid-orders",
    element: (
      <RequirePortal portal="POS">
        <PosViewportGuard>
          <PosPaidOrdersPage />
        </PosViewportGuard>
      </RequirePortal>
    ),
  },
  {
    path: "/pos/action-logs",
    element: (
      <RequirePortal portal="POS">
        <PosViewportGuard>
          <PosActionLogsPage />
        </PosViewportGuard>
      </RequirePortal>
    ),
  },

  // Marketing zone
  {
    path: "/office/marketing/contents",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingContentsPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing/combos",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingComboRuleListPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing/combos/new",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingComboRuleEditorPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing/combos/:id/edit",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingComboRuleEditorPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing/contents/new",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingContentEditorPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing/menu",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingMenuListPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing/menu/:id/edit",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingMenuEditorPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/marketing/contents/:id/edit",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingContentEditorPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  { path: "/office/marketing/combos", element: <Navigate to="/office/promotions?tab=combos" replace /> },
  { path: "/office/marketing/vouchers", element: <Navigate to="/office/promotions?tab=vouchers" replace /> },
  { path: "/office/marketing/promotions", element: <Navigate to="/office/promotions?tab=vouchers" replace /> },
  { path: "/office/marketing/point-vouchers", element: <Navigate to="/office/promotions?tab=vouchers" replace /> },
  { path: "/office/marketing/stamp-vouchers", element: <Navigate to="/office/promotions?tab=vouchers" replace /> },
  {
    path: "/office/marketing/complaints",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["marketing_sale", "admin"]}>
          <OfficeLayout>
            <MarketingComplaintsPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },

  // Audit zone
  {
    path: "/office/audit/stores",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["auditor", "admin"]}>
          <OfficeLayout>
            <StoreDataPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  {
    path: "/office/audit/flags",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["auditor", "admin"]}>
          <OfficeLayout>
            <AuditFlagsPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },

  {
    path: "/office/audit/reports",
    element: (
      <RequirePortal portal="OFFICE">
        <RequireRole allowedRoles={["auditor", "admin"]}>
          <OfficeLayout>
            <AuditReportsPage />
          </OfficeLayout>
        </RequireRole>
      </RequirePortal>
    ),
  },
  // POS zone (Web POS App Shell Layout)
  {
    path: "/pos",
    element: (
      <RequirePortal portal="POS">
        <PosViewportGuard>
          <PosWorkspaceLayout />
        </PosViewportGuard>
      </RequirePortal>
    ),
    children: [
      {
        index: true,
        element: <PosOrderPage />,
      },
      {
        path: "order",
        element: <PosOrderPage />,
      },
      {
        path: "held",
        element: <PosHeldOrdersPage />,
      },
      {
        path: "held-orders",
        element: <Navigate to="/pos/held" replace />,
      },
      {
        path: "orders",
        element: <PosPaidOrdersPage />,
      },
      {
        path: "paid-orders",
        element: <Navigate to="/pos/orders" replace />,
      },
      {
        path: "kds",
        element: <PosKdsViewPage />,
      },
      {
        path: "shift",
        element: <PosShiftReconciliationPage />,
      },
      {
        path: "shift-reconciliation",
        element: <Navigate to="/pos/shift" replace />,
      },
      {
        path: "report",
        element: <PosStoreReportPage />,
      },
      {
        path: "pickup",
        element: <Navigate to="/pos" replace />,
      },
    ],
  },
  {
    path: "/pickup-board/:storeId",
    element: <PublicPickupBoardPage />,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}

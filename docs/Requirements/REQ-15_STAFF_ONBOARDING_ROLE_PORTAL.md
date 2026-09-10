# ĐẶC TẢ YÊU CẦU: HỆ THỐNG ONBOARDING NHÂN VIÊN, PHÂN CẤP 3 ROLES & TRANG STAFF PORTAL NGHIỆP VỤ (REQ-15)
**Mã tài liệu**: `REQ-15`  
**Dự án**: KONEKT Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày lập**: 10/09/2026  
**Trạng thái**: Đã hoàn thành (Completed)  

---

## 1. MỤC TIÊU & BỐI CẢNH (OBJECTIVE & CONTEXT)

### 1.1 Bối cảnh
- Hiện tại, luồng đăng ký mở quán dành cho Chủ thương hiệu (Owner) đã hoàn tất. Tuy nhiên, luồng nhân sự cửa hàng chưa hoàn chỉnh:
  - Nhân viên chưa có màn hình tự đăng ký tài khoản cá nhân.
  - Chưa có quy trình chuẩn: Chủ quán cung cấp mã cửa hàng (`inviteCode`) -> Nhân viên nhập mã và gửi yêu cầu gia nhập -> Chủ quán duyệt và phân quyền ngay lúc duyệt.
  - Hệ thống cơ sở dữ liệu Enum `user_role` hiện chỉ có `staff` và `store_manager`, thiếu vai trò nòng cốt trong mô hình F&B/bán lẻ là **Trưởng ca (`shift_leader`)**.
  - Màn hình làm việc của nhân viên (`StaffDashboardPage`) chưa phản ánh đầy đủ các công cụ nghiệp vụ sẵn có trong hệ thống (như mở nhanh POS bán hàng, mở KDS bếp, chốt ca kiểm quỹ, kiểm kê và nhập hàng theo ca).

### 1.2 Mục tiêu
1. **Luồng Onboarding chuẩn hóa**:
   - Nhân viên tự tạo tài khoản cá nhân (Họ tên, email, mật khẩu, SĐT).
   - Đăng nhập -> Nhập mã cửa hàng (`inviteCode`) -> Xác nhận thông tin chi nhánh -> Gửi yêu cầu gia nhập (`storeJoinRequests`).
   - Màn hình chờ duyệt trực quan, tự động cập nhật khi được duyệt.
2. **Chủ quán phê duyệt & Phân vai trò tức thì**:
   - Chủ quán xem danh sách yêu cầu chờ duyệt trên giao diện Quản trị Nhân sự (`/office/hr?tab=requests`).
   - Bấm duyệt -> Modal lựa chọn 1 trong 3 Role: **Nhân viên (`staff`)**, **Trưởng ca (`shift_leader`)**, **Quản lý cửa hàng (`store_manager`)**.
   - Cập nhật tài khoản, gán tenantId, storeId và quyền hạn ngay trong transaction an toàn.
3. **Phân định rõ ràng 3 Role cấp cửa hàng**:
   - ☕ **Staff (Level 1)**: Chấm công (Check-in/Out), Xem lịch làm việc cá nhân, Mở POS bán hàng, Mở KDS bếp xem order, Kiểm kê tồn kho cuối ca, Nhập hàng ca, Báo hủy hàng hỏng, Xem bảng lương.
   - 🛡️ **Shift Leader (Level 2)**: Kế thừa toàn bộ quyền Staff + Mở/Chốt ca kiểm quỹ tiền mặt (`/pos/shift-reconciliation`), Phê duyệt phiếu kiểm kho/nhập kho ca làm (`/store/inventory/leader-approval`), Xử lý hủy món/chiết khấu tại POS.
   - 🏪 **Store Manager (Level 3)**: Kế thừa quyền Shift Leader + Phân công ca làm việc nhân viên (`/store/manager/assign-schedule`), Duyệt đơn đổi ca (`/store/manager/schedule-requests`), Báo cáo doanh thu & vận hành chi nhánh (`/store/manager/store-report`), Giám sát chấm công (`/store/manager/attendance-insights`), Quản lý danh sách nhân viên chi nhánh (`/store/manager/employees`).
4. **Phát triển Database & Nâng cấp Giao diện**:
   - Nâng cấp Postgres Enum `user_role` trong Supabase DB bổ sung `shift_leader`.
   - Xây dựng giao diện Staff Portal chuyên nghiệp theo chuẩn thẩm mỹ KONEKT (Xanh rêu sáng `#3D5E46`, kem latte `#FAF7F2`, viền `#DFD6C7`, 100% `lucide-react` icons).
   - Tối đa tái sử dụng code backend và frontend đã có sẵn.

---

## 2. USER STORIES

- **US-1 (Staff Registration)**: Là một nhân viên mới, tôi muốn tự đăng ký tài khoản trên nền tảng bằng email và mật khẩu để có tài khoản cá nhân làm việc.
- **US-2 (Store Join Request)**: Là một nhân viên đã đăng ký, tôi muốn nhập mã cửa hàng do Chủ quán cung cấp để gửi yêu cầu tham gia đúng chi nhánh làm việc của mình.
- **US-3 (Pending Screen)**: Là một nhân viên đang chờ duyệt, tôi muốn nhìn thấy màn hình thông báo rõ ràng về trạng thái yêu cầu của mình và chi nhánh đã gửi để không bị bỡ ngỡ.
- **US-4 (Owner Approval & Role Assignment)**: Là Chủ quán, tôi muốn xem danh sách các nhân viên xin gia nhập, chọn phân vai trò (`staff` / `shift_leader` / `store_manager`) ngay lúc bấm duyệt để kích hoạt quyền làm việc cho họ.
- **US-5 (Staff Portal & Daily Operations)**: Là một nhân viên (`staff`), sau khi được duyệt, khi đăng nhập tôi muốn vào ngay Portal nhân viên có sẵn các chức năng: Chấm công, Bán hàng POS, Bếp KDS, Xem lịch làm việc, Kiểm kho, Nhập hàng.
- **US-6 (Leader & Manager Escalation)**: Là một Trưởng ca (`shift_leader`) hoặc Quản lý (`store_manager`), tôi muốn nhìn thấy thêm các chức năng duyệt phiếu, chốt ca kiểm quỹ, phân ca và báo cáo tương ứng với cấp bậc của mình.

---

## 3. PHẠM VI CHI TIẾT (SCOPE)

### 3.1 Trong phạm vi (In-Scope)
1. **Database**:
   - Thêm giá trị `'shift_leader'` vào Postgres Enum `user_role` trong Supabase DB thông qua migration.
   - Cập nhật `backend/src/db/schema.ts` với `shift_leader`.
2. **Backend**:
   - Thêm API `POST /api/auth/register-staff`: Đăng ký tài khoản nhân viên độc lập.
   - Cập nhật `POST /api/auth/login-konekt`: Trả về trạng thái `requireStoreJoin: true` nếu user chưa có storeId / đang pending.
   - Cập nhật `roleGuard.ts`: Thiết lập Role Hierarchy 5 bậc: `customer (0) < staff (1) < shift_leader (2) < store_manager (3) < owner (4) < platform_admin (5)`.
   - Cập nhật `approveStoreJoinRequest` trong `workspace.service.ts`: Hỗ trợ gán role `shift_leader`.
3. **Frontend UI**:
   - Tạo trang Đăng ký nhân viên: `frontend/src/features/auth/pages/StaffRegisterPage.tsx` (`/register/staff`).
   - Tạo trang Gia nhập cửa hàng: `frontend/src/features/workspace/pages/StaffJoinStorePage.tsx` (`/workspace/join-store`).
   - Cập nhật trang Duyệt nhân sự của Owner: `frontend/src/features/office/hr/pages/StaffJoinRequestsPage.tsx` (Thêm radio chọn 3 roles và gán permissions).
   - Nâng cấp toàn diện Portal nhân viên: `frontend/src/features/staff/pages/StaffDashboardPage.tsx` (Tích hợp POS, KDS, Kiểm quỹ, Lịch làm việc, Tác vụ ca, Phê duyệt).
   - Cập nhật Router và Auth Store để hỗ trợ điều hướng thông minh theo vai trò và trạng thái onboarding.

### 3.2 Ngoài phạm vi (Out-of-Scope)
- Tiếp tục chỉnh sửa bố cục trang POS (đã tạm hoãn theo chỉ đạo của User).
- Tích hợp thêm các phương thức thanh toán bên thứ ba mới.

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA - AC)

- [x] **AC-1 (DB Migration)**: Enum `user_role` trên Supabase DB chấp nhận giá trị `'shift_leader'`, không gây lỗi runtime hay conflict với các bảng hiện có.
- [x] **AC-2 (Staff Register)**: Nhân viên đăng ký tài khoản tại `/register/staff` thành công, lưu mật khẩu băm an toàn qua bcrypt, trả về token và tự động điều hướng sang trang gia nhập cửa hàng.
- [x] **AC-3 (Store Join Flow)**: Nhân viên nhập mã `inviteCode` hợp lệ (VD: `STR-001-69EE`) -> hiển thị chính xác tên quán và chi nhánh -> bấm gửi yêu cầu -> tạo bản ghi `store_join_requests` trạng thái `pending`.
- [x] **AC-4 (Owner Approval)**: Chủ quán truy cập tab Duyệt nhân sự -> thấy yêu cầu chờ duyệt -> bấm Duyệt -> chọn role (`staff`, `shift_leader`, hoặc `store_manager`) -> tài khoản nhân viên được cập nhật `tenantId`, `storeId`, `role` thành công.
- [x] **AC-5 (Staff Portal)**: Sau khi được duyệt role `staff`, đăng nhập vào `/store/staff` hiển thị đầy đủ: Chấm công, Xem lịch làm, Mở POS bán hàng (`/pos/order`), Mở Bếp KDS (`/pos/kds`), Kiểm kho ca, Nhập hàng, Báo hủy hàng.
- [x] **AC-6 (Shift Leader Portal)**: Tài khoản role `shift_leader` nhìn thấy thêm các chức năng: Kiểm quỹ & Bàn giao ca (`/pos/shift-reconciliation`), Duyệt phiếu kiểm kho ca, Duyệt phiếu nhập hàng ca.
- [x] **AC-7 (Store Manager Portal)**: Tài khoản role `store_manager` được chuyển hướng vào `/store/manager` với đầy đủ quyền Phân ca, Duyệt đổi ca, Báo cáo doanh thu, Quản lý nhân viên chi nhánh.
- [x] **AC-8 (Design & Rules Compliance)**: 100% sử dụng icon từ `lucide-react` (không có emoji unicode), tuân thủ bảng màu xanh rêu sáng `#3D5E46` & kem latte `#FAF7F2`, `tsc` build thành công 0 lỗi.

# KẾ HOẠCH HÀNH ĐỘNG: XÂY DỰNG ONBOARDING NHÂN VIÊN, PHÂN CẤP 3 ROLES & TRANG STAFF PORTAL NGHIỆP VỤ (PLAN-15)
**Mã kế hoạch**: `PLAN-15`  
**Dựa trên yêu cầu**: `REQ-15`  
**Dự án**: KONEKT Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày lập**: 10/09/2026  
**Trạng thái**: Đã hoàn thành (Completed)  

---

## 1. MỤC TIÊU CỤ THỂ
1. Xây dựng luồng đăng ký tài khoản tự phục vụ dành cho nhân viên (`/register/staff`).
2. Xây dựng luồng Onboarding nhập mã cửa hàng (`inviteCode`) và gửi yêu cầu gia nhập chi nhánh (`/workspace/join-store`).
3. Phát triển cơ sở dữ liệu Supabase Postgres: Thêm giá trị `'shift_leader'` vào enum `user_role` và cập nhật Drizzle ORM schema.
4. Nâng cấp màn hình phê duyệt của Owner (`StaffJoinRequestsPage.tsx`): Cho phép chọn ngay 1 trong 3 Role (`staff`, `shift_leader`, `store_manager`) kèm phân quyền tự động lúc duyệt.
5. Đại tu và hoàn thiện giao diện Staff Portal (`StaffDashboardPage.tsx`): Tích hợp toàn bộ các tính năng nghiệp vụ cốt lõi sẵn có trong hệ thống (Mở POS bán hàng, Mở Bếp KDS, Chốt ca kiểm quỹ, Chấm công, Lịch làm việc, Kiểm kê tồn kho, Nhập hàng, Báo hủy hàng).

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### 2.1 Database & Migrations
- `[CHỈNH SỬA]` `backend/src/db/schema.ts`: Thêm `'shift_leader'` vào `userRoleEnum`.
- `[TẠO MỚI]` `backend/src/scripts/migrate_plan15_shift_leader.ts`: Script chạy SQL an toàn cập nhật enum `user_role` trên Supabase DB.

### 2.2 Backend Services & Controllers
- `[CHỈNH SỬA]` `backend/src/middlewares/roleGuard.ts`: Cập nhật Role Hierarchy 5 cấp (bổ sung `shift_leader: 2`).
- `[CHỈNH SỬA]` `backend/src/modules/auth/konektAuth.service.ts`:
  - Thêm `registerStaff`: Tạo tài khoản nhân viên mới.
  - Cập nhật `loginKonekt`: Nhận diện tài khoản pending hoặc chưa gán store để trả cờ `requireStoreJoin`.
- `[CHỈNH SỬA]` `backend/src/modules/auth/auth.controller.ts`: Thêm `registerStaffHandler`.
- `[CHỈNH SỬA]` `backend/src/modules/auth/auth.routes.ts`: Đăng ký endpoint `POST /api/auth/register-staff`.
- `[CHỈNH SỬA]` `backend/src/modules/workspace/workspace.service.ts`: Hỗ trợ `shift_leader` trong `approveStoreJoinRequest`.

### 2.3 Frontend UI & API
- `[CHỈNH SỬA]` `frontend/src/features/auth/api/auth.api.ts`: Thêm hàm `registerStaff`.
- `[TẠO MỚI]` `frontend/src/features/auth/pages/StaffRegisterPage.tsx`: Trang đăng ký tài khoản nhân viên mới (`/register/staff`).
- `[TẠO MỚI]` `frontend/src/features/workspace/pages/StaffJoinStorePage.tsx`: Trang nhập mã mời cửa hàng, xác nhận chi nhánh và gửi yêu cầu gia nhập (`/workspace/join-store`).
- `[CHỈNH SỬA]` `frontend/src/features/workspace/api/workspace.api.ts`: Cập nhật type `approveStaffRequest` hỗ trợ `"shift_leader"`.
- `[CHỈNH SỬA]` `frontend/src/features/office/hr/pages/StaffJoinRequestsPage.tsx`: Nâng cấp modal duyệt với 3 roles rõ ràng (`staff`, `shift_leader`, `store_manager`).
- `[CHỈNH SỬA]` `frontend/src/features/staff/pages/StaffDashboardPage.tsx`: Tái cấu trúc Dashboard với các thẻ nghiệp vụ cao cấp (POS, KDS, Kiểm quỹ, Ca làm, Kiểm kho, Nhập hàng).
- `[CHỈNH SỬA]` `frontend/src/features/auth/pages/MerchantLoginPage.tsx`: Điều hướng thông minh nếu user cần nhập mã cửa hàng.
- `[CHỈNH SỬA]` `frontend/src/app/store/auth.store.ts`: Hỗ trợ role `shift_leader`.
- `[CHỈNH SỬA]` `frontend/src/app/router/index.tsx`: Đăng ký routes `/register/staff`, `/workspace/join-store` và cập nhật guards.

---

## 3. CÁC BƯỚC TRIỂN KHAI TUẦN TỰ (STEP-BY-STEP)

### Bước 1: Database Migration & Schema Update
1. Cập nhật `backend/src/db/schema.ts` thêm `'shift_leader'` vào `userRoleEnum`.
2. Tạo script `backend/src/scripts/migrate_plan15_shift_leader.ts`:
   Thực thi câu lệnh SQL an toàn:
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_enum e
       JOIN pg_type t ON e.enumtypid = t.oid
       WHERE t.typname = 'user_role' AND e.enumlabel = 'shift_leader'
     ) THEN
       ALTER TYPE user_role ADD VALUE 'shift_leader' BEFORE 'staff';
     END IF;
   END $$;
   ```
3. Chạy script để cập nhật database Supabase thành công.

### Bước 2: Backend Logic & Endpoints
1. Cập nhật `roleGuard.ts`:
   ```ts
   const ROLE_LEVEL: Record<string, number> = {
     customer: 0,
     staff: 1,
     shift_leader: 2,
     store_manager: 3,
     owner: 4,
     platform_admin: 5,
   };
   ```
2. Thêm logic đăng ký nhân viên `registerStaff` trong `konektAuth.service.ts`:
   - Băm mật khẩu bằng `bcrypt`.
   - Tạo user với `role: 'staff'`, chưa gán `tenantId`/`storeId` (hoặc gắn tạm cờ chưa kích hoạt store).
   - Trả về token và thông tin user với cờ `requireStoreJoin: true`.
3. Cập nhật `loginKonekt`:
   - Nếu user chưa có `storeId` hoặc có bản ghi `store_join_requests` ở trạng thái `pending`, trả về thông tin request để frontend hiển thị màn hình chờ hoặc yêu cầu nhập mã mời.
4. Cập nhật `workspace.service.ts`:
   - Cho phép `approveStoreJoinRequest` gán role là `"store_manager" | "shift_leader" | "staff"`.

### Bước 3: Frontend Onboarding (Đăng ký & Nhập mã cửa hàng)
1. Tạo `StaffRegisterPage.tsx` tại route `/register/staff`:
   - Form đăng ký: Họ và tên, Email, Mật khẩu, Số điện thoại.
   - Giao diện chuẩn Taste-Skill: Nền kem ngà, thẻ viền đôi, xanh rêu sáng `#3D5E46`.
   - Có liên kết chuyển nhanh: "Bạn là Chủ quán muốn mở cửa hàng mới? Đăng ký mở quán tại đây" và "Đã có tài khoản? Đăng nhập ngay".
2. Tạo `StaffJoinStorePage.tsx` tại route `/workspace/join-store`:
   - Ô nhập "Mã Cửa Hàng (Store Code)" to rõ.
   - Nhập xong mã -> Tự động gọi `workspaceApi.verifyStoreInvite`: Hiển thị card xác nhận thông tin chi nhánh (Tên thương hiệu, Tên chi nhánh, Địa chỉ, SĐT chi nhánh).
   - Ô chọn vị trí ứng tuyển ("Nhân viên pha chế", "Nhân viên thu ngân", "Nhân viên phục vụ", "Trưởng ca dự thính...") và ghi chú/lời nhắn gửi Chủ quán.
   - Bấm "Gửi Yêu Cầu Gia Nhập".
   - Sau khi gửi (hoặc nếu đã có yêu cầu pending): Hiển thị thẻ trạng thái Chờ Duyệt (Pending State) trang nhã kèm thông tin chi nhánh đã gửi, ngày gửi và nút "Kiểm tra trạng thái duyệt".

### Bước 4: Nâng cấp Màn hình Duyệt của Chủ Quán (`StaffJoinRequestsPage.tsx`)
1. Cập nhật Modal Duyệt:
   - Thẻ chọn 3 Roles trực quan với mô tả quyền hạn:
     * ☕ **Nhân viên (Staff)**: Bán hàng POS, Bếp KDS, Chấm công, Báo hủy hàng, Kiểm kê ca.
     * 🛡️ **Trưởng ca (Shift Leader)**: Toàn quyền Staff + Chốt ca kiểm quỹ, Duyệt phiếu kiểm kho/nhập kho ca, Xử lý hủy món/chiết khấu POS.
     * 🏪 **Quản lý cửa hàng (Store Manager)**: Toàn quyền Shift Leader + Phân công ca, Duyệt đổi ca, Báo cáo doanh thu & hiệu suất, Quản lý nhân sự.
   - Tự động tick các quyền mặc định phù hợp cho từng role.
   - Gọi API duyệt -> Thông báo thành công -> Cập nhật danh sách tức thì.

### Bước 5: Đại tu Staff Portal (`StaffDashboardPage.tsx`)
1. Tái cấu trúc Dashboard cá nhân cho nhân viên:
   - Header chào mừng: Tên nhân viên, Badge vai trò chuẩn (`Nhân viên`, `Trưởng ca`, `Quản lý`), Chi nhánh đang làm việc.
   - Cụm tác vụ Bán hàng & Vận hành (Hàng đầu tiên):
     * ⚡ **Mở POS Bán Hàng** (`/pos/order`): Nút/card lớn nổi bật giúp nhân viên vào ngay màn hình bán hàng.
     * 🍳 **Màn hình Bếp KDS** (`/pos/kds`): Nút/card mở màn hình chế biến món ăn cho Barista/Bếp.
     * 💵 **Kiểm Quỹ & Chốt Ca** (`/pos/shift-reconciliation`): Nổi bật dành riêng cho `shift_leader` và thu ngân.
   - Widget Chấm công: Check-in / Check-out ca làm việc hôm nay, giờ vào ca, trạng thái.
   - Lịch làm việc cá nhân & Bảng lương: Theo dõi ca tuần và thu nhập.
   - Cụm tác vụ trong ca: Kiểm kê tồn kho ca (`/store/staff/inventory-shift`), Nhập hàng thực tế (`/store/staff/inventory-receipts`), Báo hủy hàng hỏng (`/inventory/disposals/create`).
   - Cụm Phê duyệt (Dành riêng cho `shift_leader`): Xác nhận phiếu kiểm hàng ca (`/store/inventory/leader-approval`), Xác nhận phiếu nhập hàng ca (`/store/inventory/receipt-leader-approval`).

### Bước 6: Kiểm thử & Nghiệm thu
1. Kiểm tra biên dịch TypeScript toàn dự án (`npm run build` frontend & backend).
2. Kiểm thử luồng trọn vẹn:
   - Đăng ký tài khoản nhân viên mới.
   - Đăng nhập -> Vào trang nhập mã cửa hàng -> Gửi yêu cầu.
   - Đăng nhập tài khoản Owner (`owner@cafe.dev`) -> Vào duyệt nhân sự -> Chọn role `shift_leader` -> Phê duyệt.
   - Đăng nhập lại tài khoản nhân viên vừa được duyệt -> Vào Portal nhân viên -> Xác nhận hiển thị đầy đủ các tính năng của `shift_leader`.
3. Ghi log `[LOG-010]` vào `docs/Developing/logs/DEV_CHANGELOG.md` và cập nhật `walkthrough.md`.

---

## 4. ĐÁNH GIÁ RỦI RO & PHƯƠNG ÁN DỰ PHÒNG
- **Rủi ro Enum Postgres**: Lệnh `ALTER TYPE user_role ADD VALUE` trong Postgres không thể chạy trong transaction block nếu không cẩn thận.
  - *Giải pháp*: Script migration chạy trực tiếp thông qua raw query ngoài transaction độc lập hoặc dùng khối lệnh an toàn `DO $$`.
- **Bảo tồn tài khoản cũ**: Các tài khoản seed sẵn (`staff@cafe.dev`, `manager@cafe.dev`, `owner@cafe.dev`) tiếp tục hoạt động bình thường 100%.
- **Quy tắc Icon**: Kiểm soát 100% icon bằng `lucide-react`, không dùng emoji unicode.

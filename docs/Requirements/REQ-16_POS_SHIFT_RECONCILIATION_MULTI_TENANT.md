# ĐẶC TẢ YÊU CẦU: HỆ THỐNG CA BÁN HÀNG & ĐỐI SOÁT KÉT TIỀN POS CHUẨN MULTI-TENANT (REQ-16)

**Mã yêu cầu**: `REQ-16`  
**Dự án**: KONEKT Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày tạo**: 11/09/2026  
**Trạng thái**: Draft / Chờ duyệt (Pending Approval)  
**Kế hoạch liên kết**: `PLAN-16_POS_SHIFT_RECONCILIATION_MULTI_TENANT.md`

---

## 1. MỤC TIÊU & BỐI CẢNH (GOALS & CONTEXT)

### 1.1 Bối cảnh
Sau khi hệ thống chuyển đổi từ kiến trúc Single-tenant chuỗi sang kiến trúc **Multi-Tenant SaaS (Row-Level Tenancy)**, phân hệ Ca bán hàng POS và Chốt ca kiểm quỹ (`shift_sessions`) gặp phải các lỗi nghiêm trọng:
1. **Lỗi con "Zombie" tự động mở ca ngầm**: Hàm `getCurrentShiftReconciliation` tự động gọi `autoOpenDefaultShiftSession` mỗi khi chưa có ca mở. Kết quả là người dùng vừa bấm đóng ca xong thì hệ thống tự mở lại ca khác, đồng thời form **"Mở ca mới"** (nhập tiền lẻ ban đầu) không bao giờ hiển thị.
2. **Lỗi phân quyền Portal (`403 Forbidden`)**: `shiftReconciliation.routes.ts` chỉ cho phép `portalGuard(["POS"])`. Nhân viên (`staff`, `shift_leader`) và quản lý (`store_manager`) đăng nhập qua hệ thống có `portal: "STORE"` nên bị chặn hoàn toàn, không thể vào xem hoặc chốt ca bán hàng.
3. **Mối nguy rò rỉ dữ liệu giữa các Tenant (Multi-Tenant Isolation Risk)**: Một số câu query SQL trong `shiftReconciliation.repo.ts` chỉ lọc theo `store_id` mà bỏ qua điều kiện `tenant_id`, có nguy cơ gây sai lệch đối soát khi nhiều thương hiệu/quán khác nhau cùng hoạt động trên nền tảng SaaS.
4. **Dữ liệu cứng (Hardcoded)**: Bảng `shift_sessions` chưa lưu `shift_code`, câu query SQL hardcode `'A' AS shift_code` khiến việc chọn Ca B bị sai lệch.
5. **Chuỗi xác nhận đóng ca cứng nhắc**: Yêu cầu gõ chính xác không dấu `XAC NHAN DONG CA`, nếu thu ngân gõ có dấu theo thói quen (`XÁC NHẬN ĐÓNG CA`) sẽ bị lỗi 400.

### 1.2 Mục tiêu
* Xây dựng lại quy trình **Mở ca ➔ Bán hàng ➔ Đối soát két tiền ➔ Đóng ca** hoàn chỉnh, trực quan.
* Đảm bảo **100% cách ly Multi-Tenant**: Mọi thao tác truy vấn, cập nhật, chốt ca đều phải đi kèm đồng thời cả `tenant_id` và `store_id`. Tuyệt đối không để ca của Tenant này ảnh hưởng sang Tenant khác.
* Mở quyền cho các vai trò vận hành quầy (`staff`, `shift_leader`, `store_manager`, `owner`) truy cập và thực hiện thao tác ca bán hàng của chi nhánh trực thuộc.

---

## 2. USER STORIES & USE CASES

### US-1: Mở ca bán hàng đầu ngày / đầu buổi
* **Là một** Thu ngân (Staff) hoặc Trưởng ca (Shift Leader),
* **Tôi muốn** khi vào quầy bán hàng, nếu chưa có ca mở, hệ thống yêu cầu tôi khai báo số tiền lẻ ban đầu trong két (VD: 500.000đ) và chọn loại ca (Ca A hoặc Ca B),
* **Để** hệ thống lấy mốc tiền đó tính toán đối soát chính xác doanh thu tiền mặt khi hết ca.

### US-2: Bán hàng POS gắn liền với Ca mở
* **Là một** Thu ngân,
* **Tôi muốn** màn hình POS (`/pos/order`) nhận diện đúng ca đang mở, hiển thị cảnh báo chặn tạo đơn nếu chưa mở ca,
* **Và khi thanh toán mỗi đơn hàng**, hệ thống tự động tích lũy doanh số tiền mặt, doanh số chuyển khoản/VietQR vào ca mở của chính Tenant và Store của tôi.

### US-3: Đối soát chốt két tiền 2 bước an toàn
* **Là một** Trưởng ca hoặc Quản lý cửa hàng,
* **Tôi muốn** thực hiện chốt ca qua 2 bước:
  - **Bước 1**: Nhập tiền đếm thực tế ➔ Xem ngay chênh lệch (Thừa/Thiếu/Khớp két).
  - **Bước 2**: Nhập lại tiền xác nhận, nhập chuỗi xác nhận (hỗ trợ cả có dấu và không dấu: `"XÁC NHẬN ĐÓNG CA"` / `"XAC NHAN DONG CA"`), ghi chú giải trình ➔ Bấm Đóng ca.
* **Để** phòng ngừa gian lận hoặc sai sót nhầm lẫn tiền bạc.

### US-4: Kết thúc ca sạch sẽ
* **Là một** Thu ngân,
* **Tôi muốn** sau khi chốt ca thành công, hệ thống chuyển ca sang trạng thái `closed`, không tự động sinh ca mới ngầm,
* **Để** người vào ca tiếp theo có thể nhìn thấy form mở ca mới sạch sẽ với số tiền két của ca họ.

---

## 3. PHẠM VI NGHIỆP VỤ (SCOPE)

### Trong phạm vi (In-Scope)
1. **Database Supabase**:
   - Thêm cột `shift_code VARCHAR(10) DEFAULT 'A' NOT NULL` vào bảng `public.shift_sessions`.
   - Cập nhật Drizzle ORM [schema.ts](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/backend/src/db/schema.ts).
2. **Backend Services & Repos**:
   - Xóa bỏ hoàn toàn `autoOpenDefaultShiftSession` trong `getCurrentShiftReconciliation`. Khi không có ca mở ➔ Trả về `current: null`.
   - Thêm điều kiện cô lập `WHERE tenant_id = $tenantId AND store_id = $storeId` vào tất cả câu query của `shiftReconciliation.repo.ts`.
   - Cho phép các portal `["POS", "STORE", "OFFICE"]` và vai trò `["staff", "shift_leader", "store_manager", "owner"]` truy cập route ca bán hàng.
   - Hàm chuẩn hóa chuỗi xác nhận đóng ca (hỗ trợ không dấu & có dấu).
   - Tắt query bảng legacy `coffee_chain_db.pos_action_logs`.
3. **Frontend UI & State**:
   - Tối ưu màn hình [PosShiftReconciliationPage.tsx](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/frontend/src/features/pos/pages/PosShiftReconciliationPage.tsx):
     - Khi `current === null`: Render Form Mở Ca Mới to rõ, thẩm mỹ theo Taste-Skill.
     - Khi `current !== null`: Render Bảng Đối Soát & Modal Đóng Ca 2 Bước.
     - Sau khi đóng ca: Hiển thị thông báo thành công và chuyển sang form chờ mở ca mới.
   - Cập nhật [PosOrderPage.tsx](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/frontend/src/features/pos/pages/PosOrderPage.tsx):
     - Khi `current === null`: Banner thông báo thanh lịch *"Quầy chưa mở ca làm việc. Vui lòng mở ca để bắt đầu tạo đơn"* kèm nút bấm 1-chạm [Mở Ca Ngay].

### Ngoài phạm vi (Out-of-Scope)
* Hệ thống phân lịch ca tuần và chấm công GPS nhân sự (sẽ xử lý ở `REQ-17` chuyên biệt sau khi hoàn tất quy trình bán hàng POS này).

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA - AC)

* [x] **AC-1 (Multi-Tenant Isolation)**: Thao tác mở/đóng ca của Tenant A chỉ ảnh hưởng tới `shift_sessions` có `tenant_id = A`. Tenant B có ca độc lập hoàn toàn.
* [x] **AC-2 (No Zombie Auto-Open)**: Khi không có ca mở, `GET /api/pos/shift-reconciliations/current` trả về `current: null`. Không có bản ghi mới nào tự sinh ra trong DB.
* [x] **AC-3 (Open Shift Flow)**: Thu ngân nhập tiền đầu ca (VD: `500,000`), chọn Ca A/Ca B, bấm "Mở ca" ➔ Bản ghi tạo mới với đúng `opening_cash`, `shift_code`, `status = 'open'`.
* [x] **AC-4 (POS Order Sync)**: Tạo đơn hàng thành công trên POS ➔ Tự động cập nhật cộng dồn `total_orders` và `total_sales` vào đúng ca mở của store.
* [x] **AC-5 (Close Shift Flow)**: Đóng ca 2 bước thành công ➔ Ca chuyển sang `closed`, chốt đúng `closing_cash`, `expected_cash`, `cash_difference`.
* [x] **AC-6 (Role & Portal Permissions)**: Cả `owner`, `store_manager`, `shift_leader`, `staff` trực thuộc store đều vào được trang chốt ca mà không bị lỗi `403 Forbidden (portal)`.
* [x] **AC-7 (Accent Normalization)**: Thu ngân gõ `"XÁC NHẬN ĐÓNG CA"` hoặc `"xác nhận đóng ca"` hoặc `"XAC NHAN DONG CA"` đều đóng ca thành công.
* [x] **AC-8 (Zero Type Errors)**: `npx tsc --noEmit` trên cả Backend và Frontend đều đạt 0 lỗi.

# KẾ HOẠCH HÀNH ĐỘNG: HOÀN THIỆN CA BÁN HÀNG POS & ĐỐI SOÁT KÉT TIỀN MULTI-TENANT (PLAN-16)

**Mã kế hoạch**: `PLAN-16`  
**Dựa trên yêu cầu**: `REQ-16`  
**Dự án**: KONEKT Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày lập**: 11/09/2026  
**Trạng thái**: Đã hoàn thành (Completed)  

---

## 1. MỤC TIÊU CỤ THỂ
1. **Xóa bỏ triệt để lỗi tự động mở ca ngầm** (`autoOpenDefaultShiftSession`) trong `shiftReconciliation.service.ts`: Trả về `null` khi chưa có ca mở để hiển thị form Mở ca mới cho người dùng.
2. **Đảm bảo 100% cách ly Multi-Tenant**: Bổ sung điều kiện `tenant_id = $tenantId` vào tất cả các câu truy vấn và cập nhật của `shiftReconciliation.repo.ts`. Đảm bảo các Tenant độc lập không bao giờ nhìn thấy hoặc tác động lên ca của nhau.
3. **Mở rộng phân quyền Portal**: Sửa `portalGuard` và các hàm controller để cho phép cả `portal: "STORE"` (nhân viên, trưởng ca, quản lý) và `portal: "OFFICE"` (chủ quán) đều sử dụng được tính năng ca bán hàng và POS của cửa hàng được phân công.
4. **Cập nhật Database Schema**: Bổ sung cột `shift_code VARCHAR(10) DEFAULT 'A' NOT NULL` vào bảng `public.shift_sessions` trên Supabase và Drizzle ORM schema.
5. **Chuẩn hóa xác thực đóng ca**: Hỗ trợ người dùng nhập chuỗi xác nhận cả có dấu và không dấu (`"XÁC NHẬN ĐÓNG CA"` / `"XAC NHAN DONG CA"`).
6. **Hoàn thiện luồng người dùng (Frontend UX)**:
   - [PosShiftReconciliationPage.tsx](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/frontend/src/features/pos/pages/PosShiftReconciliationPage.tsx): Hiển thị form mở ca khi chưa có ca mở; sau khi đóng ca chuyển về trạng thái sẵn sàng mở ca tiếp theo.
   - [PosOrderPage.tsx](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/frontend/src/features/pos/pages/PosOrderPage.tsx): Banner cảnh báo chưa mở ca kèm nút chuyển nhanh qua trang mở ca.

---

## 2. DANH SÁCH TẬP TIN TÁC ĐỘNG

### 2.1 Database & Migrations
- `[CHỈNH SỬA]` `backend/src/db/schema.ts`: Thêm trường `shiftCode` vào `shiftSessions`.
- `[TẠO MỚI]` `backend/src/scripts/migrate_plan16_shift_code.ts`: Script chạy migration thêm cột `shift_code` vào `public.shift_sessions`.

### 2.2 Backend Logic & Routes
- `[CHỈNH SỬA]` `backend/src/modules/shift-reconciliation/shiftReconciliation.routes.ts`: Cho phép `portalGuard(["POS", "STORE", "OFFICE"])`.
- `[CHỈNH SỬA]` `backend/src/modules/shift-reconciliation/shiftReconciliation.controller.ts`: Lấy chính xác `tenantId` và `storeId` theo ngữ cảnh người dùng.
- `[CHỈNH SỬA]` `backend/src/modules/shift-reconciliation/shiftReconciliation.service.ts`: Xóa `autoOpenDefaultShiftSession`, thêm hàm normalize text xác nhận đóng ca, truyền `tenantId` xuống repo.
- `[CHỈNH SỬA]` `backend/src/modules/shift-reconciliation/shiftReconciliation.repo.ts`: Bổ sung lọc `tenant_id = $tenantId AND store_id = $storeId`, lưu `shift_code` thực tế, xóa bỏ hardcode `'A'`.
- `[CHỈNH SỬA]` `backend/src/modules/orders/orders.routes.ts`: Cho phép `portalGuard(["POS", "STORE", "OFFICE"])`.
- `[CHỈNH SỬA]` `backend/src/modules/pos-orders/posOrder.controller.ts`: Cho phép user portal `STORE` thao tác POS.
- `[CHỈNH SỬA]` `backend/src/modules/pos-action-log/posActionLog.service.ts`: Vô hiệu hóa truy vấn vào schema cũ `coffee_chain_db`.

### 2.3 Frontend UI
- `[CHỈNH SỬA]` `frontend/src/features/pos/pages/PosShiftReconciliationPage.tsx`: Cải tiến form Mở ca mới (chuẩn hóa Taste-Skill), reset state sau khi đóng ca, hiển thị thông báo trạng thái rõ ràng.
- `[CHỈNH SỬA]` `frontend/src/features/pos/pages/PosOrderPage.tsx`: Tinh chỉnh banner cảnh báo chưa mở ca và nút điều hướng mượt mà.

---

## 3. CÁC BƯỚC THỰC THI CHI TIẾT (STEP-BY-STEP)

### Bước 1: Database Migration
1. Thêm `shiftCode: varchar('shift_code', { length: 10 }).default('A').notNull()` vào `shiftSessions` trong `backend/src/db/schema.ts`.
2. Viết script `backend/src/scripts/migrate_plan16_shift_code.ts` thực thi SQL:
   ```sql
   ALTER TABLE public.shift_sessions 
   ADD COLUMN IF NOT EXISTS shift_code VARCHAR(10) DEFAULT 'A' NOT NULL;
   ```
3. Chạy script để cập nhật database Supabase.

### Bước 2: Refactor Backend - Multi-Tenant Isolation & Lifecycle
1. Cập nhật `shiftReconciliation.repo.ts`:
   - Mọi hàm (`findOpenReconciliationByStore`, `createReconciliation`, `getReconciliationById`, `closeReconciliation`, `listReconciliations`, `getReconciliationSummary`, `getReconciliationPayments`) đều nhận tham số `tenantId: number` và `storeId: number`.
   - Câu lệnh SQL bổ sung `WHERE s.tenant_id = $tenantId AND s.store_id = $storeId`.
   - Lưu `shift_code` vào database, lấy ra đúng giá trị thực tế thay vì hardcode `'A'`.
   - Xóa bỏ hàm `autoOpenDefaultShiftSession`.
2. Cập nhật `shiftReconciliation.service.ts`:
   - `getCurrentShiftReconciliation`: Nếu không có ca mở ➔ Trả về `null`.
   - Viết hàm `normalizeConfirmText(text: string)`:
     ```ts
     function normalizeConfirmText(str: string) {
       return str
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/[đĐ]/g, "d")
         .trim()
         .toUpperCase();
     }
     ```
     Kiểm tra `normalizeConfirmText(confirmText) === "XAC NHAN DONG CA"`.
3. Cập nhật `shiftReconciliation.controller.ts` & `routes.ts`:
   - Route chấp nhận `portalGuard(["POS", "STORE", "OFFICE"])`.
   - Trích xuất `tenantId = req.user.tenantId` và `storeId = req.headers['x-store-id'] || req.user.storeId`.

### Bước 3: Cập nhật Phân quyền POS Routes cho Nhân viên Quầy
1. Cập nhật `orders.routes.ts`:
   - Đổi `portalGuard(["POS"])` ➔ `portalGuard(["POS", "STORE", "OFFICE"])`.
2. Cập nhật `posOrder.controller.ts` và `orders.controller.ts`:
   - Cho phép các user có portal `STORE` (với role `staff`, `shift_leader`, `store_manager`) thao tác bán hàng POS mà không bị chặn `403`.

### Bước 4: Hoàn thiện Giao diện POS & Chốt Ca (Frontend)
1. Cập nhật `PosShiftReconciliationPage.tsx`:
   - Khi `detail === null`: Hiển thị card "Mở ca bán hàng" trang nhã với dải màu KONEKT (xanh rêu `#3D5E46` & nền kem ngà `#F4EFEB`), cho phép nhập tiền lẻ đầu ca (mặc định format tiền tệ VND).
   - Khi đóng ca thành công: Reset state, tải lại lịch sử các ca đã đóng, chuyển sang chế độ sẵn sàng cho ca tiếp theo.
2. Cập nhật `PosOrderPage.tsx`:
   - Nếu `!currentShift`: Hiển thị banner cảnh báo trang nhã kèm nút "Mở ca bán hàng" chuyển hướng nhanh đến `/pos/shift`.

---

## 4. ĐÁNH GIÁ RỦI RO & PHƯƠNG ÁN ROLLBACK
* **Rủi ro**: Nếu chưa mở ca, thu ngân không thể tạo order.
  * **Kiểm soát**: Đây là đúng chuẩn quy trình kế toán quầy POS. Thu ngân chỉ cần mất 3 giây để nhập số tiền lẻ và bấm "Mở ca". Màn hình POS có nút bấm 1-chạm đưa thẳng vào trang mở ca.
* **Rollback**: Toàn bộ thay đổi mã nguồn được quản lý bằng Git trên branch `KhoaLe`, có thể revert bất cứ lúc nào.

---

## 5. KẾ HOẠCH KIỂM THỬ (VERIFICATION PLAN) - ĐÃ HOÀN TẤT
1. [x] **Typecheck**: Chạy `npx tsc --noEmit` ở cả `backend` và `frontend` đạt **0 lỗi** (Exit code 0).
2. [x] **Kiểm thử luồng mở ca**:
   - Vào `/pos/shift-reconciliation`, Form Mở Ca Mới hiển thị chuẩn Taste-Skill và KONEKT palette.
   - Nhập tiền lẻ 500.000đ, chọn Ca A, bấm "Mở Ca A & Vào Bán Hàng" ➔ Database lưu đúng `shift_code = 'A'`, `opening_cash = 500000`, `tenant_id = 1, store_id = 1`.
3. [x] **Kiểm thử bán hàng gắn ca**:
   - Mở `/pos/order`, tạo đơn hàng `#ORD-KONEKT-260911-4811` thanh toán tiền mặt 69.000đ.
   - Database `shift_sessions` tự động cộng dồn `total_orders = 1` và `total_sales = 69000`.
4. [x] **Kiểm thử đóng ca & đối soát 2 bước**:
   - Mở `/pos/shift-reconciliation`, tiền mặt lý thuyết trong két hiển thị chính xác 569.000đ.
   - Bước 1 nhập thực đếm 569.000đ ➔ Xem preview chênh lệch = 0đ (Khớp 100% két).
   - Bước 2 xác nhận chuỗi `"XÁC NHẬN ĐÓNG CA"` (hoặc `"XAC NHAN DONG CA"`) ➔ Đóng ca thành công.
   - Giao diện không tự sinh ca ngầm, quay về form sạch sẽ sẵn sàng mở ca tiếp theo.
5. [x] **Kiểm thử Multi-Tenant**:
   - Thao tác trên Store của Tenant 1 hoàn toàn cô lập, không ảnh hưởng hay rò rỉ sang Tenant 6.

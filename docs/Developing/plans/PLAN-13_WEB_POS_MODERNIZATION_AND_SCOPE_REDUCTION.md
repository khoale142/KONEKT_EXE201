# KẾ HOẠCH HÀNH ĐỘNG: HIỆN ĐẠI HÓA WEB POS ĐA NGÀNH, CLEAN CODE DRIZZLE ORM & CẤU HÌNH ĐỊNH DANH PHỤC VỤ LINH HOẠT
**Mã kế hoạch**: `PLAN-13`  
**Dựa trên yêu cầu**: `docs/Requirements/REQ-13_WEB_POS_MODERNIZATION_AND_SCOPE_REDUCTION.md`  
**Ngày lập**: 10/09/2026 (Cập nhật đợt 2 theo chỉ đạo Chủ quán)  
**Người lập**: Antigravity AI Agent  
**Trạng thái**: Chờ Chủ quán phê duyệt (Pending Owner Approval)  

---

## 1. MỤC TIÊU KỸ THUẬT

1. **Nâng cấp CSDL bằng Drizzle ORM & Chạy Migration**:
   - Bổ sung vào bảng `orders`: `order_type`, `service_mode`, `service_identifier`, `queue_number`, `customer_name`, `customer_phone`, `discount_reason`.
   - Bổ sung vào bảng `stores`: `pos_config` (jsonb) lưu cấu hình mặc định (chế độ phục vụ mặc định, các chế độ cho phép, mẫu in bill).
   - Chạy migration an toàn bằng Drizzle trên Supabase PostgreSQL 17.6.
2. **Clean Code Toàn Diện Phân Hệ POS (Loại bỏ 100% Raw SQL Driver `coffee_chain_db`)**:
   - Viết lại các module POS backend bằng cú pháp Drizzle ORM thuần (`db.select()`, `db.insert()`, `db.update()`, `db.transaction()`).
   - Xóa bỏ triệt để các truy vấn SQL thô vào bảng không tồn tại `coffee_chain_db.orders`, `coffee_chain_db.gateway_payments`, `coffee_chain_db.order_payments`.
   - Đảm bảo 100% Type-safety từ CSDL đến Frontend.
3. **Cấu hình Định danh Phục vụ Linh hoạt Đa Ngành Nghề**:
   - Bỏ thẻ rung phần cứng.
   - Hỗ trợ 5 chế độ: **Số bàn** (`table`), **Thẻ số để bàn** (`table_marker`), **Số thứ tự tự tăng** (`queue_number`), **Tên & SĐT khách** (`customer_name`), **Bán nhanh tại quầy** (`none`).
   - Thu ngân chuyển đổi 1 chạm trên đầu giỏ hàng POS, kèm tính năng phụ: giảm giá tùy chọn (% hoặc tiền mặt), ghi chú món/đơn.
4. **Chuyển Đổi Sang Web POS App Shell Layout**:
   - Xóa bỏ Dashboard 10 thẻ to cồng kềnh cũ.
   - Dựng `PosWorkspaceLayout.tsx` với thanh Menu điều hướng cố định phía trên: ☕ Bán hàng, 📋 Đơn đang giữ, 🧾 Lịch sử đơn, 🍳 Bếp KDS, 💰 Ca bán hàng.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### Database & Backend:
- `[CHỈNH SỬA]` `backend/src/db/schema.ts`: Mở rộng schema `orders`, `stores` phục vụ định danh đa ngành và pos_config.
- `[TẠO MỚI]` `backend/src/scripts/migrate_plan13.ts`: Script chạy migration trực tiếp cập nhật schema lên Supabase DB.
- `[CHỈNH SỬA / CLEAN CODE]` `backend/src/modules/pos-orders/posOrder.service.ts`: Toàn bộ logic POS viết bằng Drizzle ORM: tạo đơn, lưu đơn tạm (`hold`), lấy danh sách đơn giữ, tra cứu đơn đã thanh toán (`paid-search`), hủy đơn, tính số thứ tự tự tăng `queueNumber`.
- `[CHỈNH SỬA / CLEAN CODE]` `backend/src/modules/pos-orders/posOrder.controller.ts`: Controller nhận các yêu cầu POS mới.
- `[CHỈNH SỬA / CLEAN CODE]` `backend/src/modules/payments/payments.repo.ts`: Di chuyển gateway payments VietQR sang Drizzle ORM trên `public.payments`.
- `[CHỈNH SỬA]` `backend/src/modules/orders/orders.routes.ts`: Dọn dẹp routes, trỏ toàn bộ endpoint POS về controller Drizzle mới.

### Frontend:
- `[TẠO MỚI]` `frontend/src/features/pos/layouts/PosWorkspaceLayout.tsx`: Shell Layout chứa Header, thanh Tab 5 màn hình, trạng thái ca, đồng hồ, nút chuyển về Quản trị và đăng xuất.
- `[CHỈNH SỬA]` `frontend/src/app/router/index.tsx`: Cấu hình route `/pos` bọc bởi `PosWorkspaceLayout`, đặt `/pos` mặc định mở `PosOrderPage`, bỏ các route thừa.
- `[CHỈNH SỬA]` `frontend/src/features/pos/pages/PosOrderPage.tsx`:
  - Thêm cụm chuyển đổi chế độ phục vụ linh hoạt trên giỏ hàng (Bàn, Thẻ số, STT, Tên khách, Bán nhanh).
  - Thêm ô giảm giá linh hoạt (VNĐ hoặc %).
  - Gỡ bỏ logic `customer-preview` và phụ thuộc `pickup`.
  - Tinh chỉnh màu sắc chuẩn KONEKT (`#FAF8F5`, `#2D3E2F`, `#364D39`).
- `[CHỈNH SỬA]` `frontend/src/features/pos/pages/PosHeldOrdersPage.tsx`: Chuyển sang đọc và thao tác dữ liệu đơn tạm lưu qua Drizzle ORM.
- `[CHỈNH SỬA]` `frontend/src/features/pos/pages/PosPaidOrdersPage.tsx`: Chuyển sang đọc lịch sử đơn từ `public.orders`, xem chi tiết và in lại hóa đơn kèm thông tin định danh (Bàn/Thẻ/STT).

---

## 3. CÁC BƯỚC TRIỂN KHAI TUẦN TỰ (STEP-BY-STEP)

### Bước 1: Mở rộng Schema Database & Chạy Migration Drizzle
1. Cập nhật `backend/src/db/schema.ts`:
   - Thêm các cột vào `orders`: `orderType`, `serviceMode`, `serviceIdentifier`, `queueNumber`, `customerName`, `customerPhone`, `discountReason`.
   - Thêm `posConfig` vào `stores`.
2. Tạo script `backend/src/scripts/migrate_plan13.ts` thực thi `ALTER TABLE` an toàn trên Supabase PostgreSQL (dùng `ADD COLUMN IF NOT EXISTS`).
3. Chạy `npx tsx src/scripts/migrate_plan13.ts` để áp dụng ngay lên Database.

### Bước 2: Clean Code Backend Toàn Bộ Bằng Drizzle ORM
1. Trong `posOrder.service.ts`:
   - `createPosOrder`: Xử lý tạo đơn hoàn tất, tự động sinh mã đơn, sinh `queueNumber` tăng dần theo ngày của store, lưu `serviceMode`, `serviceIdentifier`, lưu `order_items`, `payments`.
   - `holdPosOrder`: Lưu đơn tạm vào `public.orders` với `isHold = true`, `status = 'pending'`.
   - `listHeldOrders`: Truy vấn các đơn `isHold = true` của store hiện tại.
   - `deleteHeldOrder`: Hủy đơn tạm lưu.
   - `listPaidOrders`: Tìm kiếm đơn đã bán theo ngày, mã đơn, khách hàng, phương thức thanh toán.
   - `getOrderDetail`: Lấy chi tiết đơn kèm snapshot món và thanh toán để phục vụ in lại hóa đơn.
2. Trong `payments.repo.ts`:
   - Chuyển `insertPayment` sang `db.insert(payments)` của Drizzle ORM.
3. Trong `orders.routes.ts`:
   - Dọn sạch các handler cũ trỏ vào `orders.service.ts` cũ (176KB), chỉ route vào `posOrder.controller.ts`.

### Bước 3: Xây Dựng Shell Layout Web POS (`PosWorkspaceLayout.tsx`)
1. Tạo Header điều hướng cố định phía trên:
   - Bên trái: Logo KONEKT POS + Tên Cửa Hàng / Chi Nhánh.
   - Ở giữa: 5 Tabs điều hướng phẳng tinh tế:
     - ☕ Bán Hàng (`/pos`)
     - 📋 Đơn Đang Giữ (`/pos/held`)
     - 🧾 Lịch Sử Đơn (`/pos/orders`)
     - 🍳 Bếp KDS (`/pos/kds`)
     - 💰 Ca Bán Hàng (`/pos/shift`)
   - Bên phải: Đồng hồ, Tên Thu ngân, Nút `[🏢 Về Quản Trị]` (cho Owner), Nút `[Đăng Xuất]`.
2. Cập nhật `frontend/src/app/router/index.tsx`: Bọc các route `/pos` bằng layout mới, truy cập `/pos` vào thẳng Bán hàng.

### Bước 4: Tái Cấu Trúc Màn Hình Bán Hàng (`PosOrderPage.tsx`) & Giỏ Hàng Linh Hoạt
1. Gỡ bỏ màn hình snapshot khách tại quầy (`customer-preview`).
2. Tích hợp thanh chọn chế độ phục vụ ngay trên đầu giỏ hàng:
   - Tabs: `[Tại chỗ]` | `[Mang đi]`
   - Kiểu định danh: Dropdown / Pill buttons:
     * `Bàn`: Hiện ô nhập `[ Bàn 05 ]`
     * `Thẻ số`: Hiện ô nhập `[ Thẻ số 12 ]`
     * `Số thứ tự`: Tự động gán STT tiếp theo (ví dụ: `#008`)
     * `Tên khách`: Hiện ô nhập `[ Tên khách ]` và `[ SĐT ]`
     * `Bán nhanh`: Không cần nhập gì, tính tiền ngay
3. Tích hợp ô chiết khấu linh hoạt: Cho phép nhập giảm giá theo % hoặc số tiền trực tiếp.
4. Thanh toán: Tiền mặt tính tiền thừa mượt mà, VietQR sinh mã thanh toán hợp lệ.

### Bước 5: Hoàn Thiện Trang Đơn Giữ (`PosHeldOrdersPage.tsx`) & Lịch Sử Đơn (`PosPaidOrdersPage.tsx`)
1. Trang Đơn Giữ: Hiển thị danh sách các đơn tạm lưu, nút "Mở lại đơn" nạp lại vào giỏ hàng để thu tiền, nút "Hủy đơn lưu".
2. Trang Lịch Sử Đơn: Tra cứu các đơn đã bán, hiển thị rõ kiểu phục vụ (Bàn / Thẻ số / STT), xem chi tiết và in lại hóa đơn đẹp mắt chuẩn khổ in nhiệt 80mm.

### Bước 6: Kiểm Thử Toàn Diện (Verification)
1. `npx tsc --noEmit` đạt 0 lỗi trên cả Backend và Frontend.
2. Kiểm tra trên trình duyệt: Thử bán hàng với chế độ Bàn, Thẻ số, STT tự động, lưu đơn, thanh toán, in lại hóa đơn.

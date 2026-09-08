# KẾ HOẠCH HÀNH ĐỘNG: TÁI CẤU TRÚC PHÂN QUYỀN & THIẾT LẬP DATABASE/ORM (GIAI ĐOẠN 1)
**Mã kế hoạch**: `PLAN-01`  
**Liên kết Yêu cầu**: [REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md](../../Requirements/REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md)  
**Trạng thái**: `Ready for Review`  
**Ngày lập**: 08/09/2026  
**Quy chuẩn áp dụng**: [AI_RULES.md](../../AI%20Rules/AI_RULES.md) (Gồm: Taste Skill UI, Supabase Best Practices, Quy tắc ORM)

---

## 1. MỤC TIÊU CỦA ĐỢT THAY ĐỔI
1. **Khởi tạo ORM & Kiến trúc Schema mới trên Database Supabase**:
   - Cài đặt và cấu hình ORM (khuyên dùng Drizzle ORM - siêu nhẹ, type-safe, native SQL-like, hoàn hảo cho Supabase).
   - Thiết lập bảng `tenants` và bổ sung `tenant_id` vào các thực thể cốt lõi (`stores`, `users`, `products`, `orders`, `inventory_items`).
   - Chạy migration khởi tạo bảng đầu tiên lên Database mới.
2. **Tái cấu trúc Middleware Phân quyền Backend**:
   - Tinh gọn Role enum: `platform_admin`, `owner`, `store_manager`, `staff`, `customer`.
   - Cập nhật `roleGuard` & `portalGuard`: Cấp toàn quyền cho `owner` truy cập cả API Quản trị Back-office lẫn API Bán hàng POS (`/api/pos/*`).
3. **Cập nhật Giao diện Frontend (Owner-Centric Navigation)**:
   - Áp dụng `taste-skill` với bảng màu chuẩn: Xanh rêu đậm (`#364D39`) và Kem ngà (`#F4EFEB`).
   - Thiết kế thanh Menu Quản trị tập trung cho Owner.
   - Bổ sung nút chuyển đổi 1-chạm **[BÁN HÀNG TẠI QUẦY (MỞ POS)]** trên Header cho Owner chọn chi nhánh và vào thẳng màn hình bán hàng `/pos/order`.

---

## 2. DANH SÁCH TẬP TIN TÁC ĐỘNG

### Backend:
* `[TẠO MỚI]` `backend/src/db/schema.ts` (Định nghĩa Schema bảng `tenants`, `stores`, `users`, `products`,... qua ORM)
* `[TẠO MỚI]` `backend/drizzle.config.ts` (Cấu hình Drizzle ORM migration)
* `[CHỈNH SỬA]` `backend/package.json` (Thêm dependencies: `drizzle-orm`, `drizzle-kit`)
* `[CHỈNH SỬA]` `backend/src/middlewares/roleGuard.ts` (Hỗ trợ role `owner` là superuser trong tenant)
* `[CHỈNH SỬA]` `backend/src/middlewares/portalGuard.ts` (Mở quyền cho `owner` đi xuyên qua các portal)
* `[CHỈNH SỬA]` `backend/src/modules/orders/orders.routes.ts` (Cho phép `owner` thao tác các API bán hàng POS)

### Frontend:
* `[CHỈNH SỬA]` `frontend/src/index.css` (Cập nhật chuẩn hóa bộ biến màu CSS `--cafe-olive: #364d39;`, `--cafe-cream: #f4efeb;` theo ảnh mẫu)
* `[CHỈNH SỬA]` `frontend/src/app/store/auth.store.ts` (Bổ sung role `owner`, mở rộng logic `AuthUser`)
* `[CHỈNH SỬA]` `frontend/src/app/router/index.tsx` (Mở quyền route `/pos/*` cho role `owner`, tối ưu layout chuyển đổi)
* `[CHỈNH SỬA]` `frontend/src/shared/layouts/OfficeWorkspaceLayout.tsx` (Thêm nút chuyển nhanh sang POS trên Header và tinh gọn sidebar)

---

## 3. CÁC BƯỚC THỰC THI CHI TIẾT (STEP-BY-STEP)

### BƯỚC 1: Cấu hình ORM & Khởi tạo Schema Database mới
1. Cài đặt `drizzle-orm` và `drizzle-kit` trong `backend`.
2. Tạo file `backend/src/db/schema.ts` định nghĩa:
   * `tenants` (id, name, code, slug, status, created_at)
   * `stores` (id, tenant_id, name, address, phone, is_active)
   * `users` (id, tenant_id, username, email, password_hash, full_name, role, store_id)
   * `products` & `categories` (id, tenant_id, name, price, is_available)
   * `orders` & `order_items` (id, tenant_id, store_id, order_code, total_amount, status)
3. Chạy lệnh migrate khởi tạo các bảng lên Supabase Database mới.
4. Chạy script seed tài khoản mẫu `owner@cafe.dev` (Owner) và 1 chi nhánh Store #1.

### BƯỚC 2: Tái cấu trúc Backend Auth & Middleware
1. Cập nhật `ROLE_LEVEL` trong `roleGuard.ts`:
   * `customer`: 0
   * `staff`: 1
   * `store_manager`: 2
   * `owner`: 3 (Toàn quyền trong Tenant)
   * `platform_admin`: 4 (Toàn quyền SaaS)
2. Cập nhật `portalGuard`: Cho phép user có role `owner` được đi qua cả `STORE`, `OFFICE` và `POS`.
3. Cho phép route POS nhận `storeId` từ Header hoặc Query nếu người thực hiện là `owner`.

### BƯỚC 3: Cập nhật Frontend UI/Theme (Áp dụng Taste Skill)
1. Cập nhật CSS variables trong `frontend/src/index.css` với phổ màu xanh rêu đậm & kem ngà.
2. Thêm nút chuyển đổi nhanh trên Header:
   * Nếu user là `owner` ➔ Hiển thị nút **"Mở POS Bán Hàng"** (kèm dropdown chọn Store nếu có nhiều chi nhánh).
   * Tại màn hình POS ➔ Hiển thị nút **"Quay lại Trang Quản trị"**.
3. Cập nhật Router Guards: Không chặn `owner` khi truy cập `/pos/*`.

---

## 4. ĐÁNH GIÁ RỦI RO & PHƯƠNG ÁN DỰ PHÒNG (ROLLBACK)
* **Rủi ro**: Database mới đang trống dữ liệu, nếu các service cũ query vào các bảng chưa được tạo sẽ báo lỗi missing table.
* **Biện pháp**: Tạo đầy đủ các bảng cơ bản (`users`, `stores`, `products`, `orders`) trong schema mới và seed dữ liệu mẫu ban đầu để hệ thống chạy thông suốt.
* **Rollback**: Toàn bộ thay đổi diễn ra trên Database mới và các file cấu hình mới, không làm mất code gốc.

---

## 5. KẾ HOẠCH KIỂM THỬ (VERIFICATION)
1. **Kiểm tra Database**: Chạy script query kiểm tra các bảng đã được tạo thành công trên Supabase.
2. **Kiểm tra Đăng nhập & Phân quyền**: Đăng nhập tài khoản `owner` ➔ Kiểm tra JWT Token có mang `role: 'owner'` và `tenantId`.
3. **Kiểm tra Chuyển đổi POS**:
   * Tại Trang Quản trị, bấm nút "Mở POS Bán Hàng" ➔ Chuyển ngay sang `/pos/order`.
   * Thử tạo đơn hàng, chọn món, xuất mã VietQR, thanh toán tiền mặt ➔ Hoàn tất đơn hàng.
   * Bấm "Quay lại Trang Quản trị" ➔ Quay về Dashboard xem doanh thu vừa phát sinh.

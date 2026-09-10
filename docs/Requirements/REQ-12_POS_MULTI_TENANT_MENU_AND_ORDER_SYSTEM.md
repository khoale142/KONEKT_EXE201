# ĐẶC TẢ YÊU CẦU: HỆ THỐNG POS BÁN HÀNG VÀ TẠO ĐƠN MULTI-TENANT
**Mã định danh**: `REQ-12`  
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày lập**: 10/09/2026  
**Người yêu cầu**: Chủ quán  
**Người thực hiện**: Antigravity AI Agent  
**Trạng thái**: Chờ duyệt (Pending Approval)  

---

## 1. BỐI CẢNH & VẤN ĐỀ HIỆN TẠI (CONTEXT & PROBLEM STATEMENT)

### Vấn đề 1: Lỗi Bảng Database không tồn tại khi mở POS
- Khi mở màn hình POS (`/pos`), giao diện hiện thông báo lỗi đỏ:  
  *`"Lỗi cấu hình database: bảng không tồn tại. Vui lòng chạy migration."`*
- **Nguyên nhân cốt lõi**: Module ca làm việc cũ (`shiftReconciliation.repo.ts`) vẫn đang dùng query raw SQL truy vấn schema cũ `coffee_chain_db.pos_shift_reconciliations`. Trên Database Supabase mới, toàn bộ schema đã được chuyển sang `public.*` với Drizzle ORM (`public.shift_sessions`). Việc query vào `coffee_chain_db` gây lỗi Postgres `42P01: undefined_table`, làm toàn bộ lời gọi `Promise.all([posGetMenu(), getCurrentShiftReconciliation()])` bị hủy, khiến POS không hiển thị được thực đơn.

### Vấn đề 2: Chỉnh sửa món ở Quản trị không đồng bộ qua POS
- Món ăn được tạo và chỉnh sửa từ trang Quản trị (`/office/menu`) lưu vào bảng `public.products`, `public.product_variants`, `public.product_categories`.
- Tuy nhiên API `/api/pos/menu`:
  - Chưa lọc chính xác `scope = 'product'` của danh mục (dẫn đến lấy nhầm danh mục nguyên liệu `raw_material` rỗng).
  - Bỏ sót các món chưa có danh mục (`categoryId = null`).
  - Dữ liệu trả về chưa tối ưu theo cấu trúc phân loại mà POS cần để hiển thị danh mục và biến thể size.

### Vấn đề 3: Tạo Order từ POS không thành công
- Lệnh tạo đơn `POST /api/pos/orders` đi vào file `orders.service.ts` (176KB) chứa mã nguồn cũ truy vấn hàng chục bảng `coffee_chain_db.orders`, `coffee_chain_db.order_details`, `coffee_chain_db.product_variants`.
- Vì các bảng này không tồn tại trên Supabase, lệnh tạo đơn lập tức bị crash.
- Hệ thống cần một luồng tạo đơn POS tinh gọn, độc lập và chuẩn Drizzle ORM trên các bảng `public.orders`, `public.order_items`, `public.payments`.

### Vấn đề 4: Cách ly Đơn hàng & Menu theo từng Tenant (Row-Level Tenancy)
- Theo đúng nguyên tắc `AI_RULES.md`: Mỗi Tenant là một thương hiệu/quán riêng biệt.
- Menu POS của Quán A chỉ hiển thị món của Quán A (`tenant_id = A`).
- Đơn hàng tạo ra phải gắn chặt với `tenant_id` và `store_id` của quán đó.
- Quán B hoàn toàn không nhìn thấy hoặc can thiệp vào đơn hàng của Quán A.

---

## 2. MỤC TIÊU (OBJECTIVES)

1. **Khắc phục 100% lỗi không mở được POS**: Chuyển đổi kiểm tra ca làm việc sang bảng `public.shift_sessions` chuẩn Drizzle ORM, không còn bất kỳ lỗi `undefined_table` nào.
2. **Đồng bộ Thực đơn Tức thời**: Mọi thay đổi về món ăn, giá bán, biến thể size, danh mục từ trang Quản trị Back-office lập tức hiển thị đầy đủ và chính xác trên màn hình POS bán hàng.
3. **Tạo Đơn Hàng Thành Công**: Xây dựng luồng tạo đơn POS (`posCreateOrder`) trực tiếp trên các bảng `public.orders`, `public.order_items`, `public.payments`, ghi nhận đầy đủ chi tiết món, size, số lượng, phương thức thanh toán (Tiền mặt / VietQR / Thẻ).
4. **Cách Ly Tuyệt Đối Theo Tenant (Multi-Tenant POS)**: Tự động inject `tenant_id` và `store_id` vào mọi truy vấn đọc Menu và tạo Order từ context xác thực của người dùng.

---

## 3. PHẠM VI (SCOPE)

### Trong phạm vi (In-Scope):
- **Backend**:
  - Tái cấu trúc API `/api/pos/menu`: Lấy đúng danh mục `scope = 'product'`, gom món chưa có danh mục vào nhóm mặc định, map đầy đủ biến thể size và giá bán.
  - Xây dựng Service xử lý Đơn hàng POS (`posOrder.service.ts`) trên nền Drizzle ORM:
    - Tạo đơn hàng (`orders`): mã đơn duy nhất, tổng tiền, chiết khấu, trạng thái.
    - Lưu chi tiết món (`order_items`): snapshot tên món, size, đơn giá, số lượng, thành tiền, ghi chú.
    - Lưu thanh toán (`payments`): tiền mặt (tính tiền thừa), VietQR, thẻ.
  - Tái cấu trúc API ca bán hàng `/api/pos/shift-reconciliations`: Chạy trên `public.shift_sessions`, cho phép tự động kích hoạt ca bán hàng khi Owner mở POS để không bị chặn tạo đơn.
- **Frontend**:
  - Đảm bảo `PosOrderPage.tsx` tải menu mượt mà, hiển thị danh mục và món ăn với ảnh đại diện và size giá chính xác.
  - Cho phép thêm món vào giỏ, chọn size, bấm thanh toán và hoàn tất đơn hàng thành công, in hóa đơn / hiển thị mã đơn.
- **Multi-Tenant**:
  - Kiểm thử chuyển đổi giữa các Tenant khác nhau (ví dụ: `KONEKT Coffee` vs `The Coffee Lounge`) để xác nhận tính độc lập 100% của Menu và Đơn hàng.

### Ngoài phạm vi (Out-of-Scope):
- Không thay đổi nghiệp vụ chuyên sâu của KDS bếp hoặc Chatbot AI ở giai đoạn này.
- Giữ nguyên các chức năng quản trị Back-office đã hoàn thiện ở các đợt trước.

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA - AC)

- [ ] **AC-1 (Menu Đồng bộ)**: Thêm mới hoặc chỉnh sửa món/giá ở Back-office, mở POS thấy ngay món đó ở đúng danh mục với đúng tên, giá và size.
- [ ] **AC-2 (Hết lỗi Database)**: Mở `/pos` không còn xuất hiện thông báo đỏ *"Lỗi cấu hình database: bảng không tồn tại"*.
- [ ] **AC-3 (Tạo đơn Tiền mặt)**: Chọn món, chọn size, bấm thanh toán Tiền mặt $\rightarrow$ Tạo đơn thành công $\rightarrow$ Đơn lưu vào DB với `tenant_id` và `store_id` chính xác.
- [ ] **AC-4 (Tạo đơn VietQR/Chuyển khoản)**: Chọn thanh toán VietQR / Chuyển khoản $\rightarrow$ Hệ thống tạo đơn và bản ghi thanh toán tương ứng.
- [ ] **AC-5 (Cô lập Tenant)**: Đơn hàng tạo ở Tenant 1 chỉ xuất hiện trong báo cáo/danh sách của Tenant 1, không rò rỉ sang Tenant 2.
- [ ] **AC-6 (Type Safety & Logs)**: `npx tsc --noEmit` đạt 0 lỗi trên cả backend và frontend; ghi nhật ký `[LOG-034]` đầy đủ.

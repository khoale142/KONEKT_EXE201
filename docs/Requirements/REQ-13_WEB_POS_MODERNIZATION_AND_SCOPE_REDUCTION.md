# ĐẶC TẢ YÊU CẦU: HIỆN ĐẠI HÓA WEB POS ĐA NGÀNH, LINH HOẠT ĐỊNH DANH PHỤC VỤ & CLEAN CODE ORM
**Mã định danh**: `REQ-13`  
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày lập**: 10/09/2026 (Cập nhật đợt 2 theo chỉ đạo Chủ quán)  
**Người yêu cầu**: Chủ quán  
**Người thực hiện**: Antigravity AI Agent  
**Trạng thái**: Chờ duyệt (Pending Approval)  

---

## 1. BỐI CẢNH & TƯ DUY NỀN TẢNG (CONTEXT & STRATEGY)

### A. Chuyển Đổi Sang Web POS Đa Ngành:
- Nền tảng KONEKT phục vụ đa dạng mô hình kinh doanh: F&B ngồi bàn, F&B mang đi (Takeaway), Quán trà sữa/Fast food, Cửa hàng bán lẻ (Thời trang, Tạp hóa, Tiệm bánh), Dịch vụ & Spa.
- **Không còn gò bó vào phần cứng máy POS 2 màn hình cảm ứng cũ**.
- Hoạt động mượt mà trên mọi thiết bị: Laptop, Máy tính để bàn, iPad/Tablet với trình duyệt web.

### B. Loại Bỏ Thẻ Rung Phần Cứng $\rightarrow$ Cấu Hình Định Danh Phục Vụ Linh Hoạt:
- Thẻ rung điện tử (buzzer/pager) trước đây đòi hỏi thiết bị truyền phát transmitter phần cứng bên ngoài phức tạp và không phù hợp với hầu hết các quán vừa và nhỏ.
- Chuyển sang **Cơ chế Định Danh Phục Vụ Đa Ngành (Flexible Serving Identifiers)**:
  1. **Theo Số bàn (`table`)**: Phù hợp Quán cafe, nhà hàng, quán ăn ngồi tại chỗ.
  2. **Theo Thẻ số để bàn (`table_marker`)**: Thẻ mica/nhựa số 1, 2, 3... nhân viên mang món ra bàn theo số thẻ.
  3. **Theo Số thứ tự lấy món (`queue_number`)**: Số thứ tự tự động tăng theo ngày/ca (ví dụ: `Số #001`, `Số #015` in to rõ trên bill, gọi loa / bảng LED).
  4. **Theo Tên & SĐT khách hàng (`customer_name`)**: Phù hợp tiệm bánh, tiệm trà takeaway, spa, cửa hàng dịch vụ.
  5. **Bán nhanh tại quầy (`none`)**: Cửa hàng bán lẻ, tạp hóa, phụ kiện, khách thanh toán lấy đồ ngay.
- Cho phép Cửa hàng cấu hình chế độ mặc định, và Thu ngân có thể chuyển đổi nhanh tức thì bằng 1 cú click ngay trên đầu giỏ hàng POS.

### C. Clean Code 100% Theo Drizzle ORM:
- Trước đây hệ thống dùng SQL Driver thuần (`pool.query`) với các câu truy vấn raw string chắp vá vào schema cũ `coffee_chain_db.*`.
- Yêu cầu bắt buộc: **Tái cấu trúc và Clean Code toàn bộ phân hệ POS bằng Drizzle ORM**:
  - Mở rộng Schema bảng `orders`, `order_items`, `payments`, `stores` trong `backend/src/db/schema.ts`.
  - Toàn bộ backend service viết bằng Drizzle Type-safe queries (`db.select()`, `db.insert()`, `db.update()`, `db.transaction()`).
  - Triệt tiêu 100% các câu raw SQL cũ, không còn bất kỳ lỗi bảng không tồn tại nào.

---

## 2. PHẠM VI NGHIỆP VỤ (SCOPE SPECIFICATION)

### A. TẠM BỎ / LOẠI BỎ KHỎI PHẠM VI (OUT-OF-SCOPE):
1. ❌ **Màn hình phụ cho khách tại quầy (`/pos/customer-preview`)**: Đã bỏ.
2. ❌ **Xác nhận đơn online nội bộ cũ (`/pos/online-orders`)**: Tạm bỏ (để dành làm Merchant API GrabFood/ShopeeFood chuẩn sau).
3. ❌ **Phản ánh đơn hàng (`/pos/issues`)**: Tạm bỏ (thuộc CSKH Back-office).
4. ❌ **Màn hình Dashboard 10 thẻ to cồng kềnh (`PosDashboardPage.tsx`)**: Xóa bỏ vai trò là trang chủ.
5. ❌ **Bước chặn chọn thẻ rung 1-24 bắt buộc (`PosPickupSelectPage.tsx`)**: Xóa bỏ việc ép buộc.

### B. CÁC TÍNH NĂNG CỐT LÕI GIỮ LẠI & HOÀN THIỆN (IN-SCOPE):
1. ☕ **Màn Hình Bán Hàng & Thu Ngân Hiện Đại (`/pos`)**:
   - Màn hình mặc định khi vào POS.
   - Thanh Menu điều hướng xuyên suốt (Web POS App Shell).
   - Danh mục món ăn linh hoạt kèm ảnh ẩm thực, phân loại size S/M/L, ghi chú từng món.
   - Giỏ hàng bên phải:
     - Cụm chuyển đổi chế độ phục vụ nhanh: `[Tại chỗ / Mang đi]` kèm `[Số bàn | Thẻ số | Số thứ tự | Tên khách | Bán nhanh]`.
     - Tính toán tiền hàng, chiết khấu / giảm giá thủ công linh hoạt (% hoặc số tiền).
     - Thanh toán: **Tiền mặt** (tính tiền thừa), **VietQR động** (sinh mã QR thanh toán chuẩn Drizzle ORM).
     - Nút "Lưu đơn" (Hold order) tạm hoãn đơn hàng.
2. 📋 **Đơn Đang Giữ (Held Orders) (`/pos/held`)**:
   - Danh sách đơn tạm lưu kèm mã đơn, thời gian, số bàn/thẻ số/tên khách, tổng tiền.
   - Nút "Mở lại đơn" nạp lại giỏ hàng để thu tiền, nút "Hủy đơn lưu".
3. 🧾 **Lịch Sử Đơn Hàng & In Hóa Đơn (`/pos/orders`)**:
   - Tra cứu đơn đã bán trong ca/ngày từ `public.orders`.
   - Xem chi tiết snapshot từng món, size, topping, phương thức thanh toán.
   - Nút "In lại hóa đơn" (Reprint receipt) sạch đẹp chuẩn in nhiệt 80mm / 58mm.
4. 🍳 **Màn Hình Bếp / Pha Chế (KDS View) (`/pos/kds`)**:
   - Pha chế và cập nhật trạng thái món thời gian thực.
5. 💰 **Ca Bán Hàng & Kiểm Quỹ (Shift Management) (`/pos/shift`)**:
   - Xem số liệu ca: Tiền đầu ca, Doanh thu ca, Số đơn, chốt ca và bàn giao két tiền.

---

## 3. CƠ SỞ DỮ LIỆU & SCHEMA DRIZZLE ORM

### Bổ sung vào `backend/src/db/schema.ts`:
1. **Bảng `orders`**:
   - `orderType`: `varchar('order_type', { length: 30 }).default('dine_in')` (`dine_in`, `take_away`, `quick_counter`, `delivery`)
   - `serviceMode`: `varchar('service_mode', { length: 50 }).default('none')` (`table`, `table_marker`, `queue_number`, `customer_name`, `none`)
   - `serviceIdentifier`: `varchar('service_identifier', { length: 100 })` (Ví dụ: "Bàn 04", "Thẻ số 12", "Chị Thảo")
   - `queueNumber`: `integer('queue_number')` (Số thứ tự tự tăng trong ngày của ca/store, in to trên hóa đơn: "STT: #012")
   - `customerName`: `varchar('customer_name', { length: 150 })`
   - `customerPhone`: `varchar('customer_phone', { length: 50 })`
   - `discountReason`: `varchar('discount_reason', { length: 255 })`
2. **Bảng `stores`**:
   - `posConfig`: `jsonb('pos_config')` lưu cấu hình mặc định của quán (chế độ phục vụ mặc định, các chế độ được bật, cấu hình in bill header/footer).
3. **Bảng `payments`**:
   - Đảm bảo lưu đầy đủ `orderId`, `method`, `status`, `amount`, `receivedAmount`, `changeAmount`, `transactionRef`, `qrCodeUrl`.

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA - AC)

- [ ] **AC-1 (Schema & Migration Drizzle)**: Mở rộng `schema.ts`, chạy migration thành công trên Supabase DB mà không làm mất dữ liệu hiện có.
- [ ] **AC-2 (Clean Code ORM)**: Loại bỏ triệt để mọi truy vấn SQL thô `coffee_chain_db.*` trong phân hệ POS; 100% code chuyển sang Drizzle ORM.
- [ ] **AC-3 (Định Danh Phục Vụ Đa Ngành)**: POS cho phép chuyển đổi và nhập: Số bàn, Thẻ để bàn, STT tự động, Tên khách, hoặc Bán nhanh.
- [ ] **AC-4 (Thanh Navigation App Shell)**: Truy cập `/pos` hiển thị thanh menu hiện đại, chuyển đổi mượt mà 5 màn hình cốt lõi.
- [ ] **AC-5 (Thanh Toán & In Bill)**: Thanh toán Tiền mặt & VietQR hoạt động ổn định; in bill hiển thị đúng thông tin định danh (Bàn/Thẻ/STT).
- [ ] **AC-6 (Type Safety)**: `npx tsc --noEmit` đạt 0 lỗi trên cả backend và frontend.

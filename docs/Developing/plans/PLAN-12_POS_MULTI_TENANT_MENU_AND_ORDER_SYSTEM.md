# KẾ HOẠCH HÀNH ĐỘNG: XÂY DỰNG HỆ THỐNG POS BÁN HÀNG VÀ TẠO ĐƠN MULTI-TENANT
**Mã định danh**: `PLAN-12`  
**Liên kết yêu cầu**: `docs/Requirements/REQ-12_POS_MULTI_TENANT_MENU_AND_ORDER_SYSTEM.md`  
**Ngày lập**: 10/09/2026  
**Người lập**: Antigravity AI Agent  
**Trạng thái**: Đã hoàn thành (Completed)  

---

## 1. MỤC TIÊU CỤ THỂ
Xây dựng lại tầng xử lý Menu POS và Tạo đơn POS trên nền **Drizzle ORM** kết nối trực tiếp các bảng `public.*` trên Supabase:
1. Triệt tiêu hoàn toàn các lỗi truy vấn tới schema cũ `coffee_chain_db.*` gây crash giao diện POS.
2. Đảm bảo toàn bộ sản phẩm và danh mục được tạo/sửa ở Back-office xuất hiện 100% trên POS.
3. Cho phép tạo đơn hàng bán lẻ thành công, lưu trữ chi tiết từng món (`order_items`) và thanh toán (`payments`).
4. Cô lập dữ liệu triệt để theo từng Tenant (`tenant_id`) và Store (`store_id`).

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### Backend:
- `[TẠO MỚI]` `backend/src/modules/pos-orders/posOrder.service.ts`: Service tạo đơn hàng POS chuẩn Drizzle ORM, tính tổng tiền, lưu `orders`, `order_items`, `payments`, trừ kho nguyên liệu (nếu có recipe).
- `[TẠO MỚI]` `backend/src/modules/pos-orders/posOrder.controller.ts`: Controller nhận request tạo đơn POS, validate dữ liệu, tự động lấy `tenantId` và `storeId` từ auth context.
- `[CHỈNH SỬA]` `backend/src/modules/orders/orders.routes.ts`: Định tuyến lại endpoint `POST /pos/orders` và `GET /pos/orders` sang service Drizzle mới.
- `[CHỈNH SỬA]` `backend/src/modules/menu/menu.service.ts`: Cải tiến `getPosMenu` lọc danh mục `scope: 'product'`, gom món chưa có danh mục vào nhóm mặc định, đảm bảo không sót món nào.
- `[CHỈNH SỬA]` `backend/src/modules/shift-reconciliation/shiftReconciliation.service.ts` & `.repo.ts`: Chuyển đổi kiểm tra ca bán hàng sang bảng `public.shift_sessions` (Drizzle ORM), tự động kích hoạt ca bán hàng mặc định nếu chưa mở ca để người dùng có thể tạo đơn ngay.

### Frontend:
- `[CHỈNH SỬA]` `frontend/src/features/pos/pages/PosOrderPage.tsx`: Căn chỉnh luồng nhận menu, hiển thị danh mục động, xử lý chọn size mặc định, hoàn tất đơn hàng và thông báo thành công.

---

## 3. CÁC BƯỚC THỰC HIỆN TUẦN TỰ (STEP-BY-STEP)

### Bước 1: Khắc phục Ca Bán Hàng (`shift_sessions`)
- Thay thế các câu lệnh raw SQL `coffee_chain_db.pos_shift_reconciliations` trong module `shift-reconciliation` bằng truy vấn Drizzle ORM trên bảng `public.shift_sessions`.
- Nếu chưa có ca mở cho `store_id` hiện tại, tự động tạo một phiên ca mở (`status: 'open'`, `opening_cash: 0`) cho ca làm việc của cửa hàng để màn hình POS sẵn sàng tạo đơn mà không bị chặn bởi thông báo lỗi đỏ.

### Bước 2: Chuẩn hóa API Lấy Thực đơn POS (`/api/pos/menu`)
- Truy vấn `productCategories` theo `tenantId`, `scope = 'product'`, `isActive = true`.
- Truy vấn toàn bộ `products` của tenant (`isAvailable = true`) kèm danh sách `productVariants`.
- Gom nhóm sản phẩm vào danh mục tương ứng. Với sản phẩm không có danh mục (`categoryId = null`), tự động gom vào nhóm "Thực đơn chung / Món khác".
- Trả về cấu trúc JSON chuẩn:
  ```json
  {
    "categories": [
      {
        "key": "cat_id",
        "name": "Tên danh mục",
        "products": [
          {
            "id": 1,
            "name": "Cà phê sữa đá",
            "imageUrl": "...",
            "variants": [
              { "id": 101, "size": "Size S", "price": 29000 },
              { "id": 102, "size": "Size M", "price": 35000 }
            ]
          }
        ]
      }
    ],
    "combos": []
  }
  ```

### Bước 3: Xây dựng Service Tạo Đơn Hàng POS Mới (`posOrder.service.ts`)
- Tiếp nhận payload từ POS:
  - `items`: danh sách món được chọn (gồm `productId`, `variantId`, `productName`, `variantName`, `unitPrice`, `quantity`, `notes`).
  - `payment`: `{ method: 'cash' | 'vietqr' | 'card', amount: number, receivedAmount?: number, changeAmount?: number }`.
  - `notes`: ghi chú đơn hàng.
  - `orderType`: `'dine_in'` | `'take_away'`.
- Thực thi trong Database Transaction (`db.transaction`):
  1. Sinh mã đơn hàng: `ORD-{tenantCode}-{YYMMDD}-{sequentialNumber}` (ví dụ: `ORD-KONEKT-260910-001`).
  2. Tạo bản ghi trong `public.orders`:
     `tenantId`, `storeId`, `cashierId`, `orderCode`, `status: 'completed'`, `subtotalAmount`, `discountAmount`, `totalAmount`, `notes`.
  3. Tạo danh sách bản ghi trong `public.order_items`:
     Ghi nhận chi tiết snapshot tên món, size, số lượng, đơn giá, thành tiền.
  4. Tạo bản ghi trong `public.payments`:
     Ghi nhận phương thức thanh toán, số tiền khách đưa, tiền thừa trả khách.
  5. Cập nhật doanh số và số đơn hàng cho ca làm việc hiện tại (`public.shift_sessions`).

### Bước 4: Kiểm thử Độc lập & Tích hợp (Testing & Verification)
1. Chạy `npx tsc --noEmit` trên cả `backend` và `frontend`.
2. Mở trình duyệt trên màn hình POS (`/pos`):
   - Xác nhận không còn thông báo lỗi đỏ.
   - Xác nhận các món vừa tạo/sửa ở Back-office xuất hiện đầy đủ trong các tab danh mục.
   - Thử thêm món vào giỏ hàng, chọn size S/M/L, kiểm tra tính toán tổng tiền.
   - Thử thanh toán Tiền mặt $\rightarrow$ Đơn hàng tạo thành công $\rightarrow$ Kiểm tra Database thấy đơn hàng mới với `tenant_id` chuẩn xác.
3. Chuyển đổi sang Tenant khác $\rightarrow$ Xác nhận POS của Tenant khác chỉ hiển thị menu riêng của Tenant đó.

---

## 4. ĐÁNH GIÁ RỦI RO & GIẢI PHÁP
- **Rủi ro**: Module `orders.service.ts` cũ rất lớn (176KB). Nếu sửa trực tiếp vào file đó có thể ảnh hưởng đến các hàm thống kê cũ.
- **Giải pháp**: Xây dựng module POS Order chuyên biệt và hiện đại (`posOrder.service.ts`) sử dụng Drizzle ORM, chỉ route các endpoint POS bán lẻ sang service mới. Các chức năng báo cáo cũ được bảo toàn mà không bị gián đoạn.

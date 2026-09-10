# KẾ HOẠCH HÀNH ĐỘNG: TINH GỌN THẺ SẢN PHẨM, BỔ SUNG HÌNH ẢNH VÀ HIỂN THỊ % GIÁ VỐN (COST %)
**Mã kế hoạch**: `PLAN-08`  
**Dựa trên yêu cầu**: `REQ-08`  
**Ngày lập**: 09/09/2026  
**Trạng thái**: Chờ Chủ quán phê duyệt (Pending Owner Approval)

---

## 1. MỤC TIÊU KỸ THUẬT
1. Tinh gọn thẻ sản phẩm ở chế độ Grid: Bỏ danh sách size, bỏ giá vốn VNĐ và biên lợi nhuận thô; bổ sung khung hình ảnh sản phẩm chất lượng cao; bổ sung chỉ số % Giá vốn (% Cost).
2. Tinh gọn bảng dữ liệu ở chế độ Table: Thêm thumbnail ảnh, bỏ cột size, bỏ cột giá vốn VNĐ và margin %; thay bằng cột % Giá vốn (% Cost) căn lề phải `tabular-nums`.
3. Toàn bộ thông tin chi tiết (kích cỡ, phụ thu, giá vốn VNĐ, biên lợi nhuận %, bảng định lượng nguyên liệu BOM) được tập trung trọn vẹn trong Popup Modal chi tiết khi click vào thẻ hoặc dòng.
4. Cập nhật dữ liệu ảnh đại diện đồ uống/món ăn thực tế cho 10 sản phẩm mẫu hiện có trên CSDL.

---

## 2. CÁC THAY ĐỔI CHI TIẾT THEO TỪNG THÀNH PHẦN

### Giai đoạn 1: Bổ sung thuộc tính tính toán % Giá vốn (Cost %)
- **Tại `frontend/src/features/owner-menu/pages/OwnerProductsPage.tsx`**:
  - Viết hàm trợ giúp tính % Cost:
    ```typescript
    function calculateCostPercent(basePrice: number, estimatedCostPrice: number): number | null {
      if (!basePrice || basePrice <= 0 || !estimatedCostPrice || estimatedCostPrice <= 0) return null;
      return Math.round((estimatedCostPrice / basePrice) * 100);
    }
    ```
  - Định nghĩa màu sắc trực quan cho nhãn % Cost:
    - `costPercent <= 30`: Nền `#EBF4ED`, chữ `#235E2D` (Tối ưu)
    - `costPercent <= 35`: Nền `#FEF3C7`, chữ `#92400E` (Tiêu chuẩn)
    - `costPercent > 35`: Nền `#FEE2E2`, chữ `#B91C1C` (Cao)
    - `null`: Nền `#F3F4F6`, chữ `#9CA3AF` (Chưa có BOM)

### Giai đoạn 2: Tinh gọn Card Grid (`OwnerProductsPage.tsx`)
- Thêm phần tử hình ảnh phía trên thẻ:
  - Chiều cao $135\text{px}$, bo tròn 2 góc trên (`borderTopLeftRadius: 13`, `borderTopRightRadius: 13`), `objectFit: "cover"`.
  - Fallback thông minh: Nếu sản phẩm chưa có URL ảnh, hiển thị ảnh mẫu thức uống cafe/trà thanh lịch hoặc background tone `#2D3E2F` với logo KONEKT tinh tế.
  - Vị trí huy hiệu trạng thái: Đặt nổi trên góc phải ảnh với nền kính mờ (`backdropFilter: blur(4px)`), text `Đang bán` / `Tạm ngưng`.
- Phần thân thẻ:
  - Tên món (Font 15px, đậm 800) + Phân cấp danh mục (`Cha › Con`).
  - Dòng chỉ số tài chính tinh gọn:
    - Cột trái: Giá bán cơ bản to rõ (ví dụ: `29.000 đ`).
    - Cột phải: Badge `% Cost` (ví dụ: `34% Cost`).
- Bỏ hoàn toàn khối kích cỡ (Size S, Size M, Size L) ở ngoài thẻ.
- Bỏ các số liệu `Food cost: 9.715 đ` và `Margin: 67%` ở ngoài thẻ.
- Chân thẻ: Nút Sửa, Xóa và xem chi tiết (khi click thẻ cũng tự động mở popup).

### Giai đoạn 3: Tinh gọn Table Row (`OwnerProductsPage.tsx`)
- Cột 1: Món & Hình ảnh (Thumbnail $42 \times 42\text{px}$ bo góc $8\text{px}$ + Tên món + Danh mục).
- Cột 2: Giá cơ bản (`text-right`, `tabular-nums`).
- Cột 3: % Giá vốn (`text-right`, `tabular-nums`, badge màu theo tỷ lệ).
- Cột 4: Trạng thái (`text-center`).
- Cột 5: Thao tác (Xem chi tiết, Sửa, Xóa).
- Bỏ cột kích cỡ và bỏ 2 cột số liệu tài chính thừa.

### Giai đoạn 4: Cập nhật Popup Chi tiết Món (`ProductDetailModal.tsx`)
- Thêm ảnh lớn của món ở đầu modal hoặc góc thông tin.
- Hiển thị đầy đủ bộ chỉ số: Giá bán cơ bản, Giá vốn Food Cost (số tiền chính xác VNĐ), % Cost, và Biên lợi nhuận Margin %.
- Giữ nguyên khối hiển thị kích cỡ kèm phụ thu và bảng BOM định lượng nguyên vật liệu.

### Giai đoạn 5: Cập nhật CSDL Dữ liệu Ảnh Món Mẫu
- Viết script cập nhật hình ảnh ẩm thực chất lượng cao (Unsplash F&B photos) cho 10 sản phẩm mẫu hiện có trên Supabase:
  - Bạc sỉu, Cà phê sữa đá, Americano, Latte, Cappuccino, Trà đào cam sả, Trà sữa trân châu, Trà vải, Nước ép cam, Sinh tố bơ.

---

## 3. KẾ HOẠCH KIỂM THỬ (VERIFICATION PLAN)
1. **Kiểm tra TypeScript**: `npx tsc --noEmit` trên cả `backend/` và `frontend/` phải đạt Exit code 0.
2. **Kiểm tra Trực quan**:
   - Xác nhận thẻ Card đã gọn gàng, có ảnh đẹp, giá bán to rõ, có badge % Cost.
   - Xác nhận không còn xuất hiện các nút size S/M/L gây rối mắt ở mặt ngoài.
   - Xác nhận click vào thẻ mở Popup Modal chi tiết hiển thị đầy đủ size, giá vốn tiền tệ, margin và bảng BOM.
   - Xác nhận chế độ Bảng dòng hiển thị thumbnail ảnh và cột % Giá vốn canh phải chuẩn xác.
3. **Ghi nhận Changelog**: Cập nhật `[LOG-026]` vào `DEV_CHANGELOG.md`.

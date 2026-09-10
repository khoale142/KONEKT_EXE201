# ĐẶC TẢ YÊU CẦU: TINH GỌN THẺ SẢN PHẨM, BỔ SUNG HÌNH ẢNH MÓN VÀ HIỂN THỊ % GIÁ VỐN (COST %)
**Mã tài liệu**: `REQ-08`  
**Ngày ban hành**: 09/09/2026  
**Người yêu cầu**: Chủ quán (Owner)  
**Trạng thái**: Đã phê duyệt yêu cầu ➔ Chờ duyệt Kế hoạch (`PLAN-08`)

---

## 1. BỐI CẢNH & PHẢN HỒI THỰC TẾ TỪ CHỦ QUÁN
Sau khi đối soát giao diện Menu Hub tại màn hình Sản phẩm / Món bán (`/office/menu?tab=products`), Chủ quán nhận thấy:
1. **Thẻ sản phẩm (Card) hiện tại đang nhồi nhét quá nhiều chi tiết**:
   - Đang hiển thị trực tiếp danh sách các size (Size S, Size M, Size L) làm thẻ bị cồng kềnh.
   - Đang hiển thị cả số tiền giá vốn (`Food Cost: 9.715 đ`) và biên lợi nhuận thô (`Margin: 67%`).
2. **Mong muốn tinh gọn thông tin mặt ngoài thẻ**:
   - **Bỏ phần size** trên thẻ; khi nào click vào thẻ mới xem chi tiết các size trong popup modal. Tương tự đối với chế độ danh sách (Table / List view).
   - **Bỏ số tiền cost thô** và **bỏ biên lợi nhuận** ở mặt ngoài, đưa vào popup modal chi tiết.
   - **Tính phần trăm giá cost (% Cost = Food Cost Ratio)** và đưa trực tiếp vào thẻ để Chủ quán nắm ngay tỷ lệ chi phí vốn trên doanh thu của từng món.
   - **Thêm hình ảnh cho món**: Thẻ cần có hình ảnh món trực quan, đẹp mắt để nhận diện đồ uống/món ăn nhanh chóng.
   - **Thông tin cốt lõi mặt ngoài thẻ chỉ gồm**:
     - Hình ảnh món ăn/thức uống.
     - Tên món + Danh mục phân cấp.
     - Giá bán cơ bản.
     - % Giá vốn (% Cost).
     - Trạng thái bán hàng (`Đang bán` / `Tạm ngưng`).
     - Các nút thao tác cơ bản: Sửa (Edit), Xóa (Delete) + Bấm thẻ để xem popup chi tiết.

---

## 2. CÔNG THỨC & NGUYÊN TẮC QUẢN TRỊ % GIÁ VỐN (% COST)

### 2.1. Công thức tính % Cost (Food Cost Ratio)
Trong ngành F&B, tỷ lệ % Giá vốn (Food Cost Percentage) là chỉ số vàng phản ánh hiệu quả định giá và chi phí nguyên vật liệu:
$$\text{Cost \%} = \frac{\text{Giá vốn định mức (Estimated Cost Price)}}{\text{Giá bán cơ bản (Base Price)}} \times 100$$

*Ví dụ thực tế:*
- Món *Bạc sỉu*: Giá bán $29.000$ đ, Giá vốn BOM $9.715$ đ $\rightarrow$ $\text{Cost \%} = \frac{9.715}{29.000} \times 100 \approx 33.5\%$ (hoặc làm tròn $34\%$).
- Món *Trà đào cam sả*: Giá bán $39.000$ đ, Giá vốn BOM $3.225$ đ $\rightarrow$ $\text{Cost \%} = \frac{3.225}{39.000} \times 100 \approx 8.3\%$ (hoặc làm tròn $8\%$).
- Món chưa khai báo công thức BOM $\rightarrow$ Hiển thị `--%` hoặc `Chưa có BOM`.

### 2.2. Phân cấp màu sắc trực quan theo chuẩn F&B
- $\le 30\%$: Xanh rêu `#2D3E2F` (Chi phí vốn lý tưởng, biên độ an toàn cao).
- $31\% - 35\%$: Nâu hổ phách `#92400E` (Mức tiêu chuẩn thông thường).
- $> 35\%$: Đỏ gạch `#B91C1C` (Cảnh báo chi phí vốn cao, cần tối ưu định lượng hoặc giá bán).

---

## 3. ĐẶC TẢ CHI TIẾT GIAO DIỆN

### 3.1. Chế độ Thẻ (Card / Bento Grid)
- **Kích thước thẻ**: Cân đối, hiện đại, tỉ lệ vàng với card trắng `#FFFFFF`, viền `#E8E3DA`, đổ bóng nhẹ khi hover.
- **Khu vực Hình ảnh (Image Header)**:
  - Chiều cao $\approx 135\text{px}$, bo góc trên, `object-fit: cover`.
  - Nếu món chưa có ảnh: hiển thị ảnh placeholder đồ uống tối giản sang trọng theo phong cách `#3D503C`.
  - Trên ảnh hoặc góc ảnh gắn tag trạng thái tinh tế (`Đang bán` / `Tạm ngưng`).
- **Khu vực Thông tin (Body)**:
  - Tên món: In đậm, cỡ $15\text{px}$, màu `#1E261F`.
  - Danh mục: Badge nhỏ màu xám kem `#F2EFE9` hiển thị phân cấp `Danh mục cha › Danh mục con`.
  - Giá bán & % Cost: Bố trí đối xứng hoặc ngang hàng:
    - Giá bán: Cỡ $15\text{px}$, in đậm `#2D3E2F`, định dạng `tabular-nums` kèm đơn vị `đ`.
    - % Giá vốn: Badge nổi bật dạng `Cost: 28%` với màu sắc phân cấp như mục 2.2.
- **Khu vực Thao tác (Footer)**:
  - Dòng text nhỏ: `✓ Có công thức (X NVL)` hoặc `Chưa có BOM`.
  - Nút thao tác: Sửa (Edit), Xóa (Delete) và Xem chi tiết (Eye).

### 3.2. Chế độ Bảng Dòng (Table Row)
- **Cột 1: Món & Hình ảnh**:
  - Thumbnail ảnh nhỏ $42 \times 42\text{px}$, bo góc $8\text{px}$.
  - Tên món in đậm + Badge danh mục phân cấp bên dưới.
- **Cột 2: Giá cơ bản**:
  - Căn lề phải (`text-right`), phông số thẳng hàng `tabular-nums`.
- **Cột 3: % Giá vốn (% Cost)**:
  - Căn lề phải (`text-right`), hiển thị badge phần trăm số liệu thẳng hàng `tabular-nums`.
- **Cột 4: Trạng thái**:
  - Căn giữa (`text-center`), badge phẳng `Đang bán` / `Tạm ngưng`.
- **Cột 5: Thao tác**:
  - Nút Xem chi tiết (Eye), Sửa (Edit), Xóa (Delete).
- *Lưu ý*: Xóa bỏ hoàn toàn cột Kích cỡ, cột Giá vốn số tiền và cột Margin % trên bảng ngoài.

### 3.3. Popup Chi tiết Món (`ProductDetailModal`)
- Khi click vào bất kỳ vị trí nào trên thẻ hoặc dòng bảng:
  - Mở modal popup kích thước lớn hiển thị trọn vẹn:
    - Ảnh món kích thước lớn kèm mô tả.
    - Bộ 3 chỉ số tài chính: Giá cơ bản, Giá vốn chi tiết (số tiền VNĐ + % Cost), và Biên lợi nhuận (Margin %).
    - Khối chi tiết Kích cỡ & Giá bán (Size S, M, L và phụ thu).
    - Bảng định lượng nguyên liệu chi tiết (BOM recipe table) cho từng size.

---

## 4. DỮ LIỆU ẢNH MẪU BAN ĐẦU
Cập nhật ảnh đại diện sắc nét cho 10 món mẫu hiện có trong CSDL (cà phê, trà, sinh tố) để hệ thống hiển thị sống động ngay lập tức.

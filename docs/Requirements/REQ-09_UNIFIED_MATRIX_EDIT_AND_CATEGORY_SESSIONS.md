# ĐẶC TẢ YÊU CẦU: TÁI CẤU TRÚC GIAO DIỆN SẢN PHẨM THEO SECTION DANH MỤC, TINH GỌN THẺ VÀ HỢP NHẤT POPUP MA TRẬN KÍCH CỠ - CÔNG THỨC
**Mã tài liệu**: `REQ-09`  
**Ngày ban hành**: 09/09/2026  
**Người yêu cầu**: Chủ quán (Owner)  
**Trạng thái**: Chờ duyệt Kế hoạch (`PLAN-09`)

---

## 1. BỐI CẢNH & PHẢN HỒI THỰC TẾ TỪ CHỦ QUÁN (CHÂN THỰC & CHI TIẾT)
Sau khi trải nghiệm thực tế màn hình Món bán, Chủ quán phản hồi chưa hài lòng với các điểm sau:
1. **Thẻ sản phẩm quá to và thừa thãi thông tin**:
   - Khung "Chưa có ảnh" chiếm quá nhiều diện tích.
   - Thẻ hiển thị nhiều nút thao tác nhỏ (Xem, Sửa, Xóa) gây rối mắt.
   - Tên danh mục lặp đi lặp lại trên từng thẻ đơn lẻ.
   - Dùng từ ngữ kỹ thuật như "BOM" (Bill of Materials) khiến người dùng khó hiểu. Cần thay bằng từ ngữ thân thiện tiếng Việt như "Định lượng" / "Công thức", "% Vốn".
2. **Mong muốn tổ chức lại màn hình Món bán**:
   - **Bỏ tên danh mục khỏi thẻ**: Thay vào đó, **chia toàn bộ trang thành các Section theo danh mục** (ví dụ: nhóm Cà phê, nhóm Trà, nhóm Sinh tố, nhóm Bánh). Mỗi section có tiêu đề danh mục to rõ và lưới thẻ món tương ứng.
   - **Xóa hết các nút thao tác mặt ngoài**: Bỏ nút con mắt, nút sửa, nút xóa ở thẻ và ở bảng dòng. Nhấn trực tiếp vào thẻ hoặc dòng bảng là mở ngay giao diện Sửa!
   - **Bỏ trang View tĩnh riêng (`ProductDetailModal`)**: Nhấn vào thẻ hoặc dòng là vào thẳng Popup **vừa xem vừa sửa (All-in-One)**.
   - **Chân popup chỉ có 2 nút**: Nút **"Xóa món"** (màu đỏ) và nút **"Lưu thay đổi"** (màu xanh).
3. **Gộp kích cỡ & công thức thành 1 Bảng Ma trận duy nhất (Ảnh vẽ tay của Chủ quán - Ảnh 2)**:
   - Bỏ việc chia làm 2 tab "Kích cỡ" và "Công thức".
   - **Cấu trúc Ma trận tích hợp**:
     - Cột tiêu đề các Size: `Size 1`, `Size 2`, `Size 3`... (Size S, M, L).
     - Ngay dưới mỗi size là **Giá bán thực tế** của size đó (`29.000 đ`, `35.000 đ`...).
     - Có nút chọn Size mặc định (⭐) và nút xóa size (✕).
     - Các hàng bên dưới là danh sách Nguyên liệu. Mỗi ô giao giữa Nguyên liệu và Size là số lượng định lượng của size đó, kèm đơn vị tính (`g`, `ml`, `Cái`...).
     - Có nút `+ Thêm size` và `+ Thêm nguyên liệu`.
   - **Trường hợp món không có nhiều size (chỉ bán 1 size duy nhất / Tiêu chuẩn)**:
     - Có nút chuyển đổi / toggle: `[ ] Phân loại theo kích cỡ (Size)`.
     - Nếu tắt: Chỉ có 1 ô nhập Giá bán duy nhất và bảng định lượng 1 cột số lượng đơn giản.

---

## 2. TIÊU CHÍ NGHIỆM THU CHI TIẾT (ACCEPTANCE CRITERIA)

### 2.1. Bố cục Section Danh mục (Category Sections)
- [ ] Trang Món bán được nhóm tự động theo từng danh mục (Section):
  - Tiêu đề Section: Biểu tượng thư mục + Tên danh mục + Số lượng món (ví dụ: `📁 Cà phê • 5 món`).
  - Lưới thẻ sản phẩm của danh mục đó.
- [ ] Khi lọc theo danh mục cụ thể hoặc tìm kiếm từ khóa, các section tự động hiển thị tương ứng.

### 2.2. Thẻ Sản phẩm Siêu Tinh gọn (Compact Card)
- [ ] Không in badge danh mục bên trong thẻ (vì đã có Section Header).
- [ ] Xóa bỏ toàn bộ cụm nút Xem, Sửa, Xóa ở chân thẻ.
- [ ] Kích thước thẻ nhỏ gọn, cân đối:
  - Ảnh món chiều cao $\approx 100\text{px} - 110\text{px}$ (hoặc thumbnail gọn gàng).
  - Huy hiệu `Đang bán` / `Tạm ngưng` nhỏ gọn.
  - Tên món (14.5px, in đậm).
  - Dòng giá: Giá bán (to rõ, `tabular-nums`) và `% Vốn` (ví dụ: `23% Vốn`, phân màu xanh/vàng/đỏ; nếu chưa có công thức thì ghi `Chưa định lượng`).
  - Không xuất hiện từ "BOM".
- [ ] Nhấp bất kỳ đâu trên thẻ $\rightarrow$ Mở Popup Sửa & Định lượng Ma trận.

### 2.3. Bảng Dòng Siêu Tinh gọn (Table View)
- [ ] Bỏ cụm nút thao tác ở cột cuối (hoặc chỉ có mũi tên chỉ dẫn).
- [ ] Cột hiển thị: Món & Hình ảnh, Giá bán, % Vốn, Trạng thái.
- [ ] Nhấp vào dòng $\rightarrow$ Mở Popup Sửa & Định lượng Ma trận.

### 2.4. Popup Sửa & Định lượng Ma trận (All-in-One Modal)
- [ ] Bỏ hoàn toàn modal view tĩnh `ProductDetailModal`.
- [ ] Khối Thông tin cơ bản: Tên món, Danh mục, Trạng thái, Ảnh đại diện, Toggle `Bán theo nhiều kích cỡ (Size)`.
- [ ] Khối Giá bán & Công thức Ma trận (Theo cấu trúc Ảnh 2):
  - **Khi tắt nhiều size**: Ô nhập Giá bán + Bảng định lượng 1 cột số lượng.
  - **Khi bật nhiều size**: Ma trận tích hợp:
    - Cột Size: Tên size + Giá bán từng size + Nút ⭐ size mặc định + Nút ✕ xóa size + Nút `+ Thêm size`.
    - Hàng nguyên liệu: Tên nguyên liệu + Ô nhập định lượng cho từng size + Đơn vị tính + Nút xóa nguyên liệu + Nút `+ Thêm nguyên liệu`.
    - Tự động tính toán Giá vốn và % Vốn theo thời gian thực cho từng size.
- [ ] Chân Popup: Chỉ có đúng 2 nút: **"Xóa món"** (màu đỏ) và **"Lưu thay đổi"** (màu xanh rêu `#2D3E2F`).

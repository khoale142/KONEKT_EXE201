# KẾ HOẠCH HÀNH ĐỘNG: PHÂN CHIA SECTION DANH MỤC, TINH GỌN THẺ VÀ XÂY DỰNG POPUP MA TRẬN KÍCH CỠ - ĐỊNH LƯỢNG TÍCH HỢP
**Mã kế hoạch**: `PLAN-09`  
**Dựa trên yêu cầu**: `REQ-09`  
**Ngày lập**: 09/09/2026  
**Trạng thái**: Chờ Chủ quán phê duyệt (Pending Owner Approval)

---

## 1. MỤC TIÊU TRIỂN KHAI
1. Tái cấu trúc trang Món bán (`OwnerProductsPage.tsx`) chia theo các Section Danh mục (Category Sections), thay vì hiển thị lưới thẻ đơn điệu lặp đi lặp lại tag danh mục.
2. Tinh gọn thẻ sản phẩm: Bỏ badge danh mục, bỏ cụm 3 nút thao tác, giảm chiều cao ảnh, hiển thị Giá bán và % Vốn bằng từ ngữ thuần Việt ("Vốn 28%", "Chưa định lượng", bỏ hẳn từ "BOM").
3. Chuyển đổi toàn bộ thao tác click (click thẻ hoặc click dòng bảng) $\rightarrow$ Mở thẳng Popup Vừa Xem Vừa Sửa (All-in-One Edit Modal), bỏ popup view tĩnh `ProductDetailModal`.
4. Hợp nhất Kích cỡ, Giá bán và Công thức định lượng thành **Bảng Ma trận Kích cỡ - Công thức** tích hợp trực quan (theo đúng bản vẽ tay Ảnh 2 của Chủ quán).
5. Xử lý linh hoạt 2 trường hợp:
   - **Món 1 size duy nhất**: Nhập 1 giá bán và bảng định lượng 1 cột số lượng đơn giản.
   - **Món nhiều kích cỡ**: Hiển thị Ma trận tích hợp: Hàng header gồm Tên size + Giá bán từng size + Nút ⭐ size mặc định + Nút ✕ xóa size; Các hàng gồm Nguyên liệu + Số lượng định lượng cho từng size + Đơn vị + Nút xóa.
6. Chân Popup chỉ gồm đúng 2 nút chính: **"Xóa món"** và **"Lưu thay đổi"**.

---

## 2. CHI TIẾT CÁC BƯỚC THỰC HIỆN

### Bước 1: Tái cấu trúc Popup Sửa & Định lượng Ma trận ([ProductFormModal.tsx](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/frontend/src/features/owner-menu/components/ProductFormModal.tsx))
- **Gộp giao diện**: Không chia làm 2 tab riêng biệt ("Thông tin" và "Công thức") nữa. Thay vào đó tổ chức thành 2 khối trực quan trên cùng 1 modal:
  - **Khối 1: Thông tin cơ bản**:
    - Tên món (input text).
    - Danh mục (select category cha/con).
    - Trạng thái bán (select: `Đang bán` / `Tạm ngưng`).
    - Ảnh món (input URL + thumbnail xem trước).
    - Toggle bật/tắt: `[ ] Phân loại theo nhiều kích cỡ (Size)`.
  - **Khối 2: Bảng Định lượng & Giá bán (Unified Matrix như Ảnh 2)**:
    - **Nếu KHÔNG chọn nhiều kích cỡ**:
      - Nhập `Giá bán (đ)` trực tiếp.
      - Bảng nguyên liệu: Tên NVL (select), Số lượng định lượng (input), Đơn vị tính (text), Nút Xóa (trash).
      - Nút `+ Thêm nguyên liệu`.
      - Dòng tính toán tự động: `Giá vốn: X đ • Tỷ lệ vốn: Y%`.
    - **Nếu CÓ nhiều kích cỡ**:
      - Bảng Ma trận Kích cỡ & Định lượng:
        - Header bảng: Cột Nguyên liệu | Cột từng Size (Input tên size + Input giá bán + ⭐ chọn mặc định + ✕ xóa size) | Nút `+ Thêm size`.
        - Rows: Tên nguyên liệu | Input định lượng cho Size 1 | Input định lượng cho Size 2... | Đơn vị tính | Nút Xóa NVL.
        - Dưới bảng: Nút `+ Thêm nguyên liệu`.
        - Hàng tóm tắt dưới mỗi size: Giá vốn tính theo NVL và % Vốn tính theo Giá bán của size đó.
- **Chân Modal**:
  - Bên trái: Nút đỏ **"Xóa món"** (nếu đang chỉnh sửa món).
  - Bên phải: Nút xanh rêu **"Lưu thay đổi"**.
  - Góc trên: Nút ✕ đóng modal.

### Bước 2: Tái cấu trúc Trang Món Bán ([OwnerProductsPage.tsx](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/frontend/src/features/owner-menu/pages/OwnerProductsPage.tsx))
- **Nhóm sản phẩm theo Section Danh mục**:
  ```typescript
  const categorySections = useMemo(() => {
    // Gom nhóm products theo categoryId/categoryName
    // Trả về danh sách: [{ categoryId, categoryName, products: [...] }]
  }, [filteredProducts]);
  ```
- **Hiển thị từng Section**:
  - Tiêu đề Section: Ví dụ `📁 Cà phê (5 món)`, `📁 Trà & Trà sữa (3 món)`, `📁 Bánh & Đồ ăn nhẹ (2 món)`.
  - Bên dưới mỗi section là Grid thẻ sản phẩm tương ứng.
- **Thẻ Sản phẩm Siêu Tinh gọn**:
  - Không có tag danh mục trong thẻ.
  - Không có các nút xem/sửa/xóa ở chân thẻ.
  - Ảnh món: Chiều cao gọn $\approx 110\text{px}$, bo góc trên, tag trạng thái nhỏ nổi góc trên.
  - Body: Tên món + Giá bán (to rõ) + % Vốn (ví dụ: `28% Vốn`, nếu chưa có công thức thì ghi `Chưa định lượng`, xóa hẳn từ "BOM").
  - Click vào thẻ $\rightarrow$ Mở `ProductFormModal` ngay lập tức!
- **Bảng Dòng (Table View)**:
  - Bỏ cụm nút thao tác ở cột cuối.
  - Cột: Món & Hình ảnh, Giá bán, % Vốn, Trạng thái.
  - Click vào dòng $\rightarrow$ Mở `ProductFormModal` ngay lập tức!
- **Dọn dẹp**: Xóa bỏ `ProductDetailModal` không còn sử dụng.

---

## 3. KẾ HOẠCH KIỂM THỬ (VERIFICATION PLAN)
1. **Kiểm tra TypeScript**: Chạy `npx tsc --noEmit` trên `frontend` và `backend` đảm bảo 0 lỗi.
2. **Kiểm tra Nghiệp vụ Món 1 Size**:
   - Mở món chỉ có 1 size (hoặc tạo món mới tắt toggle nhiều size).
   - Nhập giá bán và định lượng nguyên liệu, lưu thành công.
3. **Kiểm tra Nghiệp vụ Ma trận Đa Kích cỡ (Ảnh 2)**:
   - Mở món có nhiều size (ví dụ Bạc sỉu, Trà sữa).
   - Thử sửa giá bán trực tiếp trên từng size, sửa định lượng từng size, thêm size mới, thêm nguyên liệu mới.
   - Kiểm tra hàng tổng kết tự động tính giá vốn và % vốn cho từng size.
   - Lưu thành công vào CSDL.
4. **Kiểm tra Section Danh mục**:
   - Xác nhận các món được phân theo từng nhóm danh mục rõ ràng, không còn lặp badge trong từng thẻ.
5. **Ghi nhận Changelog**: Cập nhật `[LOG-027]` vào `DEV_CHANGELOG.md`.

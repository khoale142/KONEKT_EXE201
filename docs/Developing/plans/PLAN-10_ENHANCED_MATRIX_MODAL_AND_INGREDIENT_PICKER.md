# KẾ HOẠCH HÀNH ĐỘNG: NÂNG CẤP POPUP MA TRẬN, NHÚNG ĐƠN VỊ & XÂY DỰNG POPUP CHỌN NGUYÊN LIỆU MULTI-SELECT
**Mã kế hoạch**: `PLAN-10`  
**Dựa trên yêu cầu**: `REQ-10`  
**Ngày lập**: 09/09/2026  
**Trạng thái**: Chờ Chủ quán phê duyệt (Pending Owner Approval)

---

## 1. MỤC TIÊU TRIỂN KHAI
1. **Mở rộng chiều ngang Modal**: Nâng cấp `ProductFormModal.tsx` từ `maxWidth: 780px` lên `maxWidth: 1040px` để bảng ma trận hiển thị rộng rãi, không bị co cụm trên laptop.
2. **Nhúng đơn vị tính trực tiếp sau số lượng (Inline Unit Suffix)**:
   - Xóa bỏ cột `Đơn vị` riêng ở cuối bảng.
   - Nhúng đơn vị (`g`, `ml`, `quả`...) trực tiếp sau con số nhập liệu của từng size: `[ 25 ] g` hoặc dạng input group gọn gàng.
3. **Bỏ icon sao (⭐) ở header Size**:
   - Chỉ giữ Tên size + Ô nhập Giá bán thực tế trực tiếp dưới từng size + Nút ✕ xóa size (khi có > 1 size).
4. **Xây dựng Popup Chọn Nguyên liệu & Bán thành phẩm (`IngredientPickerModal.tsx`)**:
   - Thay thế toàn bộ thẻ `<select>` dropdown ở cột Nguyên liệu trong bảng bằng text tĩnh (Tên món, tag phân loại, giá vốn tham khảo).
   - Khi bấm `+ Thêm nguyên liệu`, mở popup `IngredientPickerModal`:
     - Thanh tìm kiếm theo tên hoặc mã nguyên liệu.
     - Lọc theo Tab: `Tất cả` | `Nguyên liệu thô` | `Bán thành phẩm`.
     - Danh sách có checkbox chọn nhiều (Multi-select).
     - Hiển thị badge nguyên liệu đã có trong bảng (disable hoặc đánh dấu để tránh thêm trùng lặp).
     - Nút "Thêm vào công thức (X)" $\rightarrow$ Tự động sinh ra X hàng mới trong bảng ma trận!
5. **Đồng bộ cả chế độ 1 size và nhiều size**.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### A. Tạo mới
- `frontend/src/features/owner-menu/components/IngredientPickerModal.tsx`: Component popup chọn nhanh nhiều nguyên liệu thô và bán thành phẩm sơ chế với tìm kiếm và lọc tab.

### B. Chỉnh sửa
- `frontend/src/features/owner-menu/components/ProductFormModal.tsx`:
  - Mở rộng chiều ngang `maxWidth: 1040px`.
  - Tích hợp `IngredientPickerModal` khi bấm `+ Thêm nguyên liệu`.
  - Bỏ dropdown select ở từng hàng $\rightarrow$ Thay bằng hiển thị text cố định kèm nút xóa hàng.
  - Bỏ icon sao ⭐ ở header cột size.
  - Xóa cột "Đơn vị" riêng, nhúng đơn vị tính vào sau ô input số lượng định lượng của từng size.

---

## 3. CÁC BƯỚC THỰC HIỆN TUẦN TỰ

### Bước 1: Xây dựng Component `IngredientPickerModal.tsx`
- Nhận props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `ingredients: IngredientItem[]` (danh sách cả nguyên liệu thô và bán thành phẩm)
  - `alreadySelectedIds: number[]` (danh sách id đã có trong bảng ma trận)
  - `onSelect: (selectedIngredients: IngredientItem[]) => void`
- Giao diện:
  - Header: Tiêu đề "Chọn nguyên vật liệu & bán thành phẩm", nút ✕ đóng.
  - Toolbar: Ô input tìm kiếm (Search) + Segmented Tab (`Tất cả`, `Nguyên liệu thô`, `Bán thành phẩm`).
  - Danh sách cuộn dạng Table hoặc List card phẳng:
    - Checkbox chọn.
    - Tên nguyên liệu/BTP (bold).
    - Phân loại (badge: `Nguyên liệu thô` màu xanh nhạt, `Bán thành phẩm` màu vàng kem).
    - Đơn vị tính (`g`, `ml`...).
    - Đơn giá vốn hiện tại (`đ/đơn vị`).
  - Footer: Đếm số lượng đang chọn, nút "Hủy", nút "Thêm vào công thức (X)".

### Bước 2: Nâng cấp `ProductFormModal.tsx`
1. **Kích thước modal**:
   - Đặt `maxWidth: 1040` (thay vì 780), `width: "95vw"`.
2. **Cấu trúc Header Size**:
   - Bỏ nút sao ⭐.
   - Giữ: Input tên size + Input giá bán + Nút ✕ xóa size.
3. **Cấu trúc Hàng Nguyên liệu**:
   - Cột 1: Hiển thị text cố định Tên NVL / Bán thành phẩm + badge phân loại + đơn giá vốn.
   - Bỏ cột Đơn vị riêng!
   - Các cột Size: Render input số lượng kèm nhãn đơn vị inline ngay sau số lượng:
     ```tsx
     <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
       <input type="number" step="any" ... style={{ width: 64, textAlign: "right", ... }} />
       <span style={{ fontSize: 11.5, color: "#607062", fontWeight: 600, minWidth: 20 }}>{ing?.unit}</span>
     </div>
     ```
   - Cột cuối: Nút 🗑️ xóa hàng.
4. **Tích hợp `IngredientPickerModal`**:
   - Nút `+ Thêm nguyên liệu` $\rightarrow$ set `showPickerModal(true)`.
   - Hàm `handlePickerConfirm(selected)`: Thêm các mục được chọn vào `matrixRows` với số lượng mặc định là 0.

### Bước 3: Kiểm thử & Nghiệm thu
- Chạy `npx tsc --noEmit` trên cả frontend và backend đảm bảo 0 lỗi.
- Mở browser kiểm tra thực tế:
  - Mở modal form $\rightarrow$ xác nhận độ rộng 1040px thoáng đãng.
  - Header size không còn sao ⭐, chỉ còn Tên và Giá bán.
  - Không còn cột đơn vị riêng, đơn vị nằm ngay sau số lượng.
  - Bấm `+ Thêm nguyên liệu` $\rightarrow$ mở popup picker, tìm kiếm, tick chọn 2-3 nguyên liệu $\rightarrow$ bấm thêm $\rightarrow$ render ngay các hàng mới trong bảng ma trận.
  - Bấm lưu thay đổi $\rightarrow$ dữ liệu lưu chính xác vào CSDL.

---

## 4. RỦI RO & PHƯƠNG ÁN DỰ PHÒNG
- **Dữ liệu recipe cũ**: Khi mở món có công thức cũ, các nguyên liệu đã có được load và hiển thị ngay trên bảng ma trận với tên tĩnh và đơn vị inline, không làm mất bất kỳ dữ liệu định lượng nào.
- **Responsive**: Chiều rộng `min(1040px, 95vw)` tự co giãn linh hoạt trên mọi kích thước màn hình laptop.

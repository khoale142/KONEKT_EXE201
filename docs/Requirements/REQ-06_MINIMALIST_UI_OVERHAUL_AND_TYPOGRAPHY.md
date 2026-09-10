# REQ-06: TINH GỌN GIAO DIỆN, CHUẨN HÓA MÀU SẮC, XÓA SẠCH ICON RÁC & ĐỒNG BỘ PHÔNG BE VIETNAM PRO
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Tác giả**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Đã cập nhật theo review người dùng (User Reviewed & Approved Direction)

---

## 1. MỤC TIÊU & BỐI CẢNH (OBJECTIVE & CONTEXT)
Dựa trên review trực tiếp từ Chủ quán đối soát với hình ảnh thực tế, giao diện quản trị cần đại tu toàn diện để đạt tiêu chuẩn: **Tinh gọn, Đầy đủ, Dễ dùng và Thẩm mỹ cao cấp**:

1. **Phông & Nền (Typography & Canvas)**:
   - Thay thế hoàn toàn phông `DM Sans` bằng **`Be Vietnam Pro`** trên toàn bộ hệ thống để trị dứt điểm tình trạng lệch dấu, méo thanh tiếng Việt, lệch trục dòng (`baseline shift`).
   - Loại bỏ màu vàng ố cũ (`#FEF8EE`), chuyển toàn bộ nền app sang màu kem nhẹ thanh lịch **`#F8F6F1`** (Soft Linen / Warm Bone).
2. **Xóa sạch Icon rác (Zero Clutter Icon Diet)**:
   - Xóa bỏ toàn bộ icon ly nước / cốc cafe trước tên món ăn và danh mục (không còn cảnh món "Bánh Mì" gắn icon Ly Cà Phê).
   - Xóa bỏ các cục icon màu mè (xanh, cam, vàng, xanh dương) trong các thẻ chỉ số KPI.
   - Xóa bỏ icon bông lúa, thùng hàng trong các nhãn phân loại ("Nguyên liệu thô", "Bán thành phẩm").
   - Chỉ giữ lại các icon thao tác thực sự cần thiết (Kính lúp tìm kiếm, Dấu cộng "+", Sửa/Xóa, Mũi tên đóng/mở).
3. **Thanh Tab 1 Dòng Duy Nhất (Clean Segmented Bar)**:
   - Thu gọn về 1 dòng duy nhất, cắt sạch toàn bộ các dòng mô tả phụ 2 hàng bị dính dấu 3 chấm lem nhem (`bảng giá n..`, `biên lợi ..`).
   - Chỉ giữ lại text chuẩn: **`Món bán`** | **`Nguyên vật liệu & BTP`** | **`Công thức (BOM)`** | **`Danh mục`**.
4. **Chuẩn hóa Bảng Dữ Liệu (Pixel-Perfect Data Table)**:
   - Tất cả các cột Tiền nong, %, Số lượng (Giá bán, Giá vốn COGS, Margin %, Mức tồn) **bắt buộc căn phải (`text-right`)**, set `font-variant-numeric: tabular-nums` để các con số thẳng tắp theo hàng đơn vị.
   - **Bỏ thumbnail tạm (placeholder icon 48x48)** trước tên món đi, hiển thị text tên món trực tiếp để cột đầu thẳng hàng dọc tăm tắp từ trên xuống dưới, không để dòng thụt dòng thò.
5. **Gọn gàng Filter & Nút Bấm (Toolbar & Actions Clean-up)**:
   - Gom gọn Search + Lọc danh mục + Lọc trạng thái vào chung **1 thanh Toolbar duy nhất**.
   - Bỏ các nút thừa thãi như "Mở tất cả" / "Thu gọn tất cả".
   - Thu gọn các nút thao tác ở cuối dòng bảng, không để 3 nút to đùng dàn hàng ngang chiếm hết bảng nữa (thay bằng cụm nút nhỏ gọn hoặc icon ghost buttons).

---

## 2. PHẠM VI CHI TIẾT (DETAILED SPECIFICATION)

### A. Phông chữ & Nền
- Tải Google Font: `Be Vietnam Pro` (weights: 400, 500, 600, 700, 800).
- Áp dụng toàn cục `:root`, `html`, `body`, `button`, `input`, `select`, `table`: `--font-sans: 'Be Vietnam Pro', system-ui, -apple-system, sans-serif`.
- Nền app: `--cafe-cream: #F8F6F1`.
- Viền thẻ & bảng: `1px solid #E8E3DA`.
- Màu chữ chính: Deep Charcoal `#1E261F`, Màu chữ phụ: Slate Moss `#5A685B`.

### B. Hub Navigation
- Tiêu đề gọn gàng: `Thực đơn & Định lượng`. Bỏ cụm mô tả lặp lại dài dòng.
- Thanh Tab 1 dòng Segmented Control phong cách Apple/Linear:
  - 4 tabs: `Món bán` | `Nguyên vật liệu & BTP` | `Công thức (BOM)` | `Danh mục`.
  - Tab active: Nền trắng `#FFFFFF`, viền mảnh, chữ đậm màu xanh rêu `#2D3E2F`, bóng mờ êm nhẹ.

### C. Thẻ KPI (KPI Metric Cards)
- Bỏ 100% các ô tròn icon màu sắc.
- Cấu trúc thẻ:
  - Dòng 1: Nhãn nhỏ viết hoa, màu `#6A7B6D`, font size 11px, tracking nhẹ.
  - Dòng 2: Con số lớn 24px đậm nét màu `#1E261F`, kèm đơn vị nhỏ thanh lịch.

### D. Bảng Món bán (`OwnerProductsPage`)
- Bỏ thumbnail icon ly nước giả lập. Cột 1 hiển thị trực tiếp: Tên món (đậm 14px) + Nhãn danh mục nhỏ bên dưới. Thẳng hàng dọc 100%.
- Cột Các kích cỡ (Size): Các tag kích cỡ nhỏ gọn, đồng chiều cao, không làm phình dòng.
- Cột Giá cơ bản: Căn phải (`text-right`), `tabular-nums`.
- Cột Giá vốn (Cost): Căn phải (`text-right`), `tabular-nums`.
- Cột Margin %: Căn phải (`text-right`), badge phần trăm gọn gàng.
- Cột Trạng thái: Badge chữ nhỏ gọn không icon.
- Cột Thao tác: Căn phải, 2 nút icon nhỏ (Sửa, Xóa) dạng ghost button.

### E. Bảng Nguyên liệu & BTP (`OwnerIngredientsTab`)
- Thẻ KPI: 3 chỉ số sạch sẽ (Tổng vật tư, Nguyên liệu thô, Bán thành phẩm), không icon màu mè.
- Cột Phân loại: Badge chữ "Nguyên liệu thô" / "Bán thành phẩm", bỏ icon bông lúa/thùng hàng.
- Cột Đơn vị tính: Text gọn gàng.
- Cột Giá vốn & Tồn kho: Căn phải (`text-right`), `tabular-nums`.
- Nút "Công thức sơ chế (BOM)": Nút nhỏ tinh tế trên dòng Bán thành phẩm.

### F. Sổ tay Công thức (`OwnerRecipesPage`)
- Toolbar: Gom Tìm kiếm + Dropdown Danh mục + Lọc trạng thái vào 1 hàng toolbar duy nhất. Bỏ nút "Mở tất cả" / "Thu gọn tất cả".
- Bỏ icon ly nước giả lập trước tên món.
- Thao tác cuối dòng: Thu gọn thành 1 nút chính gọn gàng ("Xem công thức" / "+ Tạo BOM") và 1 nút icon sửa thông tin.

### G. Danh mục Món (`OwnerCategoriesPage`)
- Bỏ icon FolderTree ở cột tên danh mục.
- Bỏ icon ly nước ở cột số lượng món. Số lượng căn phải hoặc căn giữa tinh gọn.

---

## 3. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
- [ ] Toàn bộ app hiển thị phông `Be Vietnam Pro`, các ký tự tiếng Việt có dấu hoàn hảo, không lệch trục.
- [ ] Nền app là mã màu kem nhẹ `#F8F6F1`, không còn màu vàng ố `#FEF8EE`.
- [ ] Không còn icon ly nước trước tên món, tên danh mục; không còn icon lúa/hộp trong tag; không còn icon lòe loẹt trong KPI.
- [ ] Thanh Tab chỉ có 1 dòng chữ: `Món bán` | `Nguyên vật liệu & BTP` | `Công thức (BOM)` | `Danh mục`, không bị dính dấu 3 chấm `...`.
- [ ] Cột Giá bán, COGS, Margin %, Mức tồn căn phải (`text-right`) và bật `tabular-nums`.
- [ ] Bỏ thumbnail tạm, tên món hiển thị thẳng hàng dọc từ trên xuống dưới.
- [ ] Toolbar gom gọn Tìm kiếm + Danh mục + Trạng thái trên 1 thanh duy nhất; bỏ nút Mở tất cả / Thu gọn tất cả.
- [ ] Nút thao tác cuối dòng thu gọn gàng, không dàn hàng ngang chiếm diện tích.
- [ ] Frontend và Backend biên dịch không lỗi (`tsc --noEmit` = 0 lỗi).

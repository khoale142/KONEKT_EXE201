# REQ-07: TÁI CẤU TRÚC 3 TRANG THỰC ĐƠN ĐỘC LẬP, DANH MỤC PHÂN CẤP TÍCH HỢP & 2 CHẾ ĐỘ HIỂN THỊ (CARD / TABLE)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Tác giả**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Chờ duyệt Kế hoạch (Pending Plan Review)

---

## 1. MỤC TIÊU & BỐI CẢNH (OBJECTIVE & CONTEXT)

Dựa trên kết quả đối soát thực tế và chỉ đạo trực tiếp từ Chủ quán:
1. **Khắc phục sự phân mảnh**:
   - Hiện tại, "Món bán" và "Công thức (BOM)" đang bị tách làm 2 tab riêng biệt khiến chủ quán phải chuyển qua chuyển lại khi quản lý giá bán và định lượng.
   - "Danh mục" bị tách riêng thành 1 tab độc lập, rời rạc với dữ liệu món và vật tư.
   - "Nguyên liệu thô" và "Bán thành phẩm" đang bị gộp chung vào 1 tab vật tư, gây rối rắm trong kiểm soát kho và quản lý định lượng sơ chế.
2. **Mục tiêu Tái tổ chức**:
   - **Trang 1: Sản phẩm / Món bán (Products & Recipes BOM)**: Tích hợp trọn gói Món bán + Công thức pha chế (BOM) đa kích cỡ + Danh mục món ăn tích hợp trực tiếp (có phân cấp danh mục cha - con).
   - **Trang 2: Nguyên liệu thô (Raw Materials / Ingredients)**: Quản lý riêng biệt toàn bộ vật tư thô nhập kho từ nhà cung cấp (hạt cafe, sữa, đường, trà khô, ly tách...) + Danh mục nguyên liệu cha - con.
   - **Trang 3: Bán thành phẩm (Semi-Finished Goods / Prepped Items)**: Quản lý riêng các món sơ chế tại quán (cốt cafe phin, nước đường nấu, sốt kem cheese, thạch...) + Công thức sơ chế (BOM) từ nguyên liệu thô kèm sản lượng mẻ (Batch Yield) $\rightarrow$ Tự động tính giá vốn COGS + Danh mục BTP cha - con.
3. **Trải nghiệm 2 Chế độ hiển thị linh hoạt (Dual View Modes)**:
   - **Mode 1: Dạng Thẻ (Card / Grid View)**: Rất trực quan và thích hợp khi làm việc trên màn hình laptop / desktop rộng. Nhấp chuột vào từng thẻ sẽ bật Popup / Modal chi tiết đầy đủ thông tin (giá theo size, định lượng công thức, v.v.).
   - **Mode 2: Dạng Dòng (Table / Row View)**: Bảng dữ liệu dòng chuẩn mực, tối giản, canh phải tabular-nums cho các con số tài chính, tiện cho việc rà soát số lượng lớn.
4. **Tối giản Trạng thái**:
   - Loại bỏ hoàn toàn các icon màu mè rác ở trạng thái bán hàng; sử dụng nhãn chữ phẳng tinh tế (`Đang bán` / `Tạm ngưng`).

---

## 2. USER STORIES

1. **Là một Chủ quán (Owner)**:
   - Khi vào trang **Sản phẩm & Món bán**, tôi thấy ngay danh sách món kèm giá bán và chi phí định lượng (Food Cost) của từng món mà không phải nhảy qua tab khác.
   - Khi dùng laptop, tôi có thể chuyển sang **Chế độ Thẻ (Card Grid Mode)** để xem các món trực quan, bấm vào bất kỳ món nào để mở Popup xem và chỉnh sửa toàn bộ kích cỡ & công thức BOM.
   - Khi cần rà soát nhanh bảng giá toàn chuỗi, tôi chuyển sang **Chế độ Bảng Dòng (Table Row Mode)**.
   - Tôi có thể lọc theo **Danh mục cha** (ví dụ: `Cà phê`) hoặc **Danh mục con** (ví dụ: `Cà phê máy`, `Cà phê pha phin`) ngay trên thanh công cụ của trang món ăn, và có thể tạo nhanh danh mục mới ngay tại chỗ.
   - Khi quản lý **Nguyên liệu thô**, tôi có một trang riêng biệt, không bị lẫn lộn với cốt cà phê hay sốt tự làm.
   - Khi quản lý **Bán thành phẩm**, tôi có một trang riêng biệt, có thể bấm "Công thức sơ chế (BOM)" để khai báo mẻ nấu cốt cafe phin (dùng bao nhiêu g cafe hạt, hao hụt bao nhiêu %) và hệ thống tự động tính ra giá vốn 1 ml cốt cafe cho tôi.

---

## 3. PHẠM VI NGHIỆP VỤ CHI TIẾT (DETAILED SPECIFICATION)

### A. Tái cấu trúc 3 Trang / Sub-modules Chuyên Biệt
1. **Trang 1: Sản phẩm & Món bán (`OwnerProductsHubPage`)**:
   - Gộp chức năng của `OwnerProductsPage` và `OwnerRecipesPage` thành một thể thống nhất.
   - Mỗi sản phẩm gồm: Tên món, mã, danh mục cha/con, giá bán cơ bản, các kích cỡ (Size S/M/L) kèm phụ thu, bảng công thức định lượng (BOM) đa kích cỡ, Food Cost và Biên lợi nhuận (Margin %).
   - Quản lý danh mục món ăn trực tiếp: Thêm/Sửa/Xóa nhóm món cha và nhóm món con ngay trên trang.
2. **Trang 2: Nguyên liệu thô (`OwnerRawMaterialsPage`)**:
   - Chỉ hiển thị các nguyên liệu thô đầu vào nhập kho (`item_type = 'raw'`).
   - Thông tin: Tên vật tư, mã, danh mục vật tư cha/con, đơn vị tính (g, ml, quả, lon...), đơn vị nhập, đơn giá vốn nhập (COGS), mức tồn kho an toàn tối thiểu.
   - Quản lý danh mục nguyên liệu trực tiếp: Nông sản & Hạt, Sữa & Chế phẩm, Bao bì & Đóng gói...
3. **Trang 3: Bán thành phẩm (`OwnerSemiFinishedPage`)**:
   - Chỉ hiển thị các bán thành phẩm sơ chế sẵn tại quán (`item_type = 'semi_finished'`).
   - Thông tin: Tên BTP, mã, danh mục BTP cha/con, đơn vị tính thành phẩm (ml, g...), sản lượng định mức 1 mẻ (Batch Yield), đơn giá vốn COGS (tính tự động từ công thức sơ chế).
   - Tích hợp Sổ tay công thức sơ chế (Sub-BOM): Khai báo các nguyên liệu thô cấu thành mẻ, % hao hụt $\rightarrow$ Hệ thống tự tính chi phí mẻ và giá vốn đơn vị.

### B. Chế độ hiển thị 2 Mode (Dual View Switcher)
- Toolbar mỗi trang tích hợp nút chuyển đổi chế độ xem:
  - Nút **Dạng Thẻ (Grid Mode)** $\boxplus$:
    - Render danh sách theo Grid Responsive (2 - 4 cột tùy độ rộng màn hình).
    - Mỗi thẻ chứa: Tên món/vật tư, Badge danh mục (Cha $\rightarrow$ Con), Giá tiền, Margin %, Trạng thái (Text badge sạch), Số lượng NVL/BOM.
    - Sự kiện: Bấm vào thẻ $\rightarrow$ Mở Popup Modal chi tiết hiển thị toàn diện thông tin và công thức.
  - Nút **Dạng Dòng (Table Mode)** $\equiv$:
    - Render theo bảng dữ liệu dòng tối giản, chuẩn phẳng.
    - Cột tài chính canh phải (`text-right`), bật `tabular-nums`.
- Lưu tùy chọn của người dùng vào `localStorage` (ví dụ `konekt_menu_view_mode: 'grid' | 'table'`).

### C. Danh mục Phân cấp (Parent - Child Hierarchical Categories)
- Cấu trúc dữ liệu:
  - `id`: serial
  - `parent_id`: integer nullable (nếu null $\rightarrow$ Danh mục cha cấp 1; nếu có giá trị $\rightarrow$ Danh mục con cấp 2).
  - `scope`: varchar(50) (`'product'` | `'raw_material'` | `'semi_finished'`).
  - `name`, `description`, `sort_order`, `is_active`.
- Giao diện bộ lọc:
  - Dropdown lọc thông minh: hiển thị thụt đầu dòng rõ ràng cho danh mục con:
    ```
    Tất cả danh mục
    ├── Cà phê (Danh mục cha)
    │   ├── Cà phê pha phin
    │   └── Cà phê máy
    ├── Trà & Trà sữa (Danh mục cha)
    │   ├── Trà trái cây
    │   └── Trà sữa
    ```
  - Modal quản lý danh mục nhanh tại chỗ: Cho phép chọn "Là danh mục con của..." khi tạo nhóm mới.

### D. Tối giản Trạng thái Bán hàng
- Trạng thái `Đang bán` / `Tạm ngưng` hiển thị dưới dạng badge chữ phẳng:
  - `Đang bán`: Nền `#EBF4ED`, chữ `#235E2D`, không có icon.
  - `Tạm ngưng`: Nền `#F2EFEA`, chữ `#736E66`, không có icon.

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
- [ ] Thanh điều hướng Menu Hub rút gọn còn đúng 3 trang/tab: **`Sản phẩm & Món bán`** | **`Nguyên liệu thô`** | **`Bán thành phẩm`**.
- [ ] Mỗi trang đều có nút chuyển đổi linh hoạt giữa 2 chế độ: **Dạng Thẻ (Card Grid)** và **Dạng Dòng (Table Row)**.
- [ ] Ở chế độ Thẻ: Bấm vào card mở Popup Modal chi tiết (thông tin + công thức BOM).
- [ ] Ở chế độ Dòng: Bảng dữ liệu dòng thẳng hàng, cột số liệu canh phải `tabular-nums`.
- [ ] Món bán và Công thức pha chế (BOM) được tích hợp trong cùng 1 trang Sản phẩm, không còn bị chia cắt.
- [ ] Danh mục được tích hợp trực tiếp vào từng trang, hỗ trợ phân cấp danh mục cha - danh mục con.
- [ ] Bán thành phẩm có sổ tay công thức sơ chế từ nguyên liệu thô và tự động cập nhật giá vốn COGS.
- [ ] Không còn icon màu mè ở nhãn trạng thái bán hàng.
- [ ] Kiểm tra biên dịch TypeScript frontend & backend đạt 100% 0 lỗi (`tsc --noEmit`).

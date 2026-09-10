# PLAN-06: TINH GỌN GIAO DIỆN, CHUẨN HÓA MÀU SẮC, XÓA SẠCH ICON RÁC & ĐỒNG BỘ PHÔNG BE VIETNAM PRO
**Liên kết yêu cầu**: `docs/Requirements/REQ-06_MINIMALIST_UI_OVERHAUL_AND_TYPOGRAPHY.md`  
**Người lập kế hoạch**: Antigravity AI Agent  
**Ngày cập nhật**: 09/09/2026  
**Trạng thái**: Đã cập nhật theo yêu cầu review chi tiết từ người dùng

---

## 1. MỤC TIÊU CỤ THỂ THEO REVIEW CỦA CHỦ QUÁN
1. **Phông & Nền**:
   - Đổi toàn bộ sang phông **`Be Vietnam Pro`** trên phạm vi toàn cầu (`index.css`), trị dứt điểm vụ lệch dấu tiếng Việt và lệch trục dòng (`baseline shift`).
   - Đổi nền app sang mã màu kem nhẹ **`#F8F6F1`** (Soft Linen / Bone Warm), dẹp bỏ màu vàng ố `#FEF8EE`.
2. **Xóa sạch icon rác**:
   - Bỏ hết icon ly nước / cốc cafe trước tên món ăn và danh mục (loại bỏ hoàn toàn cảnh món "Bánh Mì" gắn icon Cốc Cà Phê).
   - Xóa các cục icon tròn màu mè (xanh, cam, vàng, xanh dương) trong các thẻ chỉ số KPI.
   - Bỏ icon bông lúa / thùng hàng trong nhãn phân loại ("Nguyên liệu thô", "Bán thành phẩm").
   - Chỉ giữ icon thao tác thực sự cần thiết (Kính lúp, Dấu cộng "+", Sửa/Xóa, Mũi tên).
3. **Thanh Tab 1 dòng duy nhất**:
   - Thu gọn về 1 dòng duy nhất.
   - Cắt sạch mấy dòng mô tả phụ 2 hàng bị dính dấu 3 chấm (`...`).
   - Chỉ để text: **`Món bán`** | **`Nguyên vật liệu & BTP`** | **`Công thức (BOM)`** | **`Danh mục`**.
4. **Chuẩn hóa Bảng dữ liệu**:
   - Cột Tiền nong, %, Số lượng (Giá bán, COGS, Margin %, Tồn kho) **bắt buộc canh phải (`text-right`)**, set `font-variant-numeric: tabular-nums` cho thẳng hàng đơn vị.
   - **Bỏ thumbnail tạm trước tên món đi**, hiển thị text trực tiếp cho thẳng hàng dọc từ trên xuống dưới, không để dòng thụt dòng thò.
5. **Gọn gàng Filter & Nút bấm**:
   - Gom Tìm kiếm (Search) + Lọc danh mục + Lọc trạng thái vào chung **1 thanh Toolbar duy nhất**.
   - Bỏ mấy nút thừa thãi như "Mở tất cả" / "Thu gọn tất cả".
   - Nút thao tác cuối dòng thu gọn lại, không để 3 nút to đùng dàn hàng ngang chiếm hết bảng nữa.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG & CHI TIẾT THỰC HIỆN

### A. Phông chữ & Nền Toàn Cục
* `[CHỈNH SỬA]` `frontend/src/index.css`:
  - Thêm `@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap");`
  - Đặt `--font-sans: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;` làm phông mặc định cho toàn bộ `:root`, `html`, `body`, `button`, `input`, `select`, `table`.
  - Cập nhật biến màu nền `--cafe-cream: #F8F6F1;`, viền `--cafe-border: #E8E3DA;`, chữ `--cafe-text: #1E261F;`.
  - Cài đặt mặc định CSS cho số liệu: `.tabular-num, td.num-col { font-variant-numeric: tabular-nums; text-align: right; }`.

### B. Hub Navigation & Thanh Tab 1 Dòng
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerMenuHubPage.tsx`:
  - Bỏ icon cốc cafe to đùng và đoạn text mô tả dài dòng ở đầu trang. Tiêu đề còn lại: `Thực đơn & Định lượng`.
  - Thiết kế lại thanh Tabs thành dạng **Segmented Bar 1 dòng duy nhất**:
    - Chỉ hiển thị text: `Món bán` | `Nguyên vật liệu & BTP` | `Công thức (BOM)` | `Danh mục`.
    - Bỏ hoàn toàn icon trong tab và các câu mô tả phụ 2 dòng bị cắt dấu `...`.
    - Active tab: Nền trắng `#FFFFFF`, viền mảnh `1px solid #E8E3DA`, chữ màu xanh rêu `#2D3E2F`, bóng mờ êm nhẹ.

### C. Quản lý Món bán (`OwnerProductsPage.tsx`)
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerProductsPage.tsx`:
  - Thẻ KPI: Xóa bỏ các cục icon màu sắc tròn (cốc cafe, checkmark, flask, trending up). Chuyển thành thẻ số liệu tối giản nền trắng: TỔNG SẢN PHẨM (24px bold), ĐANG MỞ BÁN (24px bold), CÔNG THỨC BOM (24px bold), BIÊN LỢI NHUẬN TB (24px bold).
  - Bảng món:
    - **Bỏ thumbnail placeholder icon ly nước 48x48**. Cột 1 hiển thị text trực tiếp: Tên món (đậm 14px) + Nhãn danh mục nhỏ bên dưới, tạo thành 1 cột thẳng hàng dọc từ trên xuống dưới.
    - Cột Giá cơ bản: Canh phải (`text-align: right;`), `tabular-nums`.
    - Cột Giá vốn (Cost): Canh phải (`text-align: right;`), `tabular-nums`.
    - Cột Margin %: Canh phải (`text-align: right;`).
    - Cột Trạng thái: Badge chữ nhỏ gọn, không icon.
    - Cột Thao tác: Thu gọn thành 2 nút icon nhỏ gọn (ghost buttons: Sửa, Xóa).
  - Toolbar: Gom Tìm kiếm + Dropdown Danh mục + Dropdown Trạng thái + Nút Làm mới + Nút "+ Thêm món mới" trên cùng 1 thanh toolbar duy nhất.

### D. Quản lý Nguyên vật liệu & Bán thành phẩm (`OwnerIngredientsTab.tsx`)
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/components/OwnerIngredientsTab.tsx`:
  - Thẻ KPI: Xóa bỏ các icon tròn màu mè (thùng hàng, bông lúa, bình thí nghiệm). Thẻ trắng số to rõ: TỔNG VẬT TƯ, NGUYÊN LIỆU THÔ, BÁN THÀNH PHẨM.
  - Bảng vật tư:
    - Cột Tên vật tư: Text trực tiếp thẳng tắp, không icon rác.
    - Cột Phân loại: Badge chữ "Nguyên liệu thô" / "Bán thành phẩm" tối giản, bỏ icon lúa/hộp.
    - Cột Giá vốn (COGS): Canh phải (`text-align: right;`), `tabular-nums`.
    - Cột Mức tồn tối thiểu: Canh phải (`text-align: right;`), `tabular-nums`.
    - Cột Trạng thái: Badge nhỏ gọn.
  - Toolbar: Gom Tìm kiếm + Bộ lọc phân loại (Tất cả / Thô / BTP) + Nút Thêm vào 1 thanh duy nhất.

### E. Sổ tay Công thức (`OwnerRecipesPage.tsx`)
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerRecipesPage.tsx`:
  - Thẻ KPI: 3 thẻ số liệu tối giản sạch sẽ (TỔNG SỐ MÓN, ĐÃ CÓ ĐỊNH LƯỢNG, CHƯA KHAI BÁO CÔNG THỨC), bỏ icon màu mè.
  - Toolbar:
    - Gom Tìm kiếm + Lọc danh mục + Lọc trạng thái BOM (Tất cả / Đã có / Chưa có) trên **1 thanh Toolbar duy nhất**.
    - **Bỏ mấy nút thừa thãi**: Xóa bỏ nút "Mở tất cả" và "Thu gọn tất cả".
  - Danh sách thẻ món:
    - **Bỏ thumbnail icon ly nước giả lập**, tên món và thông tin hiển thị text trực tiếp thẳng hàng dọc.
    - Cột Food Cost và Margin % canh phải (`text-align: right;`), `tabular-nums`.
    - **Nút thao tác cuối dòng thu gọn lại**: Bỏ việc dàn 3 nút to đùng ("+ Khai báo BOM" / "Xem định lượng" + "Sửa thông tin" + "Sửa công thức"). Thay bằng:
      - 1 nút chính gọn gàng: "Xem công thức (X)" hoặc "+ Tạo BOM".
      - 1 nút icon Sửa nhỏ gọn.

### F. Danh mục Món (`OwnerCategoriesPage.tsx`)
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerCategoriesPage.tsx`:
  - Bảng danh mục:
    - Bỏ icon FolderTree ở cột tên danh mục. Text tên danh mục hiển thị trực tiếp thẳng hàng.
    - Bỏ icon ly nước ở cột Số lượng món. Cột Số lượng món canh phải (`text-align: right;`), `tabular-nums`.
  - Cột Thao tác: Thu gọn 2 nút Sửa/Xóa.

---

## 3. CÁC BƯỚC TRIỂN KHAI TUẦN TỰ
1. **Bước 1**: Cập nhật `index.css`: nhúng `Be Vietnam Pro`, đổi màu nền app thành `#F8F6F1`, cài đặt `tabular-nums` và `text-align: right` cho các cột số liệu.
2. **Bước 2**: Đại tu `OwnerMenuHubPage.tsx`: gỡ bỏ icon khổng lồ & text thừa, chuyển thanh Tab thành Segmented Control 1 dòng duy nhất.
3. **Bước 3**: Cải tổ `OwnerProductsPage.tsx`: bỏ icon placeholder ly nước trước tên món, xóa icon màu mè trong KPI, canh phải toàn bộ cột tiền nong/margin/tồn, gom toolbar.
4. **Bước 4**: Cải tổ `OwnerIngredientsTab.tsx`: xóa icon lúa/hộp trong nhãn phân loại, xóa icon KPI, canh phải cột COGS & Tồn.
5. **Bước 5**: Cải tổ `OwnerRecipesPage.tsx`: xóa nút "Mở tất cả / Thu gọn tất cả", gom toolbar, bỏ thumbnail ly nước, thu gọn cụm 3 nút thao tác dàn hàng ngang thành nút tinh gọn.
6. **Bước 6**: Cải tổ `OwnerCategoriesPage.tsx`: bỏ icon FolderTree và icon ly nước.
7. **Bước 7**: Kiểm tra Type Check `npx tsc --noEmit` trên frontend & backend; mở trình duyệt đối soát giao diện đảm bảo chuẩn chỉnh 100%.

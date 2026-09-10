# KẾ HOẠCH HÀNH ĐỘNG: TÍNH GIÁ VỐN BÌNH QUÂN GIA QUYỀN, ĐƠN VỊ TÍNH CHI TIẾT CÓ TÌM KIẾM VÀ TẠO NHANH DANH MỤC
**Mã kế hoạch**: `PLAN-11`  
**Căn cứ**: `REQ-11` & Yêu cầu chỉ đạo trực tiếp của Chủ quán  
**Người lập kế hoạch**: Antigravity AI Agent  
**Trạng thái**: Đã hoàn thành nghiệm thu (Completed)  

---

## 1. Mục tiêu Kỹ thuật
Nâng cấp trải nghiệm quản lý nguyên liệu và món bán:
1. **Máy tính Giá vốn Thông minh (Cost Calculator)**: Cho phép tính giá vốn theo lô đóng gói và tính giá trị tồn kho trung bình bình quân gia quyền (Weighted Average Cost) ngay tại ô Giá vốn của form Nguyên liệu.
2. **Bộ chọn Đơn vị tính F&B Searchable (`SearchableUnitSelect`)**: Hỗ trợ 25+ đơn vị chuẩn ngành F&B, phân nhóm khoa học, gõ tìm kiếm tức thời và hỗ trợ đơn vị tùy chỉnh.
3. **Cơ chế Tạo nhanh Danh mục (Quick Category Creation)**: Tích hợp ngay cạnh selector Danh mục ở cả form Món bán (`ProductFormModal`) và form Nguyên liệu (`OwnerRawMaterialsPage`), tự động gọi API `ownerMenuApi.createCategory`, tự động gán vào form và đồng bộ danh sách ra trang chính.

---

## 2. Danh sách Files Tác động
- `[TẠO MỚI]` `frontend/src/features/owner-menu/components/SearchableUnitSelect.tsx` (Component chọn đơn vị F&B có search & custom)
- `[TẠO MỚI]` `frontend/src/features/owner-menu/components/CostCalculatorModal.tsx` (hoặc popover máy tính giá vốn bình quân gia quyền)
- `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerRawMaterialsPage.tsx` (Tích hợp máy tính giá vốn, searchable unit select, tạo nhanh danh mục nguyên liệu)
- `[CHỈNH SỬA]` `frontend/src/features/owner-menu/components/ProductFormModal.tsx` (Tích hợp tạo nhanh danh mục sản phẩm món bán)
- `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerProductsPage.tsx` (Nhận danh mục mới tạo để cập nhật danh sách sections)
- `[CHỈNH SỬA]` `docs/Developing/logs/DEV_CHANGELOG.md` (Ghi nhận [LOG-030])

---

## 3. Các bước triển khai tuần tự

### Bước 1: Xây dựng `SearchableUnitSelect.tsx`
- Thiết kế danh mục đơn vị phân theo nhóm:
  - Khối lượng: `g`, `kg`, `mg`, `oz`
  - Thể tích: `ml`, `l`, `cl`
  - Đóng gói: `lon`, `hop`, `chai`, `goi`, `tui`, `bao`, `thung`, `binh`, `hu`, `cay`
  - Định lượng F&B: `qua`, `lat`, `tep`, `la`, `vien`, `shot`, `pump`, `muong`, `ly`, `cai`
- Dropdown có ô search gõ tìm kiếm ký hiệu hoặc tên (ví dụ: gõ "siro" ra "pump", gõ "gr" ra "g").
- Nếu gõ từ khóa không có trong danh mục: Cho phép bấm "Dùng đơn vị tùy chỉnh '[Từ khóa]'".

### Bước 2: Xây dựng `CostCalculatorTool` (Máy tính Giá vốn Bình quân Gia quyền)
- Nhúng trực tiếp vào form Thêm / Sửa nguyên liệu với nút bấm bật/tắt trang nhã "🧮 Máy tính giá vốn / Bình quân lô nhập".
- Chế độ 1: Quy đổi gói/bao mua về:
  - Tổng số tiền mua (VNĐ)
  - Số lượng đóng gói + Đơn vị đóng gói (hoặc số lượng quy đổi ra đơn vị tính)
  - $\rightarrow$ Kết quả: `Giá vốn = Tổng tiền / Số lượng quy đổi`. Nút bấm "Áp dụng vào giá vốn".
- Chế độ 2: Bình quân gia quyền tồn kho (Weighted Average Cost):
  - Tồn kho hiện tại: Số lượng tồn + Giá vốn cũ
  - Lô nhập mới: Số lượng nhập mới + Giá nhập mới / đơn vị (hoặc tổng tiền nhập đợt này)
  - $\rightarrow$ Công thức: $(\text{Tồn} \times \text{Giá cũ} + \text{Nhập} \times \text{Giá mới}) / (\text{Tồn} + \text{Nhập})$
  - Hiển thị kết quả bình quân rõ ràng $\rightarrow$ Nút bấm "Áp dụng giá bình quân".

### Bước 3: Tích hợp Cơ chế Tạo nhanh Danh mục (Quick-create Category)
- Trong `OwnerRawMaterialsPage.tsx`: Cạnh dropdown Danh mục có nút `+ Tạo nhanh`. Bấm vào hiển thị ô nhập tên danh mục ngay tại chỗ (inline hoặc popover) + nút Lưu. Nhấn Enter gọi `ownerMenuApi.createCategory({ name, scope: 'raw_material' })`. Tạo thành công tự set `categoryId = String(newCat.id)`.
- Trong `ProductFormModal.tsx`: Tương tự, có nút `+ Tạo nhanh danh mục` cạnh dropdown Danh mục, tạo với `scope: 'product'`, tự động set `categoryId` và trigger callback `onCategoryCreated` để `OwnerProductsPage` tạo thêm section mới tức thì.

### Bước 4: Kiểm thử, Nghiệm thu Browser & Ghi Log
- `npx tsc --noEmit` đảm bảo 0 lỗi type.
- Kiểm tra bằng Trình duyệt: Test tạo nhanh danh mục, test máy tính giá vốn quy đổi, test đơn vị tính search.
- Ghi nhận `[LOG-030]` vào `DEV_CHANGELOG.md`.

---

## 4. Quản trị Rủi ro & Rollback
- Giữ nguyên các hàm API hiện hữu (`ownerMenuApi.createCategory`, `ownerMenuApi.createIngredient`).
- Ô Giá vốn vẫn giữ dạng input number trực tiếp, máy tính chỉ là công cụ hỗ trợ tính toán và tự điền giúp người dùng, không can thiệp ép buộc lưu vết nếu người dùng không muốn.

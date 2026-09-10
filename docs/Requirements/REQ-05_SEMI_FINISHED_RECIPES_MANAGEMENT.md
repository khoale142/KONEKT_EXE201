# REQ-05: ĐỊNH LƯỢNG CÔNG THỨC BÁN THÀNH PHẨM TỪ NGUYÊN LIỆU (SEMI-FINISHED GOODS RECIPES / SUB-BOM)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Tác giả**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Chờ duyệt (Pending Review)

---

## 1. MỤC TIÊU & BỐI CẢNH (OBJECTIVE & CONTEXT)
* **Vấn đề thực tế trong ngành F&B (Cafe / Bar / Trà sữa)**:
  1. Trong hoạt động quán cà phê, hầu hết các đồ uống không được pha chế trực tiếp 100% từ nguyên vật liệu thô đơn lẻ, mà sử dụng các **Bán thành phẩm sơ chế sẵn (Semi-Finished Goods / Prep Items)**:
     - *Ví dụ 1*: Cốt cà phê phin đậm đặc (ủ từ 500g hạt cà phê + 1200ml nước sôi $\rightarrow$ thu được 800ml nước cốt cà phê).
     - *Ví dụ 2*: Kem Macchiato / Cheese Foam (đánh từ 250ml kem béo Rich's + 100ml sữa tươi + 20g bột cheese $\rightarrow$ thu được 350ml kem).
     - *Ví dụ 3*: Nước đường nấu (Simple Syrup 1:1 từ 1000g đường cát + 1000ml nước sôi $\rightarrow$ thu được 1600ml nước đường).
     - *Ví dụ 4*: Trà lài ủ lạnh (Cold brew jasmine tea), Trân châu đen luộc ngâm đường đen, Sốt dâu tây tươi,...
  2. Hiện tại, hệ thống đã phân loại nguyên vật liệu thành `Nguyên liệu thô` và `Bán thành phẩm` (dựa trên quy ước mã/tên), nhưng **chưa cho phép khai báo công thức sơ chế (BOM) cho Bán thành phẩm**.
  3. Giá vốn `costPerUnit` của Bán thành phẩm hiện đang phải nhập tay thủ công hoặc bằng 0, dẫn đến:
     - Giá vốn BTP không phản ánh đúng biến động giá của nguyên vật liệu thô cấu thành.
     - Khi giá hạt cà phê hay sữa tăng/giảm, chủ quán không biết giá vốn cốt cà phê hay kem cheese thay đổi thế nào.
     - Báo cáo Food Cost và Biên lợi nhuận % của các sản phẩm bán lẻ (cà phê sữa, trà đào macchiato) bị thiếu chính xác.
* **Mục tiêu**:
  1. Cho phép Chủ quán (Owner) thiết lập **Công thức sơ chế (BOM)** cho từng Bán thành phẩm:
     - Khai báo **Sản lượng định mức 1 mẻ (Batch Yield)**: Số lượng thành phẩm thu được sau quá trình sơ chế (ví dụ: 1 mẻ cốt cafe thu được 800 ml).
     - Khai báo danh sách các **Nguyên liệu thô cấu thành** kèm khối lượng/dung tích sử dụng và tỷ lệ hao hụt (%) trong quá trình sơ chế/chiết xuất.
  2. Hệ thống **tự động tính toán tổng chi phí mẻ sơ chế và đơn giá vốn (Cost Per Unit)**:
     $$\text{Đơn giá vốn BTP (VNĐ / đơn vị)} = \frac{\sum (\text{Khối lượng NVL}_i \times \text{Đơn giá NVL}_i \times (1 + \text{Tỷ lệ hao hụt}_i \%))}{\text{Sản lượng định mức 1 mẻ (Batch Yield)}}$$
  3. **Tự động liên kết & kế thừa vào Món bán lẻ**: Khi cập nhật công thức sơ chế BTP, giá vốn BTP sẽ tự động cập nhật và phản ánh trực tiếp vào Food Cost của tất cả đồ uống bán lẻ sử dụng BTP đó.

---

## 2. USER STORIES
1. **Là một Chủ quán (Owner)**:
   - Tôi muốn vào mục Bán thành phẩm trong menu quản lý kho/nguyên liệu, chọn một bán thành phẩm (ví dụ "Cốt Cà Phê Phin") và bấm "Công thức sơ chế (BOM)".
   - Tôi muốn nhập sản lượng của một mẻ sơ chế (ví dụ 800 ml) và chọn các nguyên liệu thô đầu vào (ví dụ 500g Cà phê hạt Robusta xay, tỷ lệ hao hụt 5%).
   - Tôi muốn hệ thống hiển thị ngay tức thời:
     - Tổng chi phí để làm 1 mẻ (ví dụ 75,000 đ).
     - Giá vốn trên từng ml thành phẩm (ví dụ 93.75 đ/ml).
   - Tôi muốn lưu công thức và thấy giá vốn của Bán thành phẩm được tự động cập nhật ngay trên danh sách vật tư.
   - Khi tôi mở công thức món "Cà phê sữa đá", hệ thống tự động tính chi phí 40ml cốt cà phê theo giá vốn vừa sơ chế.

2. **Là một Quản lý / Bếp trưởng (Barista Manager)**:
   - Tôi muốn có quy chuẩn công thức sơ chế rõ ràng để nhân viên pha chế thực hiện đúng định lượng, kiểm soát thất thoát và duy trì chất lượng đồ uống đồng nhất.

---

## 3. PHẠM VI (SCOPE OF WORK)

### In-Scope:
1. **Database Schema (Supabase PostgreSQL via Drizzle ORM)**:
   - Mở rộng bảng `ingredients`:
     - Bổ sung `item_type`: varchar(30) default `'raw'` not null (`'raw'` | `'semi_finished'`).
     - Bổ sung `batch_yield`: numeric(12, 3) default '1' not null (Sản lượng đầu ra của 1 mẻ chuẩn).
   - Tạo bảng mới `semi_finished_recipes` (Định lượng công thức Bán thành phẩm):
     - `id`: serial primary key
     - `tenant_id`: integer references tenants(id) on delete cascade not null
     - `semi_finished_id`: integer references ingredients(id) on delete cascade not null (ID của bán thành phẩm mẹ)
     - `ingredient_id`: integer references ingredients(id) on delete cascade not null (ID của nguyên liệu thô con)
     - `quantity`: numeric(12, 3) not null (Khối lượng/dung tích sử dụng)
     - `unit`: varchar(50) not null (Đơn vị tính)
     - `waste_rate_percent`: numeric(5, 2) default '0' (Hao hụt sơ chế %)
     - `created_at`, `updated_at`: timestamp with time zone
     - Ràng buộc: `UNIQUE(semi_finished_id, ingredient_id)` chống khai báo trùng nguyên liệu trong 1 mẻ.
     - Indexes: `idx_semi_recipes_tenant`, `idx_semi_recipes_parent`, `idx_semi_recipes_child`.
2. **Backend Services & API**:
   - `GET /api/v1/owner/menu/ingredients`:
     - Trả về danh sách vật tư kèm cờ `itemType`, `batchYield`, `hasRecipe` (đã có công thức sơ chế chưa), `recipeItemCount`.
   - `POST /api/v1/owner/menu/ingredients`:
     - Tiếp nhận `itemType`, `batchYield`.
   - `PUT /api/v1/owner/menu/ingredients/:id`:
     - Cập nhật thông tin BTP kèm `batchYield`.
   - `GET /api/v1/owner/menu/ingredients/:id/recipe`:
     - Lấy thông tin công thức sơ chế của BTP: danh sách nguyên liệu thành phần, đơn vị, đơn giá nguyên liệu, hao hụt, tổng chi phí mẻ và giá vốn đơn vị tính toán.
   - `PUT /api/v1/owner/menu/ingredients/:id/recipe`:
     - Lưu công thức sơ chế của BTP, tự động tính tổng tiền mẻ chia cho `batchYield` và cập nhật trực tiếp `ingredients.cost_per_unit`.
3. **Frontend UI/UX (KONEKT Design System)**:
   - **Bảng Danh mục Vật tư (`OwnerIngredientsTab.tsx`)**:
     - Hiển thị cột / nút "Công thức sơ chế (BOM)" dành riêng cho các dòng Bán thành phẩm.
     - Trạng thái rõ ràng:
       - Nếu đã có BOM: Badge xanh rêu "Đã có BOM (X NVL)" + nút xem/sửa công thức.
       - Nếu chưa có: Nút viền đứt nét màu nâu hổ phách "+ Thiết lập BOM".
   - **Modal Công thức Sơ chế Bán thành phẩm (`SemiFinishedRecipeModal.tsx`)**:
     - Thiết kế chuẩn palette `#3D503C` & `#FEF8EE`, bo góc, bóng mờ cao cấp, không dùng icon/emoji ngoài lucide-react.
     - Header: Tên BTP, mã quản lý, đơn vị tính đầu ra.
     - Khu vực sản lượng mẻ (Batch Yield): Nhập số lượng thành phẩm thu được (ví dụ: 1000 ml).
     - Bảng ma trận nguyên liệu đầu vào:
       - Chọn nguyên vật liệu (chỉ hiện các nguyên liệu thô / nguyên liệu khác, loại trừ chính BTP đó để tránh đệ quy vòng tròn).
       - Nhập khối lượng định lượng (`quantity`).
       - Nhập % hao hụt sơ chế (`wasteRatePercent`).
       - Hiển thị đơn giá NVL & thành tiền dòng tức thời.
     - Thẻ KPI Tài chính trực quan (Financial Summary Card):
       - Tổng chi phí 1 mẻ (Total Batch Cost - đ).
       - Giá vốn đơn vị chuẩn (Cost Per Unit - đ / ml hoặc đ / g).
       - Hướng dẫn công thức tính minh bạch.
     - Nút "Lưu công thức & Tự động cập nhật giá vốn".

### Out-of-Scope:
- Lệnh xuất kho sản xuất / batch cooking work orders (lập phiếu sơ chế trừ kho NVL thô và cộng kho BTP - tính năng này thuộc phân hệ Kho nâng cao ở giai đoạn sau).
- Tính khấu hao máy móc / nhân công vào giá mẻ (chỉ tính chi phí nguyên vật liệu trực tiếp - Direct Material Cost theo thông lệ F&B).

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
- [ ] Bổ sung trường `item_type`, `batch_yield` vào bảng `ingredients` và bảng `semi_finished_recipes` trên Supabase database.
- [ ] API backend hỗ trợ lấy và lưu công thức BTP, tự động tính `cost_per_unit = totalCost / batchYield`.
- [ ] Danh sách Bán thành phẩm trong giao diện Chủ quán hiển thị trạng thái công thức và nút mở modal BOM.
- [ ] Modal `SemiFinishedRecipeModal` hiển thị bảng thêm/xóa nguyên liệu, tự động tính toán tổng tiền và giá vốn đơn vị theo thời gian thực (real-time reactive UI).
- [ ] Khi lưu công thức BTP, giá vốn mới hiển thị ngay trên bảng danh sách vật tư mà không cần reload trang.
- [ ] Khi chỉnh sửa hoặc xem công thức sản phẩm đồ uống (như Cà phê sữa đá), giá vốn của thành phần BTP được lấy từ giá vốn vừa tính toán.
- [ ] Type-check `tsc --noEmit` đạt 0 lỗi trên cả Frontend và Backend.

# REQ-03: PHÂN HỆ QUẢN LÝ THỰC ĐƠN & ĐỊNH LƯỢNG CÔNG THỨC (OWNER MENU & RECIPE MANAGEMENT)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Tác giả**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Chờ duyệt (Pending Review)

---

## 1. MỤC TIÊU & BỐI CẢNH (OBJECTIVE & CONTEXT)
* **Vấn đề hiện tại**:
  1. Chủ quán (Owner) hiện chưa có tính năng quản lý danh mục món ăn, sản phẩm và biến thể (size, giá phụ thu, trạng thái bán) trong giao diện quản trị `OfficeWorkspaceLayout`.
  2. Trước đây các API menu cũ bị gán nhầm vào module Marketing (`/api/marketing/menu`), truy vấn hardcode schema cũ (`coffee_chain_db`) vốn không còn tồn tại trên Supabase, đồng thời phân quyền chặn vai trò `owner`.
  3. Hệ thống hoàn toàn thiếu phân hệ **Công thức pha chế & Định lượng nguyên vật liệu (Bill of Materials - BOM / Recipe)**, dẫn đến việc không thể tính toán Cost món (Food Cost / COGS) và không thể trừ kho nguyên liệu tự động khi thu ngân thanh toán đơn hàng tại POS hoặc đơn online.
* **Mục tiêu**:
  1. Chuyển đổi và tập trung hóa toàn bộ quyền quản trị Thực đơn (Menu) về cho **Chủ quán (Owner)** và **Quản lý (Store Manager)** trực thuộc từng thương hiệu (`tenant_id`).
  2. Xây dựng phân hệ Quản lý Công thức & Nguyên vật liệu định lượng (Recipes & Ingredients), cho phép định nghĩa từng thành phần nguyên liệu (g, ml, quả, gói) cho từng món/size.
  3. Đồng bộ hóa nguồn dữ liệu Thực đơn cho POS, đảm bảo POS tải menu trực tiếp từ database Supabase với 100% Type-safety qua Drizzle ORM.

---

## 2. USER STORIES
1. **Là một Chủ quán (Owner)**:
   - Tôi muốn tạo mới, chỉnh sửa và quản lý các danh mục món (Cà phê, Trà, Bánh ngọt, Topping,...) để sắp xếp thực đơn khoa học.
   - Tôi muốn thêm sản phẩm mới kèm ảnh, giá cơ bản, mô tả và các size/biến thể (Size S, M, L) với giá phụ thu tùy chỉnh.
   - Tôi muốn thiết lập công thức định lượng (Recipe / BOM) cho từng món: khai báo cần bao nhiêu gam cà phê, bao nhiêu ml sữa tươi, sữa đặc... để hệ thống tính giá vốn (Cost Price) và biên lợi nhuận (Profit Margin %).
   - Tôi muốn bật/tắt trạng thái món (Đang bán / Hết hàng tạm thời) nhanh chóng ngay trên bảng điều khiển.
2. **Là một Nhân viên Thu ngân / Quản lý POS**:
   - Tôi muốn danh mục món và giá trên máy POS luôn đồng bộ tức thì theo thiết lập của Chủ quán.

---

## 3. PHẠM VI (SCOPE OF WORK)

### In-Scope:
1. **Database Schema (Supabase & Drizzle ORM)**:
   - Bổ sung bảng `ingredients`: Danh mục nguyên vật liệu dùng để pha chế (`id`, `tenant_id`, `name`, `code`, `unit` (g, ml, quả,...), `cost_per_unit`, `is_active`).
   - Bổ sung bảng `product_recipes`: Định lượng công thức (`id`, `tenant_id`, `product_id`, `variant_id`, `ingredient_id`, `quantity`, `unit`, `waste_rate_percent`).
   - Tối ưu hóa Database: Đánh Unique Composite Index `(product_id, variant_id, ingredient_id)` chống trùng lặp, index `(product_id, variant_id)` phục vụ trừ kho tức thời khi POS bán hàng.
2. **Backend API (`/api/owner/menu`)**:
   - CRUD Danh mục (`/api/owner/menu/categories`).
   - CRUD Sản phẩm & Biến thể (`/api/owner/menu/products`, `/toggle-status`).
   - Quản lý Nguyên vật liệu & Công thức định lượng (`/api/owner/menu/ingredients`, `/api/owner/menu/products/:id/recipes`).
   - Hỗ trợ lưu trữ Ma trận công thức đa kích cỡ: Nhận danh sách bóc tách chi tiết theo từng `variantId`.
   - Chuẩn hóa endpoint POS Menu (`/api/pos/menu`) truy vấn theo `tenant_id` từ Drizzle ORM.
3. **Frontend UI/UX (KONEKT Design System)**:
   - **Ma trận Công thức dạng Bảng (Recipe Matrix Table)**:
     - **Cột**: Các kích cỡ của món (Size S, Size M, Size L,... hiển thị kèm phụ thu và giá bán).
     - **Hàng**: Danh sách nguyên vật liệu thành phần (Hạt cafe, Sữa đặc, Sữa tươi,...).
     - **Ô giao nhau**: Ô nhập số lượng (g/ml) cho từng size kèm hiển thị tiền vốn tức thời.
     - **Chân bảng (Footer Metrics)**:
       - Hàng **Tổng Food Cost** tính riêng cho từng Size.
       - Hàng **Giá bán niêm yết** của từng Size.
       - Hàng **Biên lợi nhuận % (Margin)** riêng cho từng Size với cảnh báo màu trực quan.
   - Thêm tiện ích sao chép / tự động điền nhanh theo hệ số tỷ lệ size.
   - Màn hình Sổ tay Công thức (`/office/menu/recipes`) hiển thị dạng ma trận trực quan cho từng món.

### Out-of-Scope:
- Tính năng tự động trừ kho vật lý tức thời khi hoàn thành đơn (sẽ triển khai trong đợt đồng bộ KDS/POS tiếp theo).
- Chức năng Báo cáo (`/office/reports/*`) vẫn tạm hoãn theo chỉ đạo của User.

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
- [x] Chủ quán đăng nhập có thể thấy mục "Thực đơn & Món", "Công thức pha chế" trong thanh Sidebar Xanh rêu.
- [x] Owner có thể tạo món mới kèm hình ảnh, danh mục và các size khác nhau.
- [ ] Giao diện định lượng công thức hiển thị dưới dạng **Bảng Ma trận (Cột = Các Size, Hàng = Các Nguyên liệu)**.
- [ ] Nhập định lượng khác nhau cho từng Size (ví dụ: Size S dùng 20g cafe, Size M dùng 25g, Size L dùng 35g).
- [ ] Dưới mỗi cột Size tự động tính riêng: Tổng Food Cost, Giá bán và Biên lợi nhuận % (Margin) của Size đó.
- [ ] Tối ưu hóa Database: Đánh index ràng buộc toàn vẹn dữ liệu cho `(product_id, variant_id, ingredient_id)`.
- [x] POS tải menu thành công từ dữ liệu thật của Tenant trên Supabase (không còn lỗi `coffee_chain_db`).
- [ ] `tsc && vite build` và backend typecheck đều pass 100% với 0 lỗi.

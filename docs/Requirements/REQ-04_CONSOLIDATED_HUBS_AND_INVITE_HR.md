# REQ-04: HỢP NHẤT MENU CHỦ QUÁN THÀNH 5 HUB NGHIỆP VỤ & TINH CHỈNH PHÂN HỆ QUẢN LÝ NHÂN SỰ THEO MÃ MỜI NỘI BỘ (CONSOLIDATED HUBS ARCHITECTURE & STORE INVITE HR)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Tác giả**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Đã duyệt (Approved by User)

---

## 1. MỤC TIÊU & BỐI CẢNH (OBJECTIVE & CONTEXT)
* **Vấn đề hiện tại**:
  1. **Menu Owner phân mảnh quá tải**: Menu của Chủ quán (Owner) trong `OfficeWorkspaceLayout` trước đây phình to đến 23 mục riêng lẻ, trải dài qua nhiều phân hệ (Sản phẩm, Công thức, Hàng hủy, Kiểm hàng ca, Nhập hàng, Combo, Voucher, Bài viết, CSKH,...). Điều này khiến người dùng bị quá tải thông tin, khó thao tác và không tập trung vào luồng vận hành cốt lõi.
  2. **Các tính năng ngoài scope**: Một số trang như nội dung tiếp thị (`marketing/contents`), tạo bài viết (`marketing/articles`), chăm sóc khách hàng/khiếu nại (`marketing/complaints`) đang tạm thời nằm ngoài scope hiện tại do phân hệ khách hàng (Customer Zone) chưa được ưu tiên ở giai đoạn này.
  3. **Quy trình Nhân sự cũ không còn phù hợp**: Trước đây, nhân sự do quản lý chi nhánh tuyển dụng nội bộ rồi gửi yêu cầu tuyển / sa thải lên Owner (`/office/hr/requests`). Hiện tại, quy trình thực tế đã chuyển sang: ứng viên tham gia bằng **Mã mời nội bộ (`invite_code`)** của từng cơ sở, tự gửi request để Owner duyệt, phân vai trò (`store_manager` vs `staff`) và cấp quyền tùy chỉnh (`can_manage_staff`, `can_manage_menu`, `can_manage_inventory`, `can_view_reports`). Do đó, luồng yêu cầu tuyển dụng kiểu cũ cần được thay thế hoàn toàn.
* **Mục tiêu**:
  1. **Hợp nhất thanh điều hướng thành 5 Hub Nghiệp Vụ chính (Consolidated Hubs Architecture)**:
     - 📊 `Tổng quan chuỗi`: `/office/dashboard`
     - ☕ `Thực đơn & Định lượng`: `/office/menu` (gồm 4 Tab: Món bán, Nguyên liệu & Bán thành phẩm, Công thức BOM, Danh mục)
     - 📦 `Kho & Quản lý vật tư`: `/office/inventory` (gồm 3 Tab: Tồn kho & Hàng hủy, Duyệt kiểm hàng ca, Nhập xuất vật tư)
     - 🎟️ `Khuyến mãi & Ưu đãi`: `/office/promotions` (gồm 2 Tab: Quy tắc Combo, Voucher & Ưu đãi hóa đơn)
     - 👥 `Quản lý nhân sự`: `/office/hr` (gồm 5 Tab: Duyệt mã mời có badge đếm số lượng, Danh sách nhân sự, Lịch ca, Chấm công, Bảng lương)
  2. **Loại bỏ các mục ngoài scope** khỏi sidebar điều hướng của Owner.
  3. **Đảm bảo 100% tương thích ngược (Zero 404)**: Mọi đường dẫn con cũ (như `/office/menu/products`, `/office/menu/recipes`, `/office/dm/inventory-waste`, `/office/hr/staff-requests`,...) tự động redirect về Hub tương ứng và kích hoạt đúng Tab qua query param `?tab=...`.
  4. **Tuân thủ quy chuẩn thiết kế KONEKT**: Sử dụng bảng màu Xanh rêu đậm (`#2B402D`, `#364D39`) & Kem ngà (`#FAF6F3`, `#F4EFEB`), 100% icon React Lucide, loại bỏ emoji, áp dụng haptic micro-interactions theo bộ `taste-skill`.

---

## 2. USER STORIES
1. **Là một Chủ quán (Owner)**:
   - Tôi muốn thanh menu của mình thật tinh gọn (chỉ 5 mục chính) để dễ dàng kiểm soát chuỗi cửa hàng mà không bị hoa mắt.
   - Tôi muốn vào trang Thực đơn (`/office/menu`) là có thể chuyển đổi nhanh giữa Sản phẩm, Nguyên liệu & Bán thành phẩm sơ chế, Sổ tay công thức BOM và Danh mục món bằng các Tab mượt mà.
   - Tôi muốn xem và quản lý danh mục Nguyên vật liệu thô vs Bán thành phẩm sơ chế (cốt cafe phin, sốt tự nấu, syrup nhà làm), theo dõi giá vốn đơn vị và ngưỡng tồn an toàn.
   - Tôi muốn vào trang Kho (`/office/inventory`) là theo dõi được cả Tồn kho/Hủy hàng, Duyệt kiểm hàng ca và Phiếu nhập vật tư mà không phải nhảy qua nhiều trang rời rạc.
   - Tôi muốn vào trang Khuyến mãi (`/office/promotions`) là quản lý được cả Combo bán kèm và Mã voucher giảm giá.
   - Tôi muốn thấy ngay Badge số lượng ứng viên nhập mã mời đang chờ duyệt ngay trên mục "Quản lý nhân sự" ở Sidebar để xử lý kịp thời.
   - Tôi muốn khi duyệt ứng viên mã mời có thể phân vai trò (`Quản lý cửa hàng` hoặc `Nhân viên`) và bật/tắt các quyền hạn linh hoạt (như quyền duyệt nhân sự cấp dưới, sửa menu, quản lý kho, xem báo cáo).
2. **Là một Nhân viên hoặc Quản lý chi nhánh**:
   - Tôi muốn khi nhập mã mời chi nhánh thì yêu cầu của tôi được gửi thẳng tới bảng điều khiển của Chủ quán để được duyệt nhanh chóng.

---

## 3. PHẠM VI (SCOPE OF WORK)

### In-Scope:
1. **Tái cấu trúc Sidebar Menu (`OfficeWorkspaceLayout.tsx`)**:
   - Rút gọn `ALL_NAV` từ 23 mục xuống 5 Hub chính.
   - Cập nhật hàm `isNavActive` để duy trì active highlight khi user duyệt các tab con hoặc truy cập route cũ.
   - Tích hợp gọi API `workspaceApi.getStaffRequests()` lấy số lượng yêu cầu pending để hiển thị Badge cam nổi bật cạnh mục "Quản lý nhân sự".
2. **Xây dựng 4 Hub Pages và các Component Tab mới**:
   - `frontend/src/features/owner-menu/pages/OwnerMenuHubPage.tsx` (Menu & BOM Hub)
   - `frontend/src/features/owner-menu/components/OwnerIngredientsTab.tsx` (Tab Nguyên liệu thô vs Bán thành phẩm sơ chế)
   - `frontend/src/features/owner-inventory/pages/OwnerInventoryHubPage.tsx` (Inventory Hub)
   - `frontend/src/features/owner-promotions/pages/OwnerPromotionsHubPage.tsx` (Promotions Hub)
   - `frontend/src/features/office/hr/pages/OwnerHRHubPage.tsx` (HR Hub)
3. **Nâng cấp Phân hệ Quản lý Nhân sự**:
   - Cải tiến `StaffJoinRequestsPage.tsx`: Bổ sung bộ lọc trạng thái (Tất cả, Chờ xử lý, Đã duyệt, Đã từ chối), thống kê đếm số lượng, modal phân quyền granular.
   - Cải tiến `HREmployeesPage.tsx`: Thêm banner cảnh báo khi có ứng viên chờ duyệt và nút tắt chuyển nhanh sang tab duyệt.
4. **Cấu hình Router & Tương thích ngược (`router/index.tsx`)**:
   - Đăng ký các route Hub mới.
   - Thiết lập `<Navigate to="...?tab=..." replace />` cho toàn bộ các route cũ.
   - Purge các import thừa, đảm bảo 0 lỗi TypeScript.

### Out-of-Scope:
- Phân hệ Marketing nội dung bài viết và chăm sóc khách hàng thành viên (Customer portal) tạm hoãn, không đưa vào menu Owner.
- Tự động trừ kho nguyên liệu vật lý khi POS bán hàng (sẽ triển khai trong đợt đồng bộ tiếp theo).

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
- [x] Thanh Sidebar của Owner chỉ còn đúng 5 mục: Tổng quan chuỗi, Thực đơn & Định lượng, Kho & Quản lý vật tư, Khuyến mãi & Ưu đãi, Quản lý nhân sự.
- [x] Mục Quản lý nhân sự trên Sidebar có Badge hiển thị số lượng yêu cầu pending từ mã mời nội bộ.
- [x] Trang `/office/menu` hỗ trợ chuyển đổi 4 Tab: Món bán, Nguyên liệu & Bán thành phẩm, Công thức BOM, Danh mục món.
- [x] Tab Nguyên liệu & Bán thành phẩm (`OwnerIngredientsTab.tsx`) hiển thị bộ lọc phân loại "Nguyên liệu thô" vs "Bán thành phẩm sơ chế", quản lý đơn vị tính, giá vốn và mức tồn an toàn.
- [x] Trang `/office/inventory` hỗ trợ chuyển đổi 3 Tab: Tồn kho & Hàng hủy, Duyệt kiểm hàng ca, Nhập xuất vật tư.
- [x] Trang `/office/promotions` hỗ trợ chuyển đổi 2 Tab: Quy tắc Combo, Voucher & Ưu đãi.
- [x] Trang `/office/hr` hỗ trợ chuyển đổi 5 Tab: Duyệt nhân sự mã mời, Danh sách nhân sự, Lịch làm việc, Chấm công, Quỹ lương.
- [x] Tất cả các đường dẫn cũ đều tự động chuyển hướng (301/Redirect) đến đúng Hub và đúng Tab thông qua query parameter `?tab=...`.
- [x] Giao diện tuân thủ bảng màu chuẩn KONEKT (Xanh rêu `#2B402D`, Kem ngà `#FAF6F3`, viền `#E8E0D5`), 100% Lucide React icons, không dùng emoji.
- [x] Dự án compile `npx tsc --noEmit` đạt 0 lỗi trên cả Frontend và Backend.

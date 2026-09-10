# ĐẶC TẢ YÊU CẦU: NỀN TẢNG UNIVERSAL CLOUD POS & MÔ HÌNH 1 TÀI KHOẢN ĐA TENANT
**Mã yêu cầu**: `REQ-02`  
**Tiêu đề**: Universal Retail Web POS SaaS, Product Marketing Landing Page & Multi-Tenant Workspace Switcher  
**Trạng thái**: `Approved`  
**Ngày lập**: 08/09/2026  
**Tham chiếu**: [AI_RULES.md](../AI%20Rules/AI_RULES.md), [taste-skill](../../.agents/skills/design-taste-frontend), [high-end-visual-design](../../.agents/skills/high-end-visual-design)

---

## 1. BỐI CẢNH & MỤC TIÊU CHUYỂN ĐỔI (STRATEGIC PIVOT)

### 1.1. Tái định vị Sản phẩm (Universal Cloud POS Platform)
* **Trước đây**: Định vị hạn hẹp trong mô hình "quán cà phê" (kōhī coffee / cafe management).
* **Định hướng mới**: Nền tảng **Universal Web POS & Cloud Retail Platform (KONEKT POS)** hỗ trợ **bất kỳ ngành nghề kinh doanh nào**:
  - Bán lẻ (Thời trang, Mỹ phẩm, Phụ kiện, Cửa hàng tiện lợi, Tạp hóa).
  - Chuỗi dịch vụ (Spa, Salon, Dịch vụ cá nhân).
  - Nhà hàng, Quán ăn, F&B, Take-away.
  - Cửa hàng đồ uống & Đặc sản.

### 1.2. Tách bạch 3 Cổng Truy Cập Riêng Biệt (Three-Tier Portal Separation)
Bỏ hoàn toàn việc gom 4 thẻ cổng vụn vặt trên trang chủ. Tách rõ 3 cổng độc lập:
1. **Cổng Người dùng Hệ thống (Merchant System / Store Workspace)**:
   - Dành cho Chủ cửa hàng (Owner), Quản lý chi nhánh (Store Manager), Nhân viên thu ngân (Staff / Cashier / POS).
   - Truy cập vào Back-office quản trị hoặc màn hình POS bán hàng tại quầy.
2. **Cổng Khách hàng (Customer / Member Portal)**:
   - Tạm thời đóng băng các luồng đặt món online phức tạp và CMS bài viết marketing.
   - Chỉ giữ lại không gian ưu đãi thành viên: **Khuyến mãi (Promotions)** và **Ví Voucher**.
3. **Cổng Nội bộ / Quản trị Nền tảng (Platform Admin Portal)**:
   - Dành cho quản trị viên vận hành nền tảng SaaS chung.

### 1.3. Mô hình 1 Tài Khoản Nhiều Cửa Hàng (1 Account - Multiple Tenants / Workspaces)
* Một người dùng (xác thực bằng Email duy nhất) có thể tham gia vào nhiều Tenant khác nhau với các vai trò linh hoạt:
  - Ở Cửa hàng A: Làm **Owner** (Chủ cửa hàng).
  - Ở Cửa hàng B: Làm **Staff** (Nhân viên thu ngân).
  - Ở Cửa hàng C: Làm **Store Manager** (Quản lý chi nhánh).
* Cho phép người dùng chuyển đổi không gian làm việc (**Workspace / Store Switcher**) ngay trên thanh điều hướng mà không cần đăng xuất.
* Cho phép một tài khoản đã có quyền tự tạo thêm Cửa hàng / Tenant mới bất kỳ lúc nào.

### 1.4. Thiết kế Trang Chủ Kiểu Marketing Phần Mềm SaaS Đẳng Cấp Thế Giới
* Áp dụng triệt để bộ kỹ năng `design-taste-frontend` và `high-end-visual-design`.
* Xây dựng trang chủ tiếp thị SaaS (Product Landing Page) chuẩn mực:
  - Header nổi (Floating Island Header) với navigation tinh tế.
  - Hero Section hoành tráng với bản xem trước Mockup Dashboard hiện đại.
  - Bento Grid giới thiệu các năng lực cốt lõi (Bán hàng POS siêu tốc, Quản lý chuỗi & tồn kho, Báo cáo tài chính P&L, Đa chi nhánh).
  - Bộ định vị giải pháp đa ngành nghề (Universal Retail Solutions).
  - Lời kêu gọi hành động (Call To Action) mạnh mẽ thúc đẩy đăng ký mở cửa hàng.

---

## 2. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA - AC)

### AC-1: Landing Page Tiếp thị Phần Mềm Cao Cấp
- [ ] Trang chủ `/` được thiết kế theo phong cách Landing Page công nghệ SaaS, loại bỏ hoàn toàn các card chọn cổng cũ.
- [ ] Thể hiện rõ định vị Universal POS đa ngành nghề.
- [ ] Visual density và typography cao cấp, không dùng icon ngoài hoặc emoji. 100% sử dụng icon vector siêu nhẹ từ `lucide-react`.
- [ ] Nút CTA rõ ràng: "Đăng Ký Mở Cửa Hàng" (dẫn sang trang đăng ký) và "Đăng Nhập Hệ Thống".

### AC-2: Đăng Nhập & Chuyển Đổi Workspace Đa Tenant
- [ ] Đăng nhập bằng Email + Mật khẩu.
- [ ] Hệ thống tự động truy vấn danh sách tất cả các Tenant mà User đang có quyền tham gia.
- [ ] Nếu User thuộc nhiều Tenant: Hiển thị bộ chuyển đổi **Workspace Switcher** trên Header để chọn hoặc đổi cửa hàng đang làm việc.
- [ ] Cập nhật JWT Token mang đúng `tenantId` và `role` của Tenant đang hoạt động.

### AC-3: Đăng Ký Mở Cửa Hàng Mới Cho Tài Khoản Mới & Cũ
- [ ] Người dùng mới: Nhập Họ tên, Email, Mật khẩu, Tên cửa hàng ➔ Tạo User + Tạo Tenant mới (Owner) ➔ Đăng nhập tức thì không bắt confirm email.
- [ ] Người dùng đã có tài khoản: Có nút "Tạo thêm cửa hàng mới" trong Workspace Switcher ➔ Tạo thêm Tenant mới và liên kết với User đó mà không bị lỗi trùng email.

### AC-4: Tách Bạch 3 Cổng & Bảo Lưu Tính Năng Cũ
- [ ] Giữ nguyên các chức năng Back-office và POS đã có.
- [ ] Các trang đặt món customer / blog marketing được tạm ẩn khỏi menu chính, chỉ giữ lại Khuyến mãi / Voucher.

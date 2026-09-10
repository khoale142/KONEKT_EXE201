# TÁI THIẾT KẾ TRANG CHỦ KONEKT UNIVERSAL CLOUD POS THEO AI RULES & TASTE-SKILLS

## 1. Bối cảnh & Yêu cầu Người Dùng
- Tái cấu trúc trang chủ từ mô hình cafe sang **Universal Cloud POS SaaS (KONEKT POS)** phục vụ đa ngành (Bán lẻ, Dịch vụ, F&B).
- Tách bạch rõ **3 Cổng Truy Cập**: (1) Merchant Portal, (2) Customer Portal (Voucher/Khuyến mãi), (3) Platform Admin.
- Nâng tầm thẩm mỹ đạt chuẩn **Agency $150k+** theo `high-end-visual-design` & `design-taste-frontend`:
  * Sử dụng hình ảnh thương mại thực tế chất lượng cao (đã tạo qua AI: `konekt_pos_hero.jpg`, `konekt_analytics_preview.jpg`, `konekt_industries.jpg`).
  * Tuyệt đối cấm mockup div giả (div-based fake screenshots).
  * Double-Bezel nested architecture cho các card và hero display.
  * Button-in-Button trailing icon pattern cho CTAs.
  * Tuân thủ bảng màu độc quyền Xanh rêu đậm (`#364D39`, `#2A3B2C`, `#1E2C20`) và Kem ngà (`#FAF6F3`, `#F4EFEB`, `#E8E0D5`).
  * 100% Vector icons từ `lucide-react`, tuyệt đối không dùng emoji unicode hoặc icon ngoài.

## 2. Các Thay Đổi Cụ Thể
- `frontend/src/features/auth/pages/PortalSelectPage.tsx`: Viết lại hoàn chỉnh với trải nghiệm Marketing Landing Page cao cấp, tích hợp hình ảnh chụp thực tế và kiến trúc 3 cổng.
- `frontend/src/features/auth/pages/MerchantLoginPage.tsx`: Trang đăng nhập tập trung cho Merchant (Chủ cửa hàng, Quản lý, Nhân viên).
- Cập nhật tài liệu: `docs/Developing/plans/PLAN-02_UNIVERSAL_LANDING_AND_WORKSPACE_SWITCHER.md` và `docs/Developing/logs/DEV_CHANGELOG.md`.

## 3. Kế hoạch Kiểm Thử
- Chạy `npm run build` trên frontend để đảm bảo không có lỗi TypeScript hay cú pháp.
- Kiểm tra hiển thị responsive trên các độ phân giải màn hình.

**Mã kế hoạch**: `PLAN-02`  
**Liên kết Yêu cầu**: [REQ-02_UNIVERSAL_SAAS_POS_AND_MULTI_TENANCY.md](../../Requirements/REQ-02_UNIVERSAL_SAAS_POS_AND_MULTI_TENANCY.md)  
**Trạng thái**: `Pending User Approval`  
**Ngày lập**: 08/09/2026  
**Quy chuẩn áp dụng**: [AI_RULES.md](../../AI%20Rules/AI_RULES.md) (Taste-Skill UI, Lucide-React, 1 Account Multi-Tenant, Supabase No-Email-Confirm, Drizzle ORM)

---

## 1. MỤC TIÊU CỦA ĐỢT THAY ĐỔI
1. **Tái thiết kế Trang Chủ thành Product Marketing Landing Page Đẳng Cấp Thế Giới**:
   - Định vị: **KONEKT POS — Universal Cloud POS & Multi-Tenant Retail Management Platform** (Sử dụng cho bất kỳ ngành nghề nào: Bán lẻ, Cửa hàng tiện lợi, Thời trang, Dịch vụ, F&B,...).
   - Bỏ hoàn toàn giao diện chọn cổng 4 card cũ.
   - Xây dựng trải nghiệm Landing Page tiếp thị phần mềm chuẩn Agency $150k (theo `high-end-visual-design` & `taste-skill`):
     * **Floating Island Header**: Logo KONEKT POS, Tính năng, Giải pháp ngành hàng, Nút Đăng nhập & Đăng ký.
     * **Hero Section**: Headline mạnh mẽ, Double-Bezel Mockup Preview mô phỏng Dashboard thời gian thực, CTA "Bắt Đầu Miễn Phí".
     * **Bento Grid 4 Năng lực Cốt lõi**:
       1. Web POS Bán hàng đa ngành siêu tốc (Hỗ trợ barcode, VietQR động, phím tắt cảm ứng).
       2. Quản lý Chuỗi chi nhánh & Tồn kho thông minh thời gian thực.
       3. Báo cáo Doanh thu & Lợi nhuận P&L trực quan.
       4. Kiến trúc Đa không gian làm việc (Multi-Tenant Workspaces).
     * **Phân hệ Giải pháp Đa Ngành Nghề**: Bán lẻ thời trang, Siêu thị mini, Chuỗi F&B đồ uống, Dịch vụ & Spa.
     * **Khối Quick Demo Tinh tế**: Thu gọn thành 1 panel nhỏ gọn ở chân trang hoặc modal để nghiệm thu 1-chạm mà không phá vỡ tính chuyên nghiệp của trang chủ.
2. **Triển khai Mô hình 1 Tài Khoản Nhiều Cửa Hàng (Multi-Tenant Workspace Switcher)**:
   - Một người dùng (1 Email) có thể tham gia nhiều Tenant với các vai trò khác nhau (Owner tại Tenant A, Staff tại Tenant B).
   - Backend endpoint:
     * `POST /api/auth/login-konekt`: Nhận diện toàn bộ danh sách Tenant của email, trả về danh sách `memberships`.
     * `POST /api/auth/switch-workspace`: Chuyển đổi ngữ cảnh sang Tenant khác, cấp lại JWT mang `tenantId` và `role` mới.
     * `POST /api/auth/create-store`: Cho phép tài khoản đã đăng nhập tự khởi tạo thêm một Tenant/Store mới và trở thành Owner.
   - Frontend component:
     * **Workspace Switcher Dropdown** trên thanh Header: Xem danh sách các cửa hàng của mình, vai trò tại từng quán, chuyển đổi 1-chạm và nút "+ Tạo thêm cửa hàng mới".
3. **Tách bạch 3 Cổng Truy Cập Rõ Ràng**:
   - Cổng 1: **Người dùng hệ thống (System Users / Merchants)**: Đăng nhập tại `/login` ➔ Điều hướng vào Back-office `/office` hoặc POS `/pos/order`.
   - Cổng 2: **Khách hàng (Customer)**: Giữ các trang Khuyến mãi / Voucher (`/discover`, `/promotions`), tạm ẩn các chức năng order online.
   - Cổng 3: **Internal Staff / Platform Admin**: Quản trị nền tảng SaaS.

---

## 2. DANH SÁCH TẬP TIN TÁC ĐỘNG

### Backend:
* `[CHỈNH SỬA]` `backend/src/modules/auth/konektAuth.service.ts`:
  - Nâng cấp `loginKonekt` để trả về danh sách toàn bộ `workspaces: [{ tenantId, tenantName, role, storeId, storeName }]`.
  - Thêm hàm `switchWorkspace(userId, targetTenantId)`.
  - Hỗ trợ `registerOwner` cho cả email đã tồn tại (tạo thêm Tenant mới và liên kết role `owner`).
* `[CHỈNH SỬA]` `backend/src/modules/auth/auth.controller.ts`:
  - Bổ sung `switchWorkspaceHandler` và `createTenantHandler`.
* `[CHỈNH SỬA]` `backend/src/modules/auth/auth.routes.ts`:
  - Bổ sung routes `/switch-workspace`, `/create-tenant`.

### Frontend:
* `[TẠO MỚI]` `frontend/src/features/auth/components/WorkspaceSwitcher.tsx`:
  - Dropdown chuyển đổi giữa các Cửa hàng/Tenant của người dùng trên Header.
* `[CHỈNH SỬA]` `frontend/src/app/store/auth.store.ts`:
  - Thêm `workspaces: WorkspaceItem[]` vào `AuthUser`.
  - Thêm hàm `switchWorkspace(tenantId)` và `setWorkspaces(...)`.
* `[CHỈNH SỬA]` `frontend/src/features/auth/api/auth.api.ts`:
  - Thêm API calls `switchWorkspace`, `createStore`.
* `[TẠO MỚI]` `frontend/src/features/auth/pages/MerchantLoginPage.tsx`:
  - Màn hình đăng nhập hệ thống chuyên nghiệp cho Chủ shop, Quản lý và Nhân viên.
* `[CHỈNH SỬA]` `frontend/src/features/auth/pages/OwnerRegisterPage.tsx`:
  - Chuyển thành "Đăng Ký Khởi Tạo Cửa Hàng Mới (Universal Cloud POS)".
* `[CHỈNH SỬA]` `frontend/src/features/auth/pages/PortalSelectPage.tsx`:
  - Viết lại toàn bộ thành **Product Marketing Landing Page KONEKT Universal Cloud POS** đẳng cấp cao, loại bỏ hoàn toàn 4 card chọn cổng cũ.
* `[CHỈNH SỬA]` `frontend/src/shared/layouts/OfficeWorkspaceLayout.tsx`:
  - Tích hợp `WorkspaceSwitcher` vào Header để Owner/Staff chuyển đổi giữa các quán.
* `[CHỈNH SỬA]` `frontend/src/shared/components/CafeHeader.tsx`:
  - Đồng bộ floating navigation bar và tích hợp `WorkspaceSwitcher`.
* `[CHỈNH SỬA]` `frontend/src/app/router/index.tsx`:
  - Cập nhật route `/login` sang `MerchantLoginPage`.

---

## 3. CÁC BƯỚC THỰC THI CHI TIẾT
1. **Bước 1 (Backend)**: Nâng cấp `konektAuth.service.ts` hỗ trợ Multi-Workspace per Account và endpoint chuyển đổi `switch-workspace`.
2. **Bước 2 (Frontend Store & API)**: Cập nhật `auth.store.ts` và `auth.api.ts` quản lý danh sách workspaces.
3. **Bước 3 (Frontend UI - Landing Page)**: Xây dựng Trang chủ Marketing chuẩn SaaS thế giới với visual preview, bento grid, giải pháp đa ngành, loại bỏ 4 card chọn cổng.
4. **Bước 4 (Frontend UI - Login & Switcher)**: Tạo trang `MerchantLoginPage.tsx`, xây dựng component `WorkspaceSwitcher.tsx` trên Header.
5. **Bước 5 (Kiểm thử & Ghi log)**: Test biên dịch, test tạo 1 account có 2 tenant (1 owner, 1 staff), test chuyển đổi tức thì. Ghi nhận `DEV_CHANGELOG.md`.

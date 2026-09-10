# KẾ HOẠCH HÀNH ĐỘNG: CẢI TỔ TRANG CHỦ & LUỒNG ĐĂNG KÝ MỞ QUÁN (OWNER ONBOARDING)
**Mã kế hoạch**: `PLAN-01B`  
**Liên kết Yêu cầu**: [REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md](../../Requirements/REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md)  
**Trạng thái**: `✅ Executed (LOG-007)`  
**Ngày lập**: 08/09/2026  
**Quy chuẩn áp dụng**: [AI_RULES.md](../../AI%20Rules/AI_RULES.md) (Taste-Skill UI Xanh rêu & Kem ngà, Thư viện Lucide React Icon chuẩn, Supabase No-Email-Confirm, Drizzle ORM)

---

## 1. MỤC TIÊU CỦA ĐỢT THAY ĐỔI
1. **Lột xác diện mạo Trang chủ (PortalSelectPage, Header, Footer)**:
   - Chuyển từ thương hiệu cũ "kōhī coffee" và 4 portal phân mảnh sang thương hiệu chuẩn **KONEKT Cafe Management Platform (Multi-Tenant SaaS Web POS)**.
   - Áp dụng triệt để bộ nhận diện Taste-Skill: Xanh rêu đậm (`#364D39`) & Kem ngà (`#F4EFEB`).
   - Sử dụng 100% thư viện icon JavaScript/React chuẩn (`lucide-react`: `Crown`, `Store`, `Coffee`, `Monitor`, `Smartphone`, `ArrowRight`, `Zap`), tuyệt đối không dùng icon bên ngoài hay emoji.
   - Tái cấu trúc 4 Cổng truy cập theo mô hình phân quyền mới (Owner-Centric):
     * **Chủ thương hiệu (Tenant Owner)**: Quản trị chuỗi & Vào thẳng POS bán hàng.
     * **Quản lý cửa hàng (Store Manager)**: Quản trị chi nhánh, duyệt kho, ca kíp.
     * **Thu ngân & Barista (Staff / POS / KDS)**: Màn hình bán hàng POS & Bếp KDS.
     * **Khách hàng thân thiết (Customer Portal)**: Đặt món online & Tích điểm.
   - Bổ sung **Khu vực Demo 1-Chạm (Quick Demo Access)** ngay trên trang chủ để User bấm 1 nút là vào thẳng tài khoản `owner@cafe.dev`, `manager@cafe.dev`, `staff@cafe.dev` để nghiệm thu tức thì.

2. **Xây dựng Luồng Đăng ký Mở quán Mới (Owner Registration / Onboarding)**:
   - Form Đăng ký mở quán cho Chủ thương hiệu mới (`/register/owner` hoặc modal trực tiếp trên trang chủ).
   - Backend endpoint `POST /api/auth/register-owner`:
     * Tạo `tenants` (tên quán, slug, code, plan 'trial', status 'active').
     * Tạo `stores` (Chi nhánh chính đầu tiên).
     * Tạo `users` (role 'owner', password hash bcrypt, tenant_id).
     * **Lưu ý đặc biệt**: Không bắt buộc xác thực email (User đã tắt Confirm Email trên Supabase).
     * Ký JWT và trả về thông tin đăng nhập tự động đưa Owner vào ngay Dashboard Quản trị.

3. **Backend Auth tương thích Drizzle Schema**:
   - Thêm endpoint `POST /api/auth/login-konekt` và `POST /api/auth/demo-login` xác thực trực tiếp qua bảng `users` Drizzle ORM để đăng nhập mượt mà cho tài khoản Owner/Manager/Staff mới và cũ.

---

## 2. DANH SÁCH TẬP TIN TÁC ĐỘNG

### Backend:
* `[TẠO MỚI]` `backend/src/modules/auth/konektAuth.service.ts` (Logic đăng ký Owner, đăng nhập ORM, demo login không cần confirm email)
* `[CHỈNH SỬA]` `backend/src/modules/auth/auth.routes.ts` (Gắn routes `/register-owner`, `/login-konekt`, `/demo-login`)
* `[CHỈNH SỬA]` `backend/src/modules/auth/auth.controller.ts` (Thêm handlers cho các endpoint mới)

### Frontend:
* `[CHỈNH SỬA]` `frontend/src/shared/components/CafeHeader.tsx` (Đổi logo & tên sang KONEKT Coffee Platform)
* `[CHỈNH SỬA]` `frontend/src/shared/components/CafeFooter.tsx` (Đổi copyright & tên sang KONEKT Coffee Platform)
* `[CHỈNH SỬA]` `frontend/src/features/auth/pages/PortalSelectPage.tsx` (Trang chủ mới chuẩn KONEKT SaaS Web POS + Demo 1-chạm)
* `[TẠO MỚI]` `frontend/src/features/auth/pages/OwnerRegisterPage.tsx` (Trang đăng ký mở quán dành cho Chủ thương hiệu)
* `[CHỈNH SỬA]` `frontend/src/app/router/index.tsx` (Thêm route `/register/owner`)
* `[CHỈNH SỬA]` `frontend/src/features/auth/api/auth.api.ts` (Bổ sung hàm `registerOwner`, `loginKonekt`, `demoLogin`)

---

## 3. CÁC BƯỚC THỰC THI CHI TIẾT
1. Tạo backend service & controller cho `register-owner`, `login-konekt`, `demo-login`.
2. Tạo giao diện trang chủ `PortalSelectPage.tsx` mới với phong cách sang trọng KONEKT + Demo 1-chạm.
3. Tạo form `OwnerRegisterPage.tsx` với trải nghiệm đăng ký mượt mà không cần OTP/confirm email.
4. Cập nhật `CafeHeader.tsx` và `CafeFooter.tsx`.
5. Kiểm thử luồng Đăng ký mới ➔ Chuyển Dashboard Office ➔ Bấm "Mở POS Bán Hàng" ➔ Chuyển `/pos/order`.

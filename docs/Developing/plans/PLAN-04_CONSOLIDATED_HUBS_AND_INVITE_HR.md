# PLAN-04: KẾ HOẠCH HỢP NHẤT MENU CHỦ QUÁN THÀNH 5 HUB NGHIỆP VỤ & TINH CHỈNH PHÂN HỆ QUẢN LÝ NHÂN SỰ THEO MÃ MỜI NỘI BỘ
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Tác giả**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Đã được User phê duyệt (Approved) & Hoàn thành thực thi (Implemented)

---

## 1. MỤC TIÊU CỤ THỂ
1. Hợp nhất thanh sidebar của Chủ quán (Owner) từ 23 mục rời rạc thành cấu trúc **5 Hub Nghiệp Vụ thống nhất**:
   - `Tổng quan chuỗi`: `/office/dashboard`
   - `Thực đơn & Định lượng`: `/office/menu`
   - `Kho & Quản lý vật tư`: `/office/inventory`
   - `Khuyến mãi & Ưu đãi`: `/office/promotions`
   - `Quản lý nhân sự`: `/office/hr` (tích hợp Badge đếm số lượng pending request từ mã mời)
2. Tinh chỉnh phân hệ Quản lý Nhân sự chuyển đổi hoàn toàn sang mô hình **Mã mời nội bộ (`invite_code`)**, nơi ứng viên tự đăng ký và Owner phê duyệt trực tiếp kèm phân quyền chi tiết (`can_manage_staff`, `can_manage_menu`, `can_manage_inventory`, `can_view_reports`).
3. Đảm bảo **100% Tương thích ngược**: Tất cả các URL cũ (`/office/menu/products`, `/office/menu/recipes`, `/office/dm/inventory-waste`, `/office/hr/staff-requests`, v.v.) tự động redirect về Hub tương ứng kèm tham số `?tab=...`.
4. Tuân thủ triệt để bộ `taste-skill` (`design-taste-frontend`, `minimalist-ui`, `high-end-visual-design`) và quy chuẩn KONEKT (Xanh rêu `#2B402D`, Kem ngà `#FAF6F3`, viền `#E8E0D5`, 100% React Lucide Icons, không dùng emoji).

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### A. Tạo mới (`[TẠO MỚI]`):
1. `frontend/src/features/owner-menu/components/OwnerIngredientsTab.tsx`: Component quản lý Vật tư thô vs Bán thành phẩm sơ chế, đơn vị tính, giá vốn và mức tồn an toàn.
2. `frontend/src/features/owner-menu/pages/OwnerMenuHubPage.tsx`: Trang Hub Thực đơn & Định lượng (4 Tabs: Sản phẩm, Nguyên liệu, Công thức BOM, Danh mục).
3. `frontend/src/features/owner-inventory/pages/OwnerInventoryHubPage.tsx`: Trang Hub Kho & Vật tư (3 Tabs: Tồn kho & Hủy hàng, Duyệt kiểm ca, Nhập xuất).
4. `frontend/src/features/owner-promotions/pages/OwnerPromotionsHubPage.tsx`: Trang Hub Khuyến mãi & Ưu đãi (2 Tabs: Combo Rules, Vouchers).
5. `frontend/src/features/office/hr/pages/OwnerHRHubPage.tsx`: Trang Hub Quản lý Nhân sự (5 Tabs: Duyệt mã mời, Danh sách nhân sự, Lịch làm việc, Chấm công, Quỹ lương).
6. `docs/Requirements/REQ-04_CONSOLIDATED_HUBS_AND_INVITE_HR.md`: Tài liệu đặc tả yêu cầu nghiệp vụ.
7. `docs/Developing/plans/PLAN-04_CONSOLIDATED_HUBS_AND_INVITE_HR.md`: Tài liệu kế hoạch hành động chi tiết.

### B. Chỉnh sửa (`[CHỈNH SỬA]`):
1. `frontend/src/shared/layouts/OfficeWorkspaceLayout.tsx`:
   - Rút gọn `ALL_NAV` chỉ còn 5 mục chính.
   - Thêm logic gọi `workspaceApi.getStaffRequests()` và hiển thị Badge đếm số lượng pending requests cạnh "Quản lý nhân sự".
   - Cập nhật hàm `isNavActive` nhận diện các subpath và tab query params.
2. `frontend/src/features/office/hr/pages/StaffJoinRequestsPage.tsx`:
   - Bổ sung bộ lọc trạng thái: Tất cả, Chờ xử lý, Đã duyệt, Đã từ chối.
   - Thêm nút liên kết tắt chuyển nhanh sang Danh bạ nhân viên.
3. `frontend/src/features/office/hr/pages/HREmployeesPage.tsx`:
   - Thêm banner thông báo màu hổ phách khi có ứng viên nhập mã mời đang chờ Owner phê duyệt kèm nút tắt chuyển sang tab duyệt.
4. `frontend/src/app/router/index.tsx`:
   - Đăng ký routes cho 4 Hub mới.
   - Cấu hình chuyển hướng `<Navigate to="...?tab=..." replace />` cho toàn bộ các route cũ.
   - Dọn dẹp các import không sử dụng để đạt 0 lỗi TypeScript.
5. `docs/Developing/logs/DEV_CHANGELOG.md`:
   - Bổ sung nhật ký `[LOG-022]` chi tiết về quá trình hợp nhất 5 Hub.

### C. Xóa bỏ (`[XÓA]`):
- Không xóa file vật lý cũ nhằm bảo toàn khả năng tái sử dụng độc lập của các sub-components khi cần nhúng vào các ngữ cảnh khác.

---

## 3. CÁC BƯỚC THỰC HIỆN TUẦN TỰ (STEP-BY-STEP)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       QUY TRÌNH THỰC HIỆN PLAN-04                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bước 1: Xây dựng Component Quản lý Nguyên liệu & Bán thành phẩm             │
│         - Tạo OwnerIngredientsTab.tsx với bộ lọc Raw vs Semi, CRUD & KPI    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bước 2: Xây dựng 4 Hub Pages Nghiệp vụ với Tab Bar chuẩn KONEKT             │
│         - OwnerMenuHubPage, OwnerInventoryHubPage                           │
│         - OwnerPromotionsHubPage, OwnerHRHubPage                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bước 3: Nâng cấp Phân hệ Nhân sự Mã mời & Granular Permissions              │
│         - Cải tiến StaffJoinRequestsPage & HREmployeesPage                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bước 4: Tái cấu trúc Sidebar Menu & Tích hợp Pending Badge                   │
│         - Rút gọn OfficeWorkspaceLayout.tsx thành 5 Hubs                    │
│         - Fetch & render Badge số lượng pending requests                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bước 5: Cấu hình Router & Tương thích ngược 100%                            │
│         - Định tuyến Hubs & Redirects trong router/index.tsx                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Bước 6: Kiểm thử Type Safety & Ghi nhận Tài liệu / Nhật ký                  │
│         - npx tsc --noEmit (0 lỗi)                                          │
│         - Cập nhật REQ-04, PLAN-04, DEV_CHANGELOG [LOG-022]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ĐÁNH GIÁ RỦI RO & PHƯƠNG ÁN DỰ PHÒNG (RISK ASSESSMENT & ROLLBACK)
* **Rủi ro 1: Người dùng truy cập bằng bookmark cũ bị lỗi 404.**
  - *Giải pháp*: Toàn bộ route cũ đều được chuyển tiếp bằng `<Navigate to="...?tab=..." replace />`. URL được cập nhật mượt mà trên browser address bar mà không phát sinh bất kỳ lỗi 404 nào.
* **Rủi ro 2: State của Tab bị mất khi reload trang.**
  - *Giải pháp*: Đồng bộ hóa tab bằng URL Search Param `?tab=...` qua `useSearchParams()`. Khi reload trang hoặc chia sẻ link, đúng tab đang chọn sẽ được mở ra ngay lập tức.
* **Rủi ro 3: Bị lỗi type imports trong `router/index.tsx`.**
  - *Giải pháp*: Rà soát và loại bỏ sạch sẽ các import component cũ không còn sử dụng trực tiếp trong router file, đảm bảo `npx tsc --noEmit` đạt 0 lỗi tuyệt đối.

---

## 5. KẾ HOẠCH KIỂM THỬ (VERIFICATION PLAN)

### A. Kiểm thử Tự động (Automated Verification):
- Chạy kiểm tra Type-safety:
  ```powershell
  npx tsc --noEmit
  ```
  Kết quả yêu cầu: Exit code 0 trên cả Frontend và Backend.

### B. Kiểm thử Giao diện Thủ công (Manual UI Verification):
1. **Kiểm tra Sidebar Menu**:
   - Xác nhận menu hiển thị đúng 5 mục: `Tổng quan chuỗi`, `Thực đơn & Định lượng`, `Kho & Quản lý vật tư`, `Khuyến mãi & Ưu đãi`, `Quản lý nhân sự`.
   - Xác nhận có Badge cam đếm số yêu cầu pending cạnh `Quản lý nhân sự`.
2. **Kiểm tra Hub Thực đơn & Định lượng (`/office/menu`)**:
   - Chuyển đổi giữa 4 tab: Món bán, Nguyên liệu, Công thức BOM, Danh mục.
   - Thử lọc nguyên liệu thô vs bán thành phẩm trong tab Nguyên liệu.
3. **Kiểm tra Hub Kho (`/office/inventory`)**:
   - Chuyển đổi giữa 3 tab: Tồn kho & Hàng hủy, Duyệt kiểm ca, Nhập xuất.
4. **Kiểm tra Hub Khuyến mãi (`/office/promotions`)**:
   - Chuyển đổi giữa 2 tab: Quy tắc Combo, Voucher & Ưu đãi.
5. **Kiểm tra Hub Nhân sự (`/office/hr`)**:
   - Chuyển đổi giữa 5 tab: Duyệt mã mời, Danh sách nhân sự, Lịch ca, Chấm công, Quỹ lương.
   - Mở modal duyệt ứng viên, kiểm tra chọn vai trò và toggles quyền hạn.
6. **Kiểm tra Tương thích ngược**:
   - Gõ trực tiếp `/office/menu/recipes` vào thanh địa chỉ trình duyệt $\rightarrow$ Xác nhận hệ thống tự động redirect sang `/office/menu?tab=recipes`.
   - Gõ trực tiếp `/office/hr/requests` $\rightarrow$ Xác nhận tự động redirect sang `/office/hr?tab=requests`.

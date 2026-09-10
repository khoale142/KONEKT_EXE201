# PLAN-03: CHUYỂN ĐỔI PHÂN HỆ QUẢN LÝ MENU & CÔNG THỨC ĐỊNH LƯỢNG CHO CHỦ QUÁN (OWNER)
**Liên kết yêu cầu**: `docs/Requirements/REQ-03_OWNER_MENU_AND_RECIPE_MANAGEMENT.md`  
**Người lập kế hoạch**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Chờ duyệt (Pending Approval)

---

## 1. MỤC TIÊU CỤ THỂ
1. Di chuyển và nâng cấp tính năng quản lý thực đơn từ module Marketing cũ sang phân hệ Quản trị Chủ quán (`/api/owner/menu` và `/office/menu/*`).
2. Xây dựng phân hệ Công thức pha chế & Định lượng nguyên vật liệu (Recipes / BOM).
3. Đảm bảo 100% dữ liệu truy vấn tuân thủ Tenant Isolation (`tenant_id`) trên cơ sở dữ liệu Supabase bằng Drizzle ORM.
4. Giao diện cao cấp theo chuẩn KONEKT Design System: Phổ màu Xanh rêu đậm (`#2B402D`) & Kem ngà (`#FAF6F3`), Lucide icons, font `DM Sans`.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### A. Database & Schema
* `[CHỈNH SỬA]` `backend/src/db/schema.ts`:
  - Thêm bảng `ingredients` (Nguyên vật liệu: `tenant_id`, `name`, `code`, `unit`, `cost_per_unit`, `is_active`).
  - Thêm bảng `product_recipes` (Công thức định lượng: `tenant_id`, `product_id`, `variant_id`, `ingredient_id`, `quantity`, `unit`, `waste_rate_percent`).
  - Thêm relations cho `products`, `productVariants`, `ingredients`, `productRecipes`.
* `[TẠO MỚI]` `backend/src/scripts/migrate_menu_recipes.ts`:
  - Chạy migration an toàn trực tiếp trên Supabase (`CREATE TABLE IF NOT EXISTS`).
  - Seed các nguyên liệu cơ bản cho Cafe (Hạt Arabica/Robusta, Sữa đặc, Sữa tươi, Đường, Trà đen...) và công thức mẫu cho các món có sẵn.

### B. Backend Modules & API
* `[TẠO MỚI]` `backend/src/modules/owner-menu/ownerMenu.types.ts`: DTOs & Types cho Menu, Sản phẩm, Biến thể, Nguyên liệu, Công thức.
* `[TẠO MỚI]` `backend/src/modules/owner-menu/ownerMenu.service.ts`: Business logic CRUD Categories, Products, Variants, Ingredients, Recipes (kèm tính Cost Price & Margin %).
* `[TẠO MỚI]` `backend/src/modules/owner-menu/ownerMenu.controller.ts`: Request handlers & validation.
* `[TẠO MỚI]` `backend/src/modules/owner-menu/ownerMenu.routes.ts`: Định tuyến `/api/owner/menu` có `authGuard` & kiểm tra quyền Owner/Store Manager.
* `[CHỈNH SỬA]` `backend/src/modules/menu/menu.service.ts`: Tái cấu trúc hàm `getPosMenu(tenantId)` để đọc trực tiếp từ Drizzle ORM Supabase, thay thế triệt để raw query `coffee_chain_db`.
* `[CHỈNH SỬA]` `backend/src/routes/index.ts`: Đăng ký `/owner/menu` router.

### C. Frontend
* `[TẠO MỚI]` `frontend/src/features/owner-menu/api/ownerMenu.api.ts`: Axios client gọi các API `/api/owner/menu`.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/pages/OwnerProductsPage.tsx`: Màn hình Quản lý danh sách sản phẩm, bảng giá, Food Cost ước tính và chuyển đổi trạng thái bán nhanh.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/pages/OwnerRecipesPage.tsx`: Màn hình Quản lý công thức định lượng (Recipe Book), hiển thị chi tiết nguyên liệu cấu thành từng món và tính toán giá vốn.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/pages/OwnerCategoriesPage.tsx`: Quản lý danh mục món ăn (thêm, sửa, sắp xếp thứ tự hiển thị).
* `[TẠO MỚI]` `frontend/src/features/owner-menu/components/ProductFormModal.tsx`: Modal tạo/sửa món tích hợp trình cấu hình Size & tab Trình soạn công thức (Recipe Builder).
* `[CHỈNH SỬA]` `frontend/src/shared/layouts/OfficeWorkspaceLayout.tsx`: Thêm 3 mục điều hướng vào section `THỰC ĐƠN & BÁN HÀNG` trong Sidebar của Owner (`Coffee`, `FlaskConical`, `FolderTree`).
* `[CHỈNH SỬA]` `frontend/src/app/router/index.tsx`: Khai báo các routes `/office/menu/products`, `/office/menu/recipes`, `/office/menu/categories`.

---

## 3. CÁC BƯỚC THỰC HIỆN TUẦN TỰ (STEP-BY-STEP)
1. **Bước 1**: Cập nhật Drizzle Schema trong `backend/src/db/schema.ts` với `ingredients` và `product_recipes`.
2. **Bước 2**: Chạy migration trên Supabase để tạo bảng và seed nguyên liệu / công thức mẫu.
3. **Bước 3**: Xây dựng backend module `owner-menu` đầy đủ CRUD cho categories, products, variants, ingredients, recipes.
4. **Bước 4**: Nâng cấp hàm `getPosMenu` trong `backend/src/modules/menu/menu.service.ts` đọc dữ liệu theo Drizzle schema mới.
5. **Bước 5**: Xây dựng các trang giao diện frontend: `OwnerProductsPage`, `OwnerRecipesPage`, `OwnerCategoriesPage` và `ProductFormModal`.
6. **Bước 6**: Cập nhật `OfficeWorkspaceLayout.tsx` và `app/router/index.tsx`.
7. **Bước 7**: Kiểm thử build frontend (`npm run build`), typecheck backend và kiểm tra giao diện thực tế.
8. **Bước 8**: Ghi nhật ký vào `docs/Developing/logs/DEV_CHANGELOG.md` (`[LOG-018]`) và cập nhật walkthrough.

---

## 4. ĐÁNH GIÁ RỦI RO & PHƯƠNG ÁN DỰ PHÒNG
* **Rủi ro 1: Tác động đến POS Menu**:
  - *Giải pháp*: Endpoint `getPosMenu` giữ nguyên cấu trúc JSON đầu ra (`categories`, `combos`, `products`, `variants`), chỉ thay thế tầng truy vấn dữ liệu từ raw SQL `coffee_chain_db` sang Drizzle ORM `products` / `product_categories` / `product_variants`. POS sẽ hoạt động mượt mà hơn và không bị lỗi connection timeout.
* **Rủi ro 2: Nullable Variant trong Recipe**:
  - *Giải pháp*: Một món có thể áp dụng 1 công thức chung cho tất cả các size (`variant_id = NULL`), hoặc có công thức riêng cho từng size (ví dụ: Size S dùng 20g cà phê, Size L dùng 35g cà phê). Thiết kế schema `variant_id` nullable hỗ trợ hoàn hảo cả hai trường hợp.

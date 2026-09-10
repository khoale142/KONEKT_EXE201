# PLAN-05: ĐỊNH LƯỢNG CÔNG THỨC BÁN THÀNH PHẨM TỪ NGUYÊN LIỆU (SEMI-FINISHED GOODS RECIPES / SUB-BOM)
**Liên kết yêu cầu**: `docs/Requirements/REQ-05_SEMI_FINISHED_RECIPES_MANAGEMENT.md`  
**Người lập kế hoạch**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Chờ duyệt (Pending Approval)

---

## 1. MỤC TIÊU CỤ THỂ
1. **Thiết kế & Nâng cấp Cơ sở dữ liệu (Supabase PostgreSQL & Drizzle ORM)**:
   - Thêm cột `item_type` (`'raw'` | `'semi_finished'`) và `batch_yield` (sản lượng 1 mẻ chuẩn, mặc định `1`) vào bảng `ingredients`.
   - Tạo bảng mới `semi_finished_recipes`:
     - `tenant_id`: integer references `tenants(id)` on delete cascade not null.
     - `semi_finished_id`: integer references `ingredients(id)` on delete cascade not null.
     - `ingredient_id`: integer references `ingredients(id)` on delete cascade not null.
     - `quantity`: numeric(12, 3) not null.
     - `unit`: varchar(50) not null.
     - `waste_rate_percent`: numeric(5, 2) default '0'.
     - Đánh `UNIQUE(semi_finished_id, ingredient_id)` và các index hiệu năng.
2. **Xây dựng Backend Engine tính giá vốn Bán thành phẩm**:
   - Viết Service lấy danh sách công thức của BTP (`getSemiFinishedRecipe`) và lưu công thức BTP (`saveSemiFinishedRecipe`).
   - Tự động tính toán tổng chi phí mẻ sơ chế:
     $$\text{totalBatchCost} = \sum (\text{quantity}_i \times \text{costPerUnit}_i \times (1 + \text{wasteRatePercent}_i / 100))$$
   - Tự động cập nhật lại `ingredients.cost_per_unit = totalBatchCost / batchYield` và `ingredients.batch_yield = batchYield`.
   - Cung cấp API endpoints:
     - `GET /api/owner/menu/ingredients/:id/recipe`
     - `PUT /api/owner/menu/ingredients/:id/recipe`
     - Cập nhật `GET /api/owner/menu/ingredients` trả về thông tin `itemType`, `batchYield`, `recipeItemCount`, `hasRecipe`.
3. **Phát triển Giao diện Quản lý & Định lượng Sơ chế (Frontend UI/UX)**:
   - Trong `OwnerIngredientsTab.tsx`:
     - Phân loại rõ ràng vật tư qua trường `itemType` từ database (không còn dùng phỏng đoán chuỗi regex/tên).
     - Cho phép lọc theo Tất cả / Nguyên liệu thô / Bán thành phẩm.
     - Hiển thị nút thao tác: "Công thức sơ chế (BOM)" kèm badge đếm số nguyên liệu cấu thành.
     - Cập nhật Modal Tạo/Sửa Nguyên liệu: hỗ trợ chọn Phân loại và Sản lượng định mức ban đầu.
   - Tạo mới Modal chuyên biệt `SemiFinishedRecipeModal.tsx`:
     - Tông màu chuẩn KONEKT: Primary Green `#3D503C`, Canvas `#FEF8EE`, Khung `#FFFFFF`, Viền `#E4DFD6`.
     - Nhập sản lượng đầu ra 1 mẻ (e.g. 800 ml hoặc 1000 g).
     - Bảng thêm các nguyên liệu thô (tự động loại trừ chính BTP đó để chống vòng lặp đệ quy).
     - Hiển thị realtime: Đơn giá thành phần, chi phí từng dòng, tổng chi phí mẻ và giá vốn đơn vị tính toán.
     - Nút "Lưu công thức & Tự động cập nhật giá vốn" với phản hồi tức thì.
   - Kế thừa vào Công thức Món chính:
     - Khi mở công thức món bán lẻ (như Cà phê sữa, Trà đào), các BTP đã có giá vốn tự động chính xác, đảm bảo tính Food Cost và Margin % chuẩn xác.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### A. Database & Migration
* `[CHỈNH SỬA]` `backend/src/db/schema.ts`:
  - Thêm `itemType`, `batchYield` vào `ingredients`.
  - Tạo bảng `semi_finished_recipes` và quan hệ relations `semiFinishedRecipesRelations`.
* `[TẠO MỚI]` `backend/scripts/migrate-semi-finished-recipes.ts`:
  - Script DDL chạy trực tiếp trên Supabase database bằng `pool.query`.

### B. Backend Modules & API
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.types.ts`:
  - Cập nhật `IngredientDto`, thêm `SemiFinishedRecipeItemDto`, `SemiFinishedRecipeDetailDto`, `SaveSemiFinishedRecipeInput`.
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.service.ts`:
  - Cập nhật `listIngredients`, `createIngredient`, `updateIngredient` nhận `itemType` & `batchYield`.
  - Thêm `getSemiFinishedRecipe` và `saveSemiFinishedRecipe` có tự động tính `costPerUnit`.
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.controller.ts`:
  - Thêm handlers: `getSemiFinishedRecipeHandler`, `saveSemiFinishedRecipeHandler`.
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.routes.ts`:
  - Đăng ký 2 routes: `GET /ingredients/:id/recipe`, `PUT /ingredients/:id/recipe`.

### C. Frontend
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/api/ownerMenu.api.ts`:
  - Bổ sung types: `SemiFinishedRecipeItem`, `SemiFinishedRecipeDetail`, `SaveSemiFinishedRecipePayload`.
  - Bổ sung methods: `getSemiFinishedRecipe(id)`, `saveSemiFinishedRecipe(id, payload)`.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/components/SemiFinishedRecipeModal.tsx`:
  - Modal định lượng công thức sơ chế mẻ, bảng chọn nguyên liệu, tự động tính realtime tổng chi phí và giá vốn đơn vị.
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/components/OwnerIngredientsTab.tsx`:
  - Hiển thị cột / nút BOM cho Bán thành phẩm, tích hợp `SemiFinishedRecipeModal`.
  - Tinh chỉnh modal Thêm/Sửa vật tư lưu đúng `itemType` và `batchYield`.

---

## 3. CÁC BƯỚC TRIỂN KHAI CHI TIẾT
1. **Bước 1: Database Migration**:
   - Cập nhật `backend/src/db/schema.ts`.
   - Tạo và chạy `backend/scripts/migrate-semi-finished-recipes.ts` để add column `item_type`, `batch_yield` và tạo bảng `semi_finished_recipes` trên Supabase.
2. **Bước 2: Backend Logic & Recalculation Engine**:
   - Mở rộng types trong `ownerMenu.types.ts`.
   - Triển khai logic tính toán chi phí và cập nhật giá vốn BTP trong `ownerMenu.service.ts`.
   - Thêm endpoints trong controller và router.
   - Kiểm tra compilation `npx tsc --noEmit` phía backend.
3. **Bước 3: Frontend API & SemiFinishedRecipeModal**:
   - Mở rộng API client trong `ownerMenu.api.ts`.
   - Xây dựng component `SemiFinishedRecipeModal.tsx` với bảng tính chi phí reactive.
4. **Bước 4: Tích hợp vào Bảng Quản lý Nguyên liệu**:
   - Nâng cấp `OwnerIngredientsTab.tsx`: gắn nút mở Modal BOM cho BTP, hiển thị huy hiệu trạng thái công thức.
   - Kiểm tra compilation `npx tsc --noEmit` phía frontend.
5. **Bước 5: Kiểm thử Toàn diện & Ghi Nhật ký**:
   - Xác minh luồng: Tạo BTP $\rightarrow$ Thiết lập công thức sơ chế từ 2+ nguyên liệu thô $\rightarrow$ Kiểm tra giá vốn tự động tính $\rightarrow$ Kiểm tra hiển thị trong món chính.
   - Ghi lại thay đổi trong `docs/Developing/logs/DEV_CHANGELOG.md` (`[LOG-024]`).

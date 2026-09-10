# PLAN-03B: TỐI ƯU HÓA DATABASE & XÂY DỰNG MA TRẬN ĐỊNH LƯỢNG CÔNG THỨC THEO SIZE DẠNG BẢNG
**Liên kết yêu cầu**: `docs/Requirements/REQ-03_OWNER_MENU_AND_RECIPE_MANAGEMENT.md`  
**Người lập kế hoạch**: Antigravity AI Agent  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Chờ duyệt (Pending Approval)

---

## 1. MỤC TIÊU CỤ THỂ
1. **Tối ưu hóa Cơ sở dữ liệu (Supabase & Drizzle ORM)**:
   - Đảm bảo mỗi dòng công thức định lượng gắn chính xác với `variant_id` (kích cỡ cụ thể của món).
   - Thêm Unique Composite Index `(product_id, variant_id, ingredient_id)` ngăn ngừa trùng lặp dữ liệu nguyên liệu trên cùng một size.
   - Thêm Index `(product_id, variant_id)` để tối ưu hóa truy vấn trừ kho tự động khi bán tại POS.
2. **Nâng cấp Backend Service**:
   - Chuyển đổi định dạng công thức trả về kèm ma trận phân giải theo Size (`recipeMatrix`).
   - Cung cấp tính năng tính riêng Food Cost và Margin % cho từng Size (ví dụ: Size M giá 35k cost 8.1k margin 77%, Size L giá 45k cost 11.2k margin 75%).
3. **Cải tổ Giao diện Người dùng (Frontend UI/UX)**:
   - Thiết kế lại Tab "Định lượng công thức (BOM)" trong `ProductFormModal.tsx` thành **Bảng Ma trận 2 chiều (Matrix Grid)**:
     - **Cột**: Các Size của món (Size Tiêu chuẩn, Size L,...) kèm badge phụ thu & giá bán niêm yết.
     - **Hàng**: Từng nguyên vật liệu (Robusta, Arabica, Sữa đặc, Sữa tươi,...).
     - **Ô giao nhau**: Input nhập số lượng định lượng riêng cho size đó, có hiển thị giá vốn thành phần ngay dưới input.
     - **Dòng tổng kết chân bảng (Footer Summary)**:
       - Hàng **Tổng Food Cost (VNĐ)** cho từng size.
       - Hàng **Giá bán niêm yết (VNĐ)** cho từng size.
       - Hàng **Biên lợi nhuận % (Margin)** cho từng size.
   - Bổ sung nút tiện ích: **"Nhân tỷ lệ 1.3x / 1.5x cho Size lớn"** giúp pha chế thiết lập nhanh mà không cần gõ từng ô thủ công.
   - Cập nhật trang Sổ tay Công thức (`OwnerRecipesPage.tsx`) hiển thị trực quan các cột Size.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### A. Database & Schema
* `[CHỈNH SỬA]` `backend/src/db/schema.ts`:
  - Thêm `uniqueIndex('idx_product_recipes_unique')` trên `(productId, variantId, ingredientId)`.
* `[TẠO MỚI]` `backend/src/scripts/optimize_recipe_indexes.ts`:
  - Chạy DDL bổ sung unique index trên Supabase và chuẩn hóa dữ liệu cũ (gán `variant_id` mặc định cho các công thức chưa có size).

### B. Backend Modules & API
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.types.ts`:
  - Mở rộng `RecipeItemDto` và thêm `RecipeMatrixDto`.
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.service.ts`:
  - Tối ưu `getProductDetail`: cấu trúc hóa dữ liệu theo ma trận size $\times$ nguyên liệu.
  - Cập nhật `saveProductRecipes` lưu mảng công thức theo từng `variantId`.

### C. Frontend
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/api/ownerMenu.api.ts`:
  - Cập nhật types cho Ma trận công thức theo Size.
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/components/ProductFormModal.tsx`:
  - Thiết kế lại Tab "Định lượng công thức (BOM)" thành bảng ma trận nhiều cột Size, hỗ trợ tính Food Cost và Margin độc lập từng size, cảnh báo âm vốn.
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerRecipesPage.tsx`:
  - Nâng cấp bảng chi tiết công thức hiển thị các cột kích cỡ rõ ràng.

---

## 3. CÁC BƯỚC THỰC HIỆN TUẦN TỰ
1. **Bước 1**: Tối ưu database index trong `schema.ts` và chạy script `optimize_recipe_indexes.ts` trên Supabase.
2. **Bước 2**: Nâng cấp types và service backend `ownerMenu.service.ts` để tính toán ma trận định lượng đa kích cỡ.
3. **Bước 3**: Kiểm thử backend với `npx tsc --noEmit`.
4. **Bước 4**: Tái cấu trúc Tab 2 trong `ProductFormModal.tsx` thành dạng Bảng ma trận: Cột = Size, Hàng = Nguyên liệu.
5. **Bước 5**: Tối ưu hiển thị bảng công thức trong `OwnerRecipesPage.tsx`.
6. **Bước 6**: Chạy build frontend (`npm run build`).
7. **Bước 7**: Ghi nhật ký vào `DEV_CHANGELOG.md` và walkthrough.

---

## 4. KẾ HOẠCH KIỂM THỬ
- [ ] Mở modal sửa món có 2 size (Size Tiêu chuẩn, Size Lớn).
- [ ] Kiểm tra Tab Công thức hiển thị Bảng với 2 cột Size tương ứng.
- [ ] Nhập số lượng khác nhau (ví dụ: Hạt cafe Size S = 20g, Size L = 35g).
- [ ] Kiểm tra chân bảng: Food Cost của Size S và Size L hiển thị khác nhau, Margin % tính toán độc lập và chính xác.
- [ ] Lưu món và mở lại: Dữ liệu định lượng từng size được giữ nguyên 100%.
- [ ] Backend & Frontend build pass 100% với 0 lỗi.

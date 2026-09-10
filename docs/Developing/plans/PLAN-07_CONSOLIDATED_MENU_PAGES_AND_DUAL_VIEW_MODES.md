# PLAN-07: KẾ HOẠCH TÁI CẤU TRÚC 3 TRANG THỰC ĐƠN ĐỘC LẬP, DANH MỤC PHÂN CẤP TÍCH HỢP & 2 CHẾ ĐỘ HIỂN THỊ (CARD / TABLE)
**Liên kết yêu cầu**: `docs/Requirements/REQ-07_CONSOLIDATED_MENU_PAGES_AND_DUAL_VIEW_MODES.md`  
**Người lập kế hoạch**: Antigravity AI Agent  
**Ngày cập nhật**: 09/09/2026  
**Trạng thái**: Đang chờ Chủ quán phê duyệt (Pending Owner Approval)

---

## 1. MỤC TIÊU CỤ THỂ

Thực hiện yêu cầu tái tổ chức toàn diện phân hệ Thực đơn & Định lượng của Chủ quán:
1. **Gom gọn thành 3 Trang Nghiệp Vụ Chuyên Sâu**:
   - **Trang 1: Sản phẩm / Món bán (`products`)**: Gộp chung Món bán + Công thức định lượng (BOM) đa kích cỡ + Quản lý Danh mục món cha/con trực tiếp trên trang.
   - **Trang 2: Nguyên liệu thô (`raw-materials`)**: Tách biệt hoàn toàn vật tư thô nhập kho + Quản lý Danh mục nguyên liệu cha/con.
   - **Trang 3: Bán thành phẩm (`semi-finished`)**: Quản lý món sơ chế tại quán + Công thức sơ chế (Sub-BOM) từ nguyên liệu thô kèm sản lượng 1 mẻ (Batch Yield) $\rightarrow$ Tự động tính giá vốn COGS + Quản lý Danh mục BTP cha/con.
2. **2 Chế độ hiển thị linh hoạt (Dual View Modes)**:
   - **Chế độ Thẻ (Card Grid)**: Hiển thị các khối thẻ sản phẩm/vật tư đẹp mắt, tối ưu cho màn hình laptop; bấm vào thẻ mở ngay Popup Modal chi tiết (thông tin + công thức).
   - **Chế độ Bảng Dòng (Table Row)**: Dạng bảng dòng dữ liệu phẳng, canh phải tabular-nums cho các con số tài chính.
   - Lưu lựa chọn hiển thị của người dùng vào `localStorage`.
3. **Danh mục tích hợp & Hỗ trợ Danh mục Con (Subcategories)**:
   - Thêm trường `parentId` và `scope` vào bảng danh mục để quản lý phân cấp cha - con cho cả 3 trang.
   - Bộ lọc và modal quản lý danh mục nhanh tại từng trang.
4. **Tối giản Trạng thái Bán hàng**:
   - Loại bỏ icon rác ở nhãn trạng thái bán hàng; dùng badge chữ phẳng tinh giản.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG

### A. Database Schema & Backend APIs
* `[CHỈNH SỬA]` `backend/src/db/schema.ts`:
  - Mở rộng bảng `product_categories`: thêm `parentId` (integer self-referencing nullable) và `scope` (varchar 50: `'product' | 'raw_material' | 'semi_finished'`).
  - Mở rộng bảng `ingredients`: thêm `categoryId` (integer references product_categories.id), `itemType` (varchar 30: `'raw' | 'semi_finished'`), `batchYield` (numeric 12,3 default '1').
  - Thêm bảng mới `semi_finished_recipes`: `id`, `tenantId`, `semiFinishedId`, `ingredientId`, `quantity`, `unit`, `wasteRatePercent`.
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.service.ts`:
  - Bổ sung APIs quản lý danh mục phân cấp theo `scope` (lấy cây cha-con, tạo/sửa danh mục con).
  - Tích hợp công thức sơ chế bán thành phẩm: tự động tính `costPerUnit` của BTP từ các nguyên liệu thô đầu vào.
  - Cập nhật API lấy danh sách món kèm công thức BOM tích hợp sẵn trong chi tiết món.
* `[CHỈNH SỬA]` `backend/src/modules/owner-menu/ownerMenu.controller.ts` & `ownerMenu.routes.ts`:
  - Thêm routes cho Sub-BOM và Danh mục theo scope.

### B. Frontend Navigation & Hub Architecture
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerMenuHubPage.tsx`:
  - Cập nhật thanh Tab 1 dòng từ 4 tab thành **3 tab chuẩn**:
    `Sản phẩm & Món bán` | `Nguyên liệu thô` | `Bán thành phẩm`.
* `[CHỈNH SỬA]` `frontend/src/app/router/index.tsx`:
  - Giữ vững tính tương thích ngược, map các route cũ về đúng tab mới.

### C. Giao diện 3 Trang Chuyên Biệt & 2 Chế Độ Xem (Card / Table)
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/pages/OwnerProductsPage.tsx`:
  - Đổi mới toàn diện: Tích hợp công thức BOM trực tiếp vào danh sách món.
  - Bổ sung nút chuyển đổi View Mode: **Dạng Thẻ (Grid)** $\boxplus$ và **Dạng Dòng (Table)** $\equiv$.
  - Ở chế độ Thẻ: Thiết kế card bento grid cao cấp; bấm vào card mở Popup Modal chi tiết món & công thức.
  - Tích hợp bộ lọc và quản lý Danh mục phân cấp cha - con.
  - Nhãn trạng thái bỏ icon, chỉ dùng text badge phẳng.
* `[CHỈNH SỬA]` `frontend/src/features/owner-menu/components/OwnerIngredientsTab.tsx` $\rightarrow$ Tái cấu trúc thành `OwnerRawMaterialsPage.tsx`:
  - Chuyên biệt hóa 100% cho Nguyên liệu thô nhập kho.
  - Hỗ trợ 2 chế độ xem: Dạng Thẻ và Dạng Dòng.
  - Tích hợp quản lý danh mục nguyên liệu cha - con.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/pages/OwnerSemiFinishedPage.tsx`:
  - Trang chuyên biệt cho Bán thành phẩm sơ chế tại quán.
  - Hỗ trợ 2 chế độ xem: Dạng Thẻ và Dạng Dòng.
  - Tích hợp nút và modal "Công thức sơ chế (BOM)" kèm sản lượng 1 mẻ (Batch Yield) và tự động tính giá vốn.
  - Tích hợp danh mục BTP cha - con.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/components/ProductDetailModal.tsx`:
  - Popup chi tiết hiển thị toàn diện khi bấm vào thẻ sản phẩm ở chế độ Grid: thông tin món, phân loại, giá bán các size, bảng công thức định lượng BOM, Food Cost, Margin %.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/components/CategoryManageModal.tsx`:
  - Modal quản lý nhanh danh mục cha - con trực tiếp trên từng trang mà không cần tab riêng.
* `[TẠO MỚI]` `frontend/src/features/owner-menu/components/SemiFinishedRecipeModal.tsx`:
  - Modal định lượng sơ chế Bán thành phẩm từ nguyên vật liệu thô.

---

## 3. CÁC BƯỚC TRIỂN KHAI TUẦN TỰ (STEP-BY-STEP)

```
┌────────────────────────────────────────────────────────────────────────┐
│  BƯỚC 1: DATABASE & BACKEND API                                        │
│  - Mở rộng schema (categories parentId, scope, semi_finished_recipes)  │
│  - Drizzle migration & service logic tính giá vốn BTP                  │
├────────────────────────────────────────────────────────────────────────┤
│  BƯỚC 2: RESTRUCTURE MENU HUB (3 TABS)                                 │
│  - Cập nhật OwnerMenuHubPage.tsx sang 3 Tab: Món bán | NL thô | BTP    │
│  - Tạo component quản lý danh mục phân cấp dùng chung                  │
├────────────────────────────────────────────────────────────────────────┤
│  BƯỚC 3: TRANG SẢN PHẨM & MÓN BÁN (TÍCH HỢP BOM + DUAL VIEW MODES)     │
│  - Tạo ProductDetailModal.tsx (popup khi click thẻ)                    │
│  - Thêm ViewMode Switcher (Card Grid vs Table Row)                     │
│  - Tích hợp công thức đa kích cỡ trực tiếp trong thẻ/bảng món          │
├────────────────────────────────────────────────────────────────────────┤
│  BƯỚC 4: TRANG NGUYÊN LIỆU THÔ (RAW MATERIALS)                         │
│  - Lọc riêng nguyên liệu thô, Dual View Modes                          │
│  - Tích hợp phân loại danh mục cha-con cho nguyên liệu                 │
├────────────────────────────────────────────────────────────────────────┤
│  BƯỚC 5: TRANG BÁN THÀNH PHẨM (SEMI-FINISHED + SUB-BOM)                │
│  - Tạo OwnerSemiFinishedPage.tsx + SemiFinishedRecipeModal.tsx         │
│  - Khai báo mẻ sơ chế từ NVL thô, tự động tính COGS                    │
├────────────────────────────────────────────────────────────────────────┤
│  BƯỚC 6: KIỂM THỬ, ĐỐI SOÁT TRỰC QUAN & GHI LOG                        │
│  - npx tsc --noEmit kiểm tra 0 lỗi                                     │
│  - Ghi [LOG-025] vào DEV_CHANGELOG.md                                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. ĐÁNH GIÁ RỦI RO & PHƯƠNG ÁN DỰ PHÒNG (RISK & ROLLBACK)
1. **Rủi ro tương thích dữ liệu danh mục cũ**:
   - *Giải pháp*: Mặc định các danh mục hiện tại sẽ có `parentId = null` và `scope = 'product'`, bảo toàn 100% dữ liệu danh mục sẵn có.
2. **Rủi ro ảnh hưởng đến các màn hình POS bán hàng**:
   - *Giải pháp*: POS chỉ đọc `products` và `product_variants`. Bất kỳ thay đổi cấu trúc hiển thị nào ở Back-office đều không làm thay đổi các trường dữ liệu lõi của `products`, đảm bảo POS bán hàng thông suốt.

---

## 5. KẾ HOẠCH KIỂM THỬ (VERIFICATION PLAN)
1. **Automated Verification**:
   - Kiểm tra Typescript: `cd frontend; npx tsc --noEmit` $\rightarrow$ 0 lỗi.
   - Kiểm tra Typescript Backend: `cd backend; npx tsc --noEmit` $\rightarrow$ 0 lỗi.
2. **Manual Visual Verification**:
   - Mở trình duyệt, kiểm tra tab 1 (Món bán): chuyển đổi qua lại giữa Card Grid và Table Row mượt mà; bấm thẻ mở popup chi tiết đầy đủ.
   - Kiểm tra tab 2 (Nguyên liệu thô): chỉ hiện nguyên liệu thô, có 2 chế độ xem.
   - Kiểm tra tab 3 (Bán thành phẩm): thử mở modal khai báo công thức mẻ sơ chế từ nguyên liệu thô, kiểm tra giá vốn BTP tự động cập nhật.
   - Kiểm tra tạo danh mục con và lọc danh mục phân cấp trên từng trang.

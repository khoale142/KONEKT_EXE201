# KẾ HOẠCH HÀNH ĐỘNG: TÁI CẤU TRÚC BỐ CỤC GIỎ HÀNG, CỘT KHÁCH HÀNG & MÀN HÌNH THANH TOÁN POS
**Mã kế hoạch**: `PLAN-14`  
**Liên kết yêu cầu**: `REQ-14`  
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày lập**: 10/09/2026  
**Người thực hiện**: Antigravity AI Agent  
**Trạng thái**: Đã hoàn thành & Đã nghiệm thu (Completed & Verified)  

---

## 1. MỤC TIÊU CỤ THỂ
Tái cấu trúc bố cục giao diện trang bán hàng POS (`PosOrderPage.tsx`) theo đúng chỉ đạo của Chủ quán:
1. **Cột giỏ hàng (Cột trái)**: Xóa bỏ khối Giảm giá nhanh (%) và khối Voucher/Promotion. Cột giỏ hàng chỉ còn: Header, Danh sách món/combo, Khối Tổng tiền (Total/Subtotal/Discount) và các nút hành động (Thanh toán, Giữ đơn, Xóa giỏ).
2. **Cột khách hàng (Cột phải)**:
   - Session 1: Khách hàng / Thành viên (Tra cứu SĐT, tạo tài khoản nhanh, xem điểm).
   - Session 2: Ưu đãi & Khuyến mãi (Voucher / Promotion chuyển từ giỏ hàng sang).
   - Session 3: Chế độ nhận món & Định danh theo cấu hình quán (Bàn / Thẻ / STT...).
3. **Màn hình thanh toán (`mode === "payment"`)**:
   - Đưa khối Giảm giá nhanh (% Chiết khấu) vào màn hình thanh toán để thu ngân áp chiết khấu ngay khi chốt tiền.

---

## 2. DANH SÁCH FILE TÁC ĐỘNG
- `[CHỈNH SỬA]` `frontend/src/features/pos/pages/PosOrderPage.tsx`
  - Di chuyển khối `Voucher / Promotion` từ `railBottomStyle` sang `railTopStyle` làm Session 2.
  - Xóa khối `Giảm giá nhanh (% Quick Discounts)` khỏi `railBottomStyle`.
  - Tích hợp khối `Giảm giá nhanh (% Quick Discounts)` vào vùng thanh toán (`mode === "payment"`).
  - Tinh chỉnh `railBottomStyle` và `railTopStyle` để tỷ lệ hiển thị cân đối, scroll mượt mà.
- `[CHỈNH SỬA]` `docs/Developing/logs/DEV_CHANGELOG.md`
  - Ghi nhận `[LOG-008]`.

---

## 3. CÁC BƯỚC THỰC HIỆN TUẦN TỰ (STEP-BY-STEP)

### Bước 1: Di chuyển khối Voucher / Promotion sang cột Phải (Session 2)
- Trong `PosOrderPage.tsx`:
  - Tại `railTopStyle`:
    * Session 1: Khách hàng / member (giữ nguyên).
    * **Session 2 (Mới)**: Đặt khối Voucher / Promotion ngay dưới Khách hàng / member. Khối này gồm:
      - Tabs chọn `Voucher` / `Promotion`.
      - Input nhập mã, nút `Áp` và `Bỏ`.
      - Hiển thị badge mã đang áp dụng, banner ưu đãi, popup quà tặng nếu có.
    * Session 3: Khối Định danh phục vụ (Số Bàn / Thẻ số / STT / Tên / Bán nhanh) chuyển xuống dưới Session 2.

### Bước 2: Tối giản Cột Giỏ Hàng (Cột trái)
- Tại `railBottomStyle`:
  - Xóa bỏ JSX của `Giảm giá nhanh` và `Voucher / Promotion`.
  - Giữ lại:
    * Header `Gio hang` kèm số lượng món.
    * Danh sách món và combos (có thanh cuộn `overflow-y: auto` riêng biệt, không bị chèn ép chiều cao).
    * Khối Tổng tiền tóm tắt:
      - Tạm tính (Subtotal).
      - Giảm giá voucher/khuyến mãi (nếu có).
      - Giảm giá nhanh chiết khấu (nếu có).
      - **Tổng thanh toán (Payable Total)** nổi bật với style to rõ.
    * Các nút hành động: `Chọn thanh toan`, `Giu don`, `Xoa gio`.

### Bước 3: Phẳng Hóa Thực Đơn (Flattened Item Grid) & Bổ Sung Tab "Tất Cả"
- Trên thanh danh mục: Thêm tab `[ ✨ Tất cả ]` (`key: "ALL"`), mặc định hiển thị toàn bộ món khi người dùng muốn xem tổng thể.
- Tính toán danh sách phẳng `flatMenuItems`:
  - Mỗi biến thể `(Product, Variant)` trở thành 1 item card riêng biệt có: Tên món, Size badge, Giá tiền, Danh mục.
  - Khi click vào Card, gọi trực tiếp `addVariant()` thêm vào giỏ hàng ngay lập tức (1-tap).
  - Thiết kế card sang trọng: Nền `#FAF7F2`, viền `#DFD6C7`, hover hiệu ứng viền xanh rêu `#3D5E46`, font chữ rõ ràng, hiển thị badge số lượng đã chọn trong giỏ (nếu có).

### Bước 4: Đưa Khối Giảm Giá Nhanh vào Màn hình Thanh toán (`mode === "payment"`)
- Trong chế độ thanh toán (`mode === "payment"`):
  - Đặt khối chọn % chiết khấu nhanh (`0%`, `5%`, `10%`, `15%`, `20%`, `50%`, `100% Free`) ngay trên cụm Phương thức thanh toán (Tiền mặt / Chuyển khoản).
  - Khi thu ngân click đổi %, tiền thanh toán `payableTotal` tự động cập nhật, tiền thối / gợi ý tiền mặt tự động tính lại tức thì.

### Bước 5: Kiểm tra Biên Dịch & Build Type-Safe
- Chạy `npm run build` trong `frontend/` để bảo đảm không có lỗi type hoặc biến thừa.

### Bước 6: Kiểm Thử Trực Quan Bằng Browser Subagent
- Mở `http://localhost:5173/pos`.
- Chụp ảnh màn hình kiểm chứng:
  1. Cột giỏ hàng bên trái: Cực kỳ tinh gọn, chỉ có món và tổng tiền.
  2. Vùng Menu giữa: Tab "Tất cả" hoạt động, danh sách món phẳng (1 size = 1 card) click thêm món tức thì.
  3. Cột bên phải: Có đủ 3 sessions (Khách hàng, Voucher/Promotion, Định danh bàn/thẻ).
  4. Bấm "Chọn thanh toán": Màn hình thanh toán xuất hiện khối Giảm giá nhanh (%).

### Bước 7: Ghi Nhật Ký Thay Đổi
- Cập nhật `docs/Developing/logs/DEV_CHANGELOG.md` ghi nhận `LOG-008`.
- Cập nhật `walkthrough.md`.

---

## 4. ĐÁNH GIÁ RỦI RO & PHƯƠNG ÁN PHÒNG NGỪA
- **Rủi ro**: State `offerMode`, `offerCode`, `manualDiscountPercent` có thể bị đứt gãy tương tác khi chuyển vị trí.
- **Biện pháp phòng ngừa**: Toàn bộ state nằm trong `PosOrderPage` cha, không thay đổi scope của state mà chỉ tái cấu trúc vị trí component trong cây JSX, bảo toàn 100% logic tính tiền và discount calculation.

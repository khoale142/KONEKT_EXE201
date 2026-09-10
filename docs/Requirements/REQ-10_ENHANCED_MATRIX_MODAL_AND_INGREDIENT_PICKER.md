# ĐẶC TẢ YÊU CẦU: NÂNG CẤP POPUP MA TRẬN & POPUP CHỌN NGUYÊN LIỆU MULTI-SELECT
**Mã yêu cầu**: `REQ-10`  
**Dự án**: Cafe Management Platform (KONEKT SaaS Web POS)  
**Đối tượng sử dụng**: Chủ quán (Owner)  
**Ngày tạo**: 09/09/2026  
**Trạng thái**: Chờ phê duyệt (Pending Approval)

---

## 1. BỐI CẢNH & VẤN ĐỀ (PROBLEM STATEMENT)
Sau khi đưa Ma trận Giá bán & Định lượng vào Popup Vừa Xem Vừa Sửa (`ProductFormModal.tsx`), Chủ quán đã review thực tế và chỉ ra các điểm cần tinh chỉnh để giao diện tối ưu hơn:
1. **Popup còn bị hẹp**: Hiện tại `maxWidth` khoảng 780px khiến bảng ma trận khi có 3 size trở lên bị co cụm, xuất hiện thanh cuộn ngang gây bất tiện khi thao tác trên laptop.
2. **Cột đơn vị tính đứng riêng biệt thừa thãi**: Cột "Đơn vị" nằm riêng ở cuối bảng làm tốn diện tích ngang; thay vào đó nên nhúng trực tiếp đơn vị (`g`, `ml`...) vào ngay sau con số nhập liệu trong từng ô.
3. **Nút ⭐ (size mặc định) không cần thiết**: Gây rối mắt và thừa thao tác. Chủ quán chỉ cần Tên size và Giá bán trực tiếp.
4. **Phần nguyên liệu dạng Dropdown `<select>` bất tiện**:
   - Khi có nhiều nguyên liệu, mỗi hàng phải click sổ dropdown rồi scroll tìm kiếm rất chậm.
   - Không hỗ trợ chọn nhanh cùng lúc nhiều nguyên vật liệu và bán thành phẩm sơ chế.
   - Mong muốn: Nhấn nút `+ Thêm nguyên liệu` sẽ mở ra một **Popup Picker hiển thị danh sách Nguyên liệu thô & Bán thành phẩm** để tick chọn (multi-select), chọn xong bao nhiêu mục thì tự động render ra bấy nhiêu hàng trong bảng ma trận với tên tĩnh rõ ràng.

---

## 2. USER STORIES
- **Là một Chủ quán**, tôi muốn Popup chỉnh sửa món rộng rãi hơn trên màn hình laptop để dễ dàng quan sát và thao tác toàn bộ các kích cỡ cùng lúc mà không bị chật chội.
- **Là một Chủ quán**, tôi muốn đơn vị tính (`g`, `ml`) nằm ngay sau ô nhập số lượng của từng size để bảng gọn gàng hơn và không tốn một cột riêng.
- **Là một Chủ quán**, tôi muốn header cột size chỉ gồm Tên size và Giá bán (bỏ nút sao ⭐) để tập trung vào định giá.
- **Là một Chủ quán**, tôi muốn khi bấm `+ Thêm nguyên liệu` sẽ có một popup danh sách cả nguyên liệu thô lẫn bán thành phẩm để tôi tìm kiếm và chọn nhanh nhiều mục cùng lúc, sau đó bảng ma trận tự động sinh ra bấy nhiêu hàng để tôi chỉ việc điền định lượng cho từng size.

---

## 3. PHẠM VI CHI TIẾT (SCOPE)

### A. Mở rộng kích thước Popup (Modal Width Expansion)
- Tăng chiều rộng Popup từ 780px lên `maxWidth: 1040px` (hoặc `min(1060px, 95vw)`).
- Đảm bảo hiển thị thoải mái 3 đến 5 cột kích cỡ cùng lúc mà không bị chèn ép.

### B. Header Cột Size Tinh gọn (Simplified Size Header)
- Bỏ hoàn toàn nút icon sao (⭐).
- Header mỗi cột size chỉ gồm:
  - Ô nhập Tên size (`Size S`, `Size M`, `Size L`...).
  - Ô nhập Giá bán thực tế trực tiếp dưới tên size.
  - Nút ✕ xóa size nhỏ gọn tinh tế (chỉ hiển thị khi có > 1 size).

### C. Nhúng Đơn vị tính vào sau Số lượng (Inline Unit Suffix)
- Xóa bỏ cột `Đơn vị` riêng biệt trong bảng Ma trận (và bảng món 1 size).
- Nhúng đơn vị tính (`g`, `ml`, `lon`, `quả`...) trực tiếp vào bên trong hoặc ngay sau ô input nhập số lượng của từng size, ví dụ:
  - Dạng input container có hậu tố: `[ 25 ] g` hoặc `[ 40 ] ml`.

### D. Popup Chọn Nguyên liệu & Bán thành phẩm (Ingredient & Semi-Finished Picker Modal)
- Bỏ dropdown `<select>` ở cột Nguyên liệu trong bảng ma trận. Tên nguyên liệu được hiển thị dưới dạng văn bản tĩnh rõ ràng:
  - Tên NVL / Bán thành phẩm (in đậm, to rõ).
  - Phân loại (`Nguyên liệu thô` / `Bán thành phẩm`) và đơn giá vốn tham khảo.
- Khi bấm nút `+ Thêm nguyên liệu`:
  - Mở Popup `IngredientPickerModal`:
    - Thanh tìm kiếm nhanh theo tên hoặc mã nguyên liệu.
    - Bộ lọc/Tab: `Tất cả` | `Nguyên liệu thô` | `Bán thành phẩm`.
    - Danh sách các nguyên liệu/bán thành phẩm với checkbox chọn nhiều (Multi-select).
    - Hiển thị rõ: Tên, Đơn vị, Giá vốn hiện tại, Tồn kho.
    - Đánh dấu trạng thái các nguyên liệu đã có sẵn trong công thức để tránh thêm trùng lặp (hoặc cảnh báo).
    - Footer: Hiển thị "Đã chọn X mục", nút "Hủy", nút "Thêm vào công thức (X)".
  - Khi xác nhận thêm:
    - Bổ sung ngay X hàng tương ứng vào bảng ma trận.
    - Mỗi hàng sẵn sàng để người dùng nhập định lượng cho từng size.

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)
- [ ] Popup form có chiều rộng rộng rãi (1040px), hiển thị các size thoáng đãng.
- [ ] Bỏ nút sao (⭐) ở header cột size, chỉ giữ Tên size và Giá bán + Nút ✕ xóa.
- [ ] Bỏ cột đơn vị riêng; đơn vị tính (`g`, `ml`...) hiển thị trực tiếp sau con số nhập liệu của từng size.
- [ ] Bỏ thẻ `<select>` dropdown ở cột Nguyên liệu; hiển thị tên nguyên liệu dạng text rõ ràng kèm nút 🗑️ xóa hàng.
- [ ] Bấm `+ Thêm nguyên liệu` mở Popup Modal chọn nguyên liệu & bán thành phẩm dạng Multi-select checkbox.
- [ ] Chọn X nguyên liệu/bán thành phẩm và bấm xác nhận $\rightarrow$ Tự động render đúng X hàng mới vào bảng ma trận.
- [ ] Chân Popup vẫn giữ đúng 2 nút: "Xóa món" và "Lưu thay đổi".
- [ ] Cả frontend và backend biên dịch sạch 0 lỗi (`npx tsc --noEmit`).

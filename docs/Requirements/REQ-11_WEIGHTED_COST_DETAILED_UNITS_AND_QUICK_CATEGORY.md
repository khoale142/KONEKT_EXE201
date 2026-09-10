# BẢN ĐẶC TẢ YÊU CẦU: TÍNH GIÁ VỐN BÌNH QUÂN GIA QUYỀN, ĐƠN VỊ TÍNH CHI TIẾT CÓ TÌM KIẾM VÀ TẠO NHANH DANH MỤC
**Mã yêu cầu**: `REQ-11`  
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Người yêu cầu**: Chủ quán (Owner)  
**Người thực hiện**: Antigravity AI Agent  
**Trạng thái**: Đã hoàn thành nghiệm thu (Completed)  

---

## 1. Bối cảnh & Vấn đề thực tế (Problem Statement)
1. **Giá vốn cứng nhắc, không phản ánh thực tế mua hàng**:
   - Hiện tại, ô "Giá vốn (VNĐ/đv)" chỉ cho phép nhập một con số cố định (ví dụ: 100 đ/g).
   - Thực tế trong quán cà phê / F&B: Chủ quán thường mua nguyên liệu theo kiện, thùng, bao, hộp lớn (ví dụ: 1 bao cà phê 5kg giá 900.000đ $\rightarrow$ giá vốn thực tế là 180 đ/g; hoặc 1 thùng sữa 12 hộp 1L giá 420.000đ $\rightarrow$ 35 đ/ml).
   - Hơn nữa, mỗi lần nhập hàng là giá lại biến động lên xuống theo thị trường. Chủ quán cần cơ chế **tính toán giá trị tồn kho trung bình (bình quân gia quyền - Weighted Average Cost)**: Hàng nhập về tính trung bình chia ra giá trị rồi đưa vào cost, giúp giá vốn phản ánh chính xác chi phí vận hành.
2. **Đơn vị tính hạn chế & thiếu tìm kiếm**:
   - Hiện tại chỉ có dropdown cố định 8 đơn vị cơ bản. Ngành F&B cần hệ thống đơn vị phong phú (khối lượng, thể tích, đóng gói bao bì, định lượng pha chế như pump, shot, muỗng, lát, lá...). Cần có thanh tìm kiếm nhanh và cho phép tùy chỉnh đơn vị.
3. **Thiếu cơ chế tạo nhanh danh mục trực tiếp**:
   - Khi đang tạo món bán mới hoặc nguyên liệu mới, nếu danh mục mong muốn chưa có, người dùng phải thoát ra ngoài tạo danh mục rồi quay lại.
   - Chủ quán yêu cầu: Cho phép tạo nhanh danh mục ngay trong modal (cả món bán và nguyên liệu); tạo xong sẽ tự động chọn (`auto-select`) vào form luôn mà không bị gián đoạn.

---

## 2. User Stories
- **US-01 (Máy tính Giá vốn & Bình quân kho)**: Là Chủ quán, tôi muốn có công cụ tính toán quy đổi giá gói/bao mua về và tính giá vốn bình quân gia quyền theo tồn kho để tự động điền vào giá vốn nguyên liệu mà không cần phải lấy máy tính cầm tay bấm bên ngoài.
- **US-02 (Đơn vị tính chi tiết & Tìm kiếm)**: Là Chủ quán, tôi muốn lựa chọn đơn vị tính từ danh sách đầy đủ chuẩn F&B có ô tìm kiếm nhanh, hoặc tự gõ đơn vị tùy ý để quản lý nguyên liệu chính xác.
- **US-03 (Tạo nhanh Danh mục)**: Là Chủ quán, khi đang tạo món hoặc nguyên liệu mà chưa có danh mục, tôi muốn có nút tạo nhanh ngay cạnh dropdown để tạo và gán luôn vào item hiện tại.

---

## 3. Phạm vi tính năng (Scope of Work)
### In-scope:
- **Công cụ Máy tính Giá vốn Thông minh (Cost Calculator Tool)** ngay tại ô Giá vốn:
  - *Chế độ 1 - Quy đổi theo gói / lô hàng*: Nhập Tổng số tiền mua gói + Số lượng đóng gói $\rightarrow$ Tính ra giá vốn / đơn vị pha chế.
  - *Chế độ 2 - Bình quân gia quyền tồn kho*: Tồn hiện tại (SL tồn $\times$ Giá cũ) + Nhập đợt này (SL nhập $\times$ Giá mới) $\rightarrow$ Tự động tính giá vốn bình quân mới $\rightarrow$ Bấm 1 nút "Áp dụng vào giá vốn".
- **Bộ chọn Đơn vị tính F&B Searchable (`SearchableUnitSelect`)**:
  - Hơn 25+ đơn vị chuẩn chia thành 4 nhóm: Khối lượng, Thể tích, Đóng gói/Bao bì, Định lượng pha chế.
  - Thanh tìm kiếm lọc tức thì; hỗ trợ nhập đơn vị tùy chỉnh (Custom unit).
- **Bộ Tạo nhanh Danh mục (Quick-create Category)**:
  - Tích hợp tại Form Nguyên liệu (`scope="raw_material"`) và Form Món bán (`scope="product"`).
  - Gõ tên danh mục mới $\rightarrow$ Bấm Tạo / Enter $\rightarrow$ Gọi API $\rightarrow$ Tự động gán `categoryId` và cập nhật danh sách hiển thị.

---

## 4. Tiêu chí nghiệm thu (Acceptance Criteria)
- [x] Bấm mở "Máy tính giá vốn" hiển thị công cụ trực quan, tính toán chính xác cả 2 chế độ (quy đổi gói và bình quân tồn kho).
- [x] Bấm "Áp dụng" sẽ tự động điền con số đã tính vào ô Giá vốn (người dùng vẫn chỉnh sửa thủ công được nếu muốn).
- [x] Dropdown Đơn vị tính có thanh tìm kiếm, đầy đủ đơn vị F&B, chọn mượt mà.
- [x] Tạo nhanh danh mục thành công ngay trong popup, tự động chọn danh mục mới tạo và đồng bộ sang danh sách bên ngoài.
- [x] Tuân thủ 100% màu KONEKT (`#3D503C`, `#F8F6F1`) và 0 lỗi TypeScript.

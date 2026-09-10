# ĐẶC TẢ YÊU CẦU: TÁI CẤU TRÚC BỐ CỤC GIỎ HÀNG TINH GỌN, CHUYỂN VOUCHER SANG CỘT KHÁCH HÀNG & ĐƯA GIẢM GIÁ NHANH VÀO THANH TOÁN
**Mã định danh**: `REQ-14`  
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày lập**: 10/09/2026  
**Người yêu cầu**: Chủ quán  
**Người thực hiện**: Antigravity AI Agent  
**Trạng thái**: Chờ duyệt (Pending Approval)  

---

## 1. BỐI CẢNH & MỤC TIÊU CẢI TIẾN (CONTEXT & OBJECTIVES)

Hiện tại trên giao diện bán hàng POS (`PosOrderPage.tsx`), cột bên trái (Giỏ hàng) đang bị dồn quá nhiều khối phụ:
- Khối Giảm giá nhanh (% Chiết khấu)
- Khối Voucher / Promotion (Nhập mã, chọn chương trình)

Điều này khiến cột giỏ hàng bị phân tán, danh sách món bị thu hẹp chiều cao cuộn, và thu ngân dễ bị rối mắt khi thao tác chọn món. Đồng thời:
1. Ưu đãi (Voucher/Promotion) bản chất gắn liền với Khách hàng / Hội viên (nhập số điện thoại khách -> áp dụng mã ưu đãi của khách).
2. Giảm giá nhanh (% chiết khấu thủ công của quán) là thao tác phát sinh tại thời điểm tính tiền, khi thu ngân xác nhận hóa đơn với khách.

### Mục Tiêu Cải Tiến Cốt Lõi:
1. **Tinh giản tối đa cột Giỏ hàng (Cột trái)**: Chỉ hiển thị danh sách món, tùy chọn món, tổng tiền đơn hàng (Subtotal, Giảm giá ưu đãi, Tổng thanh toán) và các nút thao tác chính. Không còn bất kỳ khối điều khiển phụ nào gây vướng víu.
2. **Chuyển Voucher / Promotion sang cột Phải (bên dưới Khách hàng/Member) thành Session 2**:
   - `Session 1`: Khách hàng / Thành viên (Số điện thoại, điểm tích lũy, tạo tài khoản).
   - `Session 2`: Ưu đãi & Khuyến mãi (Voucher / Promotion - Nhập mã, chọn chương trình, quà tặng).
   - `Session 3`: Định danh phục vụ (Số bàn / Thẻ số / STT / Tên / Bán nhanh - theo cấu hình duy nhất của quán).
3. **Đưa Giảm giá nhanh (% Chiết khấu) vào màn hình Thanh toán (Payment screen)**:
   - Khi thu ngân bấm *"Chọn thanh toán"*, khối chọn chiết khấu nhanh `%` sẽ xuất hiện ngay phía trên lựa chọn phương thức thanh toán (Tiền mặt / Chuyển khoản VietQR), cho phép thu ngân quyết định giảm giá ngay lúc chốt bill.

---

## 2. CHI TIẾT CÁC THAY ĐỔI THEO KHU VỰC GIAO DIỆN

### A. Cột 1 - Giỏ Hàng (Cart Rail - Cột Trái):
- **Loại bỏ**:
  - Gỡ bỏ hoàn toàn khối `Giảm giá nhanh (% Chiết khấu)` khỏi giỏ hàng.
  - Gỡ bỏ hoàn toàn khối `Voucher / Promotion` khỏi giỏ hàng.
- **Giữ lại & Tối ưu hóa**:
  - Header `Giỏ hàng` (hiển thị số lượng món).
  - Danh sách sản phẩm trong giỏ: Tên món, phân loại size, toppings, ghi chú, nút tăng/giảm số lượng `+` / `-`, nút xóa món `x`.
  - Danh sách Combo món (nếu có).
  - **Khối Tổng giá trị đơn hàng (Cart Summary)**:
    - Tạm tính (Subtotal).
    - Giảm giá từ Voucher / Promotion (nếu có áp dụng từ session bên phải).
    - Giảm giá nhanh thủ công (nếu đã thiết lập trước đó).
    - **Tổng tiền thanh toán (Total Payable)** nổi bật, cỡ chữ lớn, dễ nhìn.
  - **Cụm nút điều hướng chính**:
    - Nút `Chọn thanh toán` (Chuyển sang bước thanh toán).
    - Nút `Giữ đơn` (Lưu đơn tạm).
    - Nút `Xóa giỏ` (Làm mới đơn).

### B. Cột 2 - Vùng Chọn Món / Thực Đơn (Center Ordering Workspace):
- **Bổ sung Tab "Tất cả" (All Categories)**:
  - Trên thanh lọc danh mục, bổ sung nút `Tất cả` (`ALL`) ở vị trí đầu tiên.
  - Khi chọn `Tất cả`: Hiển thị toàn bộ các món trong thực đơn của quán.
  - Thu ngân có thể bấm chọn từng danh mục cụ thể (`Cà phê`, `Trà`, `Nước ép`...) hoặc chọn `Tất cả` để tìm nhanh.
- **Phẳng hóa món ăn & biến thể (Flattened Item Grid - 1 Size = 1 Item)**:
  - **Xóa bỏ cấu trúc thẻ bọc ngoài chứa nhiều size con**: Không còn kiểu Card sản phẩm to chứa các nút `Size S`, `Size M`, `Size L` nhỏ bên trong.
  - **Mỗi size đóng vai trò là một Item/Card độc lập**:
    - Ví dụ: Thay vì 1 card `Bạc sỉu` có 3 nút size bên trong, giao diện hiển thị 3 card riêng biệt:
      * Card 1: `Bạc Sỉu Đá - Size S` | `29.000đ`
      * Card 2: `Bạc Sỉu Đá - Size M` | `34.000đ`
      * Card 3: `Bạc Sỉu Đá - Size L` | `39.000đ`
  - **Thiết kế Card món ăn chuẩn Thẩm mỹ Cao cấp**:
    - Bố cục gọn gàng, bo góc mềm mại (`rounded-xl` / `14px`), viền ấm `#DFD6C7`, nền kem mịn `#FAF7F2`.
    - Tên món hiển thị to rõ, phân loại Size trực quan (badge hoặc text size rõ ràng).
    - Giá tiền hiển thị nổi bật ở góc dưới với màu xanh rêu `#3D5E46` hoặc xanh rừng đậm `#27402F`.
    - Tương tác chạm tức thì: Click trực tiếp vào Card để thêm ngay món đó vào giỏ hàng (1-tap add to cart), có hiệu ứng active/hover nhạy bén.
    - Hiển thị số lượng món đó đang có trong giỏ hàng (nếu > 0) để thu ngân dễ theo dõi.

### C. Cột 3 - Khách Hàng & Phục Vụ (Right Rail - Cột Phải):
Tổ chức thành **3 Session** độc lập, ngăn nắp theo chiều dọc:

1. **Session 1: Khách hàng / Member**:
   - Ô nhập số điện thoại 10 số + nút `Tìm` + nút `Bỏ`.
   - Thông tin hội viên tìm thấy: Tên khách hàng, Số điểm hiện có.
   - Nút `Tạo member nhanh` khi số điện thoại chưa đăng ký.
   - Banner hướng dẫn tích điểm / tem.

2. **Session 2: Ưu đãi & Khuyến mãi (Voucher / Promotion)** *(Chuyển từ cột trái sang)*:
   - Header: `🎁 Ưu đãi & Khuyến mãi`.
   - 2 Tabs chuyển đổi: `Voucher` và `Promotion`.
   - Tab `Voucher`: Ô nhập mã voucher, nút `Áp` và `Bỏ`.
   - Tab `Promotion`: Mở giao diện chọn chương trình khuyến mãi tự động hoặc hiển thị danh sách khuyến mãi khả dụng.
   - Badge hiển thị mã đang áp dụng, quà tặng kèm (nếu có).

3. **Session 3: Mô Hình Bán Hàng & Định Danh**:
   - Card định danh theo 1 mô hình duy nhất do quán cài đặt (Số bàn, Thẻ số, STT, Tên khách, Bán nhanh).
   - Nút `[⚙️ Cài đặt]` mở nhanh modal cấu hình POS.
   - Input nhập và các chip gợi ý nhanh (Bàn 1, Bàn 2... hoặc Thẻ 01, Thẻ 02...).

### D. Màn Hình Thanh Toán (Payment Screen - `mode === "payment"`):
- Vị trí: Hiển thị khi thu ngân bấm *"Chọn thanh toán"*.
- **Tích hợp khối Giảm giá nhanh (% Chiết khấu)**:
  - Hiển thị dải nút phần trăm chiết khấu: `0%`, `5%`, `10%`, `15%`, `20%`, `50%`, `100% (Free)`.
  - Tự động trừ vào số tiền phải thu `payableTotal` và tính toán lại các gợi ý tiền mặt thông minh.
- **Phương thức thanh toán**:
  - `Tiền mặt`: Gợi ý tiền khách đưa chính xác, tiền chẵn 50k, 100k, 200k, 500k; tính tiền thối tự động.
  - `Chuyển khoản`: Tạo mã VietQR động theo đơn hàng.
- **Hành động**: Nút `Xác nhận thanh toán / Tạo bill` và nút `Quay lại giỏ hàng`.

---

## 3. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- [ ] Cột giỏ hàng bên trái chỉ hiển thị danh sách món, tổng giá trị total và các nút hành động; không còn khối giảm giá nhanh hay voucher.
- [ ] Cột bên phải có đầy đủ 3 Session: (1) Khách hàng / Member, (2) Ưu đãi & Khuyến mãi, (3) Định danh phục vụ theo cấu hình.
- [ ] Tính năng áp dụng Voucher / Promotion từ Session 2 bên phải hoạt động chuẩn xác, cập nhật ngay số tiền giảm vào tổng tiền ở cột giỏ hàng bên trái.
- [ ] Màn hình thanh toán (`mode === "payment"`) có khối chọn Giảm giá nhanh `%`, bấm chọn chiết khấu tính toán lại tổng tiền tức thì.
- [ ] Không có lỗi biên dịch TypeScript (`npx tsc --noEmit` Exit 0 trên cả backend và frontend).
- [ ] Kiểm thử trực quan và quay video/ảnh chụp màn hình nghiệm thu đầy đủ trên trình duyệt.

# ĐẶC TẢ PHẠM VI NGHIỆP VỤ & TÍNH NĂNG (SCOPE & FEATURES)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày cập nhật**: 08/09/2026  
**Phiên bản**: v2.0 (Restructured Scope)

---

## I. MỤC TIÊU HỆ THỐNG
Hệ thống là một nền tảng **Phần mềm dịch vụ Quản lý & Bán hàng F&B (SaaS Web POS)** toàn diện, hỗ trợ:
1. Người kinh doanh cà phê / đồ uống đăng ký mở tài khoản (Tenant Owner).
2. Quản lý linh hoạt từ 1 quán đơn lẻ cho đến chuỗi nhiều chi nhánh (Stores).
3. Đầy đủ nghiệp vụ từ Front-of-house (POS bán hàng tại quầy, KDS màn hình bếp, Bảng gọi số TV) đến Back-of-house (Định lượng công thức BOM, kiểm kê kho, chấm công, bảng lương, báo cáo P&L).
4. Kênh khách hàng tự đặt món online (Pick-up), thanh toán VietQR động, tích điểm và trợ lý ảo Chatbot AI.

---

## II. CHI TIẾT CÁC PHÂN HỆ TÍNH NĂNG

### 1. PHÂN HỆ BÁN HÀNG TẠI QUẦY (POINT OF SALE - POS)
* **Giao diện Bán hàng màn hình cảm ứng**:
  * Hiển thị danh mục sản phẩm trực quan, tìm kiếm món nhanh theo tên hoặc mã.
  * Tùy biến món chuyên sâu: Chọn kích cỡ (Size), mức đường, mức đá, danh sách Topping thêm.
  * Tự động nhận diện và kích hoạt **Combo Rules** (ví dụ: Mua Cà phê + Bánh ngọt tự động giảm 15.000đ).
  * Kiểm tra và áp dụng Voucher / Mã khuyến mãi hợp lệ.
* **Quy trình Thanh toán**:
  * Thanh toán Tiền mặt (tự động tính tiền thừa trả khách).
  * Thanh toán **VietQR động**: Tự động sinh mã QR với số tiền và mã đơn hàng duy nhất; tự động bắt Webhook ngân hàng (qua Casso) để xác nhận thanh toán thành công tức thì không cần chụp bill.
* **Nghiệp vụ Thu ngân Nâng cao**:
  * **Giữ đơn (Hold Order)**: Lưu tạm hóa đơn đang chọn khi khách cần thời gian suy nghĩ/thanh toán, phục vụ khách tiếp theo và khôi phục lại đơn giữ bất cứ lúc nào.
  * **Hóa đơn đã thanh toán**: In lại hóa đơn, xem chi tiết lịch sử.
  * **Hủy hóa đơn (Void)** & **Hoàn tiền (Refund)**: Hủy đơn hoặc hoàn tiền theo quy định phân quyền (Owner/Store Manager có quyền trực tiếp, Staff cần quản lý duyệt).
  * **Xác nhận đơn Online**: Tiếp nhận và xác nhận các đơn đặt trước từ khách hàng online.
  * **Bàn giao đồ uống (Pickup Station)**: Chuyển trạng thái đơn sang sẵn sàng và phát tín hiệu gọi khách lấy đồ.
* **Mở/Đóng ca & Quản lý Két tiền (Shift Reconciliation)**:
  * Khai báo số tiền mặt lẻ ban đầu khi mở ca.
  * Đếm tiền mặt thực tế khi kết thúc ca, đối soát với số liệu doanh thu tiền mặt trên hệ thống, tự động tính chênh lệch thừa/thiếu.
* **Màn hình Phụ hướng về Khách hàng (Customer Preview)**: Màn hình thứ hai hiển thị danh sách món đang order, tổng tiền và mã QR thanh toán đối diện khách hàng.
* **Bảng Gọi số Công cộng (Public Pickup Board)**: Màn hình TV hiển thị danh sách đơn "Đang chuẩn bị" và "Mời lấy đồ" đặt tại sảnh chờ.

---

### 2. PHÂN HỆ ĐIỀU PHỐI BẾP / QUẦY BAR (KITCHEN DISPLAY SYSTEM - KDS)
* Nhận đơn tức thì theo thời gian thực từ máy POS và Đơn đặt online.
* Hiển thị thẻ đơn theo thứ tự thời gian đặt hàng (FIFO - First In First Out) hoặc thứ tự ưu tiên.
* Hiển thị chi tiết từng món kèm ghi chú pha chế (ít đường, không đá, thêm thạch,...).
* Thao tác 1-chạm cập nhật tiến độ: `Chờ pha chế` ➔ `Đang pha chế` ➔ `Hoàn thành`.

---

### 3. PHÂN HỆ THỰC ĐƠN & ĐỊNH LƯỢNG NGUYÊN VẬT LIỆU (MENU & RECIPES/BOM)
* **Quản lý Thực đơn (Menu Management)**:
  * Quản lý nhóm/danh mục sản phẩm.
  * Quản lý sản phẩm, hình ảnh, mô tả, trạng thái (Đang bán / Tạm ngưng).
  * Thiết lập giá bán cơ bản và phụ thu theo biến thể (Size L +10k, Topping trân châu +5k).
  * Tùy chọn cấu hình giá riêng theo từng chi nhánh nếu cần.
* **Công thức & Định lượng (Bill of Materials - BOM / Recipe)**:
  * Khai báo danh sách nguyên vật liệu cấu thành cho từng món (VD: 1 Ly Bạc sỉu = 25g Hạt cà phê + 40ml Sữa đặc + 100ml Sữa tươi).
  * **Bán thành phẩm (Semi-finished Goods)**: Khai báo các món sơ chế sẵn (cốt trà ủ sẵn, nước đường nấu, sốt phô mai).
  * **Cơ chế Trừ kho Tự động**: Ngay khi một hóa đơn được thanh toán trên POS hoặc khách nhận món online, hệ thống tự động bóc tách định lượng công thức và trừ trực tiếp vào tồn kho của Store tương ứng.
* **Chương trình Khuyến mãi & Quy tắc Combo**:
  * Cấu hình Combo tự động: Định nghĩa các nhóm sản phẩm đi kèm nhau để giảm giá trực tiếp trên hóa đơn.
  * Thiết lập chiến dịch khuyến mãi theo % hoặc số tiền, giới hạn ngân sách, khung giờ vàng áp dụng.

---

### 4. PHÂN HỆ QUẢN LÝ KHO & NGUYÊN VẬT LIỆU (INVENTORY MANAGEMENT)
* **Danh mục Nguyên vật liệu**:
  * Quản lý tên nguyên liệu, phân loại, đơn vị lưu kho (g, ml, chai, lon, gói) và đơn vị nhập (kg, thùng, lốc).
  * Thiết lập ngưỡng tồn kho an toàn (Cảnh báo khi số lượng thực tế dưới mức tối thiểu).
* **Nhập kho hàng (Goods Receipt)**:
  * Tạo phiếu nhập kho từ nhà cung cấp kèm giá nhập và hạn sử dụng (HSD).
  * Tự động cộng tồn kho và cập nhật giá vốn bình quân (Moving Average Cost).
* **Kiểm kê Kho Định kỳ / Theo ca (Inventory Audit)**:
  * Khởi tạo kỳ kiểm kê theo ngày hoặc theo ca làm việc.
  * Nhân viên nhập số lượng kiểm đếm thực tế; hệ thống so sánh với tồn kho lý thuyết (dựa trên nhập - bán theo công thức).
  * Báo cáo chênh lệch thừa/thiếu để quản lý xử lý.
* **Hư hao & Hủy kho (Disposals / Waste Management)**:
  * Nhân viên ghi nhận các sự cố đổ vỡ, nguyên liệu hết hạn trong ca.
  * Quản lý cửa hàng tổng hợp thành **Lệnh hủy kho** và gửi Owner phê duyệt để xuất hủy khỏi hệ thống.
* **Điều chuyển Kho (Inter-store Transfer)**: Hỗ trợ điều chuyển nguyên vật liệu từ Store A sang Store B để ứng phó khi thiếu hàng.

---

### 5. PHÂN HỆ QUẢN TRỊ NHÂN SỰ & CHẤM CÔNG (STAFF & PAYROLL)
* **Hồ sơ Nhân sự**: Lưu trữ thông tin cá nhân, chức vụ, mức lương thỏa thuận (theo giờ hoặc cố định theo tháng), tài liệu CCCD/CMND.
* **Xếp lịch làm việc (Shift Scheduling)**:
  * Tạo các ca làm việc (Ca sáng, Ca chiều, Ca gãy).
  * Lên lịch làm việc tuần/tháng cho nhân viên từng chi nhánh.
  * Xử lý yêu cầu xin đổi ca, xin nghỉ phép của nhân viên.
* **Chấm công (Timekeeping)**:
  * Nhân viên Check-in / Check-out ca làm việc trực tiếp trên hệ thống.
  * Đối chiếu giờ chấm công thực tế với lịch làm việc phân công để tính giờ công chuẩn, đi muộn, về sớm.
* **Bảng tính lương (Payroll)**:
  * Tự động tổng hợp giờ làm thực tế nhân với mức lương cơ bản.
  * Thêm các khoản phụ cấp hoặc khấu trừ vi phạm.
  * Cho phép Owner/Quản lý chốt bảng lương hàng tháng và xuất phiếu lương cho nhân viên.

---

### 6. PHÂN HỆ BÁO CÁO & PHÂN TÍCH KINH DOANH (ANALYTICS & REPORTS)
* **Dashboard Tổng quan**:
  * Doanh thu tức thời, số lượng hóa đơn, giá trị trung bình mỗi đơn (AOV).
  * Biểu đồ doanh thu theo giờ trong ngày, theo ngày trong tuần, theo tháng.
  * Xếp hạng món bán chạy nhất (Top Sellers) và món có lợi nhuận cao nhất.
* **Báo cáo So sánh Chi nhánh**: So sánh hiệu quả kinh doanh, tỷ lệ tăng trưởng giữa các Store trong chuỗi.
* **Báo cáo Giá vốn & Lợi nhuận (COGS & Profit Margins)**: Phân tích doanh thu trừ đi chi phí nguyên vật liệu (dựa trên công thức BOM) để tính toán lợi nhuận gộp thực tế.
* **Báo cáo Thất thoát & Chênh lệch**:
  * Chênh lệch tiền két thu ngân giữa các ca làm việc.
  * Chênh lệch hao hụt nguyên vật liệu giữa tồn kho lý thuyết và kiểm kê thực tế.
* **Nhật ký Thao tác (Action Audit Logs)**: Ghi lại toàn bộ thao tác nhạy cảm (sửa giá, hủy đơn, hoàn tiền, mở két) kèm thông tin người thực hiện và thời gian chính xác.

---

### 7. PHÂN HỆ KHÁCH HÀNG & BÁN HÀNG ONLINE (CUSTOMER PORTAL)
* **Đặt món Online (Pick-up)**:
  * Khách hàng quét mã QR hoặc truy cập link web của quán.
  * Xem menu trực quan, tùy chỉnh món, giỏ hàng tự nhận combo.
  * Chọn chi nhánh lấy món gần nhất và đặt hẹn giờ lấy món (Pickup time).
  * Thanh toán trực tuyến qua VietQR (tự động nhận tiền và gửi đơn thẳng vào POS/KDS).
* **Khách hàng Thân thiết (Loyalty & Rewards)**:
  * Đăng nhập/Đăng ký tài khoản hội viên qua số điện thoại/OTP.
  * Tích điểm trên mỗi đơn hàng (cả tại quầy POS và đặt online).
  * Thẻ tích tem đổi quà (mua 10 ly tặng 1 ly).
  * Ví Voucher cá nhân quản lý các mã giảm giá được cấp hoặc đổi từ điểm.
* **Trợ lý ảo Chatbot AI**:
  * Tự động phản hồi các câu hỏi thường gặp về quán (địa chỉ, giờ mở cửa, menu).
  * Nhận diện ý định gọi món và gợi ý các cặp đồ uống/món ăn kèm (`drink pairing`).
* **Đánh giá & Khiếu nại**:
  * Đánh giá chất lượng đơn hàng sau khi hoàn tất.
  * Gửi yêu cầu lùi giờ lấy món nếu đến muộn.
  * Tạo ticket phản ánh sự cố đơn hàng để quản lý xử lý kịp thời.

---

### 8. PHÂN HỆ QUẢN TRỊ NỀN TẢNG SAAS (PLATFORM ADMIN)
* **Đăng ký Mở quán Mới (Owner Onboarding)**: Luồng đăng ký tài khoản Owner từ trang chủ, tự động tạo Tenant và Store đầu tiên.
* **Quản lý Danh sách Tenant**: Tra cứu, theo dõi trạng thái hoạt động của các thương hiệu kinh doanh trên nền tảng.
* **Gói cước Dịch vụ (Subscriptions)**: Quản lý các gói dịch vụ phần mềm, thời hạn sử dụng, hỗ trợ gia hạn hoặc khóa quán khi hết hạn.

# ĐẶC TẢ PHÂN QUYỀN & VAI TRÒ NGƯỜI DÙNG (ROLES & PERMISSIONS)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Ngày cập nhật**: 08/09/2026  
**Phiên bản**: v2.0 (Restructured RBAC)

---

## I. MÔ HÌNH PHÂN CẤP VAI TRÒ (ROLE HIERARCHY)

Hệ thống được tái cấu trúc thành **5 vai trò người dùng chuẩn mực**:

```
[Level 4] Platform Super Admin (Quản trị nền tảng SaaS)
    │
[Level 3] Tenant Owner (Chủ thương hiệu / Toàn quyền trong Tenant)
    │
[Level 2] Store Manager (Quản lý Cửa hàng / Chi nhánh)
    │
[Level 1] Staff / Cashier / Barista (Nhân viên Quầy & Pha chế)
    │
[Level 0] Customer / Member (Khách hàng & Hội viên)
```

### Nguyên tắc Kế thừa Quyền hạn (Permission Inheritance):
* **Tenant Owner** tự động kế thừa toàn bộ quyền hạn của **Store Manager** và **Staff**.
* **Store Manager** tự động kế thừa quyền hạn của **Staff** trong phạm vi Store mình phụ trách.
* **Owner có quyền truy cập chéo (Cross-functional Access)**: Có thể vừa truy cập toàn bộ menu Quản trị Back-office, vừa mở giao diện POS của bất kỳ Store nào để bán hàng trực tiếp.

---

## II. ĐỊNH NGHĨA CHI TIẾT TỪNG VAI TRÒ

### 1. PLATFORM SUPER ADMIN (SaaS Platform Provider)
* **Khái niệm**: Đội ngũ quản trị hệ thống phần mềm SaaS.
* **Phạm vi tác động**: Toàn hệ thống (xuyên suốt các Tenant).
* **Quyền hạn chính**:
  * Xem danh sách tất cả các Tenant (Thương hiệu).
  * Kích hoạt, tạm ngưng hoặc khóa quyền truy cập của một Tenant (khi vi phạm chính sách hoặc hết hạn gói cước).
  * Quản lý các gói đăng ký dịch vụ (Gói Cơ bản 1 cửa hàng, Gói Chuỗi đa cửa hàng).
  * Xem báo cáo thống kê hạ tầng tổng quan (tổng số lượng giao dịch, dung lượng lưu trữ).

---

### 2. TENANT OWNER (Chủ thương hiệu / Quán)
* **Khái niệm**: Tài khoản đăng ký khởi tạo thương hiệu ban đầu. Là "Superuser" của Tenant.
* **Phạm vi tác động**: Toàn bộ dữ liệu của Tenant (bao gồm tất cả các Store trực thuộc).
* **Quyền hạn chi tiết**:
  * **Bán hàng tại Quầy (POS)**:
    * Được quyền chọn bất kỳ Store nào để mở màn hình bán hàng POS.
    * Có nút chuyển đổi nhanh 1-chạm giữa **[Bảng Quản trị]** và **[Màn hình POS]** trên thanh Header.
    * Thực hiện mọi thao tác thu ngân cao cấp: Mở ca, chốt ca, áp voucher, hủy đơn, hoàn tiền.
  * **Thực đơn & Công thức**:
    * Toàn quyền tạo/sửa/xóa danh mục, sản phẩm, biến thể, giá bán.
    * Định nghĩa công thức nguyên liệu (BOM) và bán thành phẩm để tự động trừ kho.
    * Tạo các quy tắc Combo giảm giá tự động, thiết lập chiến dịch khuyến mãi.
  * **Kho hàng & Chuỗi cung ứng**:
    * Xem tồn kho thực tế của toàn bộ các chi nhánh trong chuỗi.
    * Phê duyệt các đợt kiểm kê kho lớn có sai lệch.
    * Phê duyệt Lệnh hủy hàng (Disposal Orders) do các Store gửi lên.
    * Tạo lệnh điều chuyển nguyên vật liệu giữa các Store.
  * **Tài chính & Báo cáo**:
    * Xem Dashboard tổng hợp doanh thu, so sánh tăng trưởng giữa các Store.
    * Xem báo cáo Giá vốn hàng bán (COGS) và Lợi nhuận gộp từng món ăn/đồ uống.
    * Xem nhật ký thao tác thu ngân (Action Audit Log) để kiểm soát gian lận.
  * **Chi nhánh & Nhân sự**:
    * Mở thêm chi nhánh mới (Store #2, Store #3,...).
    * Tạo tài khoản, phân bổ nhân viên vào các chi nhánh, bật/tắt quyền hạn chi tiết.
    * Xem và chốt bảng tính lương nhân viên toàn chuỗi hàng tháng.

---

### 3. STORE MANAGER (Quản lý Cửa hàng / Chi nhánh)
* **Khái niệm**: Nhân sự được Owner bổ nhiệm để quản lý vận hành một hoặc nhiều Store cụ thể.
* **Phạm vi tác động**: Dữ liệu thuộc Store được phân công phụ trách.
* **Quyền hạn chi tiết**:
  * **Bán hàng & Quầy thu ngân**:
    * Đăng nhập vào POS của Store mình phụ trách để bán hàng trực tiếp.
    * Phê duyệt tại quầy yêu cầu hủy hóa đơn, hoàn tiền cho thu ngân.
    * Mở ca / Đóng ca đối soát két tiền cùng thu ngân.
  * **Vận hành Kho cơ sở**:
    * Nhận hàng từ nhà cung cấp: Kiểm đếm số lượng, kiểm tra HSD, tạo & xác nhận phiếu Nhập kho.
    * Khởi tạo các đợt Kiểm kê kho định kỳ tại cơ sở, duyệt kết quả kiểm đếm thực tế của nhân viên.
    * Rà soát các báo cáo hư hao trong ca của nhân viên, gom thành Lệnh hủy kho và gửi Owner duyệt.
  * **Nhân sự cơ sở**:
    * Xếp lịch làm việc theo ca (tuần/tháng) cho nhân viên thuộc chi nhánh mình.
    * Phê duyệt các yêu cầu xin nghỉ phép, đổi ca của nhân viên.
    * Giám sát chấm công hàng ngày (Check-in / Check-out).
    * Xem báo cáo doanh thu và dự tính quỹ lương của chi nhánh mình.
  * **Chăm sóc Khách hàng**:
    * Trực tiếp tiếp nhận và giải quyết các khiếu nại, phản hồi của khách tại Store mình.

---

### 4. STAFF / CASHIER / BARISTA (Nhân viên Quầy & Pha chế)
* **Khái niệm**: Nhân viên làm việc theo ca trực tiếp tại cửa hàng.
* **Phạm vi tác động**: Giới hạn trong ca làm việc tại Store được phân công.
* **Quyền hạn chi tiết**:
  * **Thu ngân (Cashier)**:
    * Đăng nhập máy POS của Store có ca làm việc.
    * Tạo đơn hàng, chọn tùy biến (đá, đường, topping), áp dụng voucher/combo.
    * Thu tiền mặt hoặc xuất mã VietQR động cho khách quét.
    * Giữ đơn tạm thời (Hold order) cho khách thanh toán sau.
    * Mở ca (khai báo tiền lẻ) và kết ca (đếm tiền nộp két).
    * *Ràng buộc an toàn*: Không được tự ý xóa hóa đơn đã in hoặc hoàn tiền nếu không có sự phê duyệt của Quản lý/Owner.
  * **Pha chế (Barista / Kitchen)**:
    * Xem màn hình KDS hiển thị danh sách đơn cần pha chế theo thứ tự.
    * Đọc ghi chú chi tiết từng món.
    * Cập nhật trạng thái: `Đang pha chế` ➔ `Hoàn thành`.
  * **Kho & Cá nhân**:
    * Nhập số lượng kiểm đếm thực tế khi tham gia ca kiểm kê kho.
    * Tạo phiếu báo cáo hư hao nguyên liệu khi có sự cố đổ vỡ trong ca.
    * Xem lịch làm việc cá nhân, gửi yêu cầu xin nghỉ / đổi ca.
    * Chấm công vào/ra ca (Check-in / Check-out).
    * Xem phiếu lương cá nhân hàng tháng.

---

### 5. CUSTOMER / MEMBER (Khách hàng & Hội viên)
* **Khái niệm**: Người tiêu dùng mua hàng online hoặc tại quầy.
* **Phạm vi tác động**: Dữ liệu tài khoản cá nhân của chính mình.
* **Quyền hạn chi tiết**:
  * **Đặt món Online (Pick-up)**: Xem menu chi nhánh gần nhất, chọn món, giỏ hàng tự nhận combo, chọn giờ lấy món, thanh toán VietQR.
  * **Khách hàng thân thiết**: Tích điểm qua số điện thoại/QR hội viên, đổi điểm lấy voucher, tích tem đổi quà.
  * **Theo dõi đơn & Đánh giá**: Theo dõi trạng thái đơn hàng, đánh giá chất lượng món, gửi khiếu nại sự cố đơn hàng.
  * **Trợ lý Chatbot**: Trò chuyện với Chatbot AI để tra cứu thông tin menu, tìm quán, hỏi gợi ý đồ uống.

---

## III. MA TRẬN PHÂN QUYỀN THEO HÀNH ĐỘNG (CRUD PERMISSION MATRIX)

| Mã Phân Hệ | Nhóm Chức Năng | Platform Admin | Tenant Owner | Store Manager | Staff | Customer |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `POS_SELL` | Mở máy POS bán hàng | ❌ | ✅ Toàn bộ Store | ✅ Store phụ trách | ✅ Store phụ trách | ❌ |
| `POS_VOID` | Hủy hóa đơn / Hoàn tiền | ❌ | ✅ Toàn quyền | ✅ Toàn quyền | ⚠️ Cần duyệt | ❌ |
| `POS_CASH` | Khai báo tiền & Đóng ca | ❌ | ✅ | ✅ | ✅ | ❌ |
| `KDS_VIEW` | Màn hình Bếp Barista | ❌ | ✅ | ✅ | ✅ | ❌ |
| `MENU_MGT` | Quản lý Món & Giá bán | ❌ | ✅ Toàn quyền | ⚠️ Cấu hình riêng | ❌ | 👁️ Chỉ xem |
| `BOM_MGT`  | Công thức & Định lượng | ❌ | ✅ Toàn quyền | 👁️ Chỉ xem | ❌ | ❌ |
| `INV_IN`   | Phiếu Nhập kho | ❌ | ✅ Tạo & Duyệt | ✅ Tạo & Duyệt | 📝 Tạo phiếu | ❌ |
| `INV_AUD`  | Kiểm kê kho định kỳ | ❌ | ✅ Duyệt cuối | ✅ Khởi tạo & Duyệt | 📝 Đếm số tồn | ❌ |
| `INV_WASTE`| Lệnh hủy kho hư hao | ❌ | ✅ Duyệt Lệnh hủy | ✅ Lập lệnh hủy | 📝 Báo hư ca | ❌ |
| `HR_SCHED` | Xếp lịch làm việc tuần | ❌ | ✅ Toàn quyền | ✅ Store phụ trách | 👁️ Xem lịch mình | ❌ |
| `HR_TIME`  | Chấm công Check-in/out | ❌ | ✅ | ✅ | ✅ | ❌ |
| `HR_PAY`   | Bảng tính & Chốt lương | ❌ | ✅ Chốt lương chuỗi | 👁️ Xem dự tính | 👁️ Xem lương mình | ❌ |
| `REP_CHAIN`| Báo cáo Doanh thu chuỗi | ❌ | ✅ Toàn chuỗi | ❌ | ❌ | ❌ |
| `REP_STORE`| Báo cáo Doanh thu 1 quán | ❌ | ✅ Toàn quyền | ✅ Store phụ trách | 👁️ Doanh số ca | ❌ |
| `REP_COGS` | Báo cáo Giá vốn & Lãi gộp | ❌ | ✅ Toàn quyền | ❌ | ❌ | ❌ |
| `CUST_ORD` | Đặt món Online Pick-up | ❌ | ❌ | ❌ | ❌ | ✅ |
| `CUST_LOY` | Tích điểm & Đổi quà | ❌ | ⚙️ Cấu hình | 👁️ Tra cứu quầy | 👁️ Tra cứu quầy | ✅ Sở hữu |
| `SAAS_TEN` | Quản lý danh sách Tenant | ✅ Toàn quyền | ❌ | ❌ | ❌ | ❌ |
| `SAAS_REG` | Đăng ký mở quán (Tenant) | ❌ | 📝 Tự đăng ký | ❌ | ❌ | ❌ |


## Bổ sung PLAN-15B — 12/09/2026
- Luồng mời/duyệt nhân sự chỉ dành cho Owner (hoặc platform_admin trong tenant hợp lệ). Manager/Leader/Staff không được lấy mã quản trị hoặc duyệt, kể cả khi dữ liệu customPermissions cũ còn can_invite_staff.
- Ba role được Owner phân khi duyệt: staff, shift_leader, store_manager. Nguyện vọng ứng tuyển không quyết định role.
- Staff và Shift Leader: portal STORE, trang /store/staff. Store Manager: portal STORE, trang /store/manager. Cả ba chỉ được chọn store đã phân công.
- Tài khoản chưa phân store mang scope onboarding: chỉ được me, kiểm tra mã, gửi yêu cầu, xem trạng thái cá nhân và làm mới/kích hoạt phiên. Token onboarding cũ không trở thành token nghiệp vụ chỉ vì DB đã duyệt.
- Login/me/refresh/switch dùng cùng resolver KONEKT; tài khoản và store bị khóa được kiểm tra từ DB. Phiên cũ thiếu nguồn định danh KONEKT phải đăng nhập lại.
- Owner nhiều thương hiệu vẫn dùng nhiều membership. Chỉ các membership đã chứng minh bằng mật khẩu lúc login mới nằm trong session; cùng email không tự cấp quyền.
- Quy định này bổ sung phần onboarding; không xác nhận toàn bộ module kho, lịch, lương, KDS hoặc thanh toán legacy đã chuyển đổi sang schema mới.
- Bằng chứng: [VERIFY-15B](Developing/logs/VERIFY-15B_STAFF_ONBOARDING.md).

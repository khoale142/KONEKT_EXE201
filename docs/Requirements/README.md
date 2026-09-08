# TỔNG QUAN THƯ MỤC YÊU CẦU (REQUIREMENTS DIRECTORY)
**Vị trí**: `docs/Requirements/`  
**Mục đích**: Nơi lưu trữ toàn bộ các văn bản đặc tả yêu cầu (Requirement Specifications / PRD) của hệ thống. Mỗi mục tiêu hoặc tính năng mới đều phải được quy đổi thành một file Requirement tại đây trước khi lập kế hoạch và code.

---

## 📌 QUY CHUẨN ĐẶT TÊN FILE REQUIREMENT
* Cú pháp: `REQ-<Số thứ tự>_<Tên_viết_tắt>.md`
* Ví dụ:
  * `REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md` (Tái cấu trúc vai trò & Phân tách Tenant)
  * `REQ-02_RECIPE_BOM_AUTO_INVENTORY.md` (Quản lý công thức định lượng & trừ kho tự động)
  * `REQ-03_OWNER_ONBOARDING_FLOW.md` (Luồng đăng ký mở quán cho Owner mới)

---

## 📋 CẤU TRÚC CHUẨN CỦA MỘT TÀI LIỆU REQUIREMENT
Mỗi file requirement cần đảm bảo các phần sau:
1. **Thông tin chung**: Mã ID, Tên tính năng, Người đề xuất, Trạng thái (`Draft` / `Approved` / `In Progress` / `Completed`).
2. **Bối cảnh & Mục tiêu (Context & Objectives)**: Nêu rõ bài toán cần giải quyết.
3. **User Stories**:
   * *Là một [Vai trò], tôi muốn [Làm gì], để [Đạt được lợi ích gì]*.
4. **Phạm vi (Scope)**:
   * **In-Scope**: Các tính năng bắt buộc phải làm.
   * **Out-of-Scope**: Các phần chưa làm trong đợt này.
5. **Tiêu chí Nghiệm thu (Acceptance Criteria - AC)**: Dạng checklist chi tiết `[ ]` để kiểm thử xác nhận hoàn thành.

---

## 📑 DANH SÁCH YÊU CẦU ĐANG QUẢN LÝ
| Mã REQ | Tên Yêu Cầu | Trạng thái | Ngày tạo |
| :--- | :--- | :---: | :---: |
| [REQ-01](./REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md) | Tái cấu trúc Role (Owner-Centric) & Cô lập Dữ liệu Multi-Tenancy | `Approved` | 08/09/2026 |

# THƯ MỤC TÀI LIỆU HỆ THỐNG (SYSTEM DOCUMENTATION)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Đường dẫn thư mục**: `docs/`  
**Ngày cập nhật**: 08/09/2026  

---

## 📁 CẤU TRÚC PHÂN CẤP TÀI LIỆU DỰ ÁN

```
docs/
├── AI Rules/                        <-- QUY CHUẨN LÀM VIỆC CỦA AI AGENT
│   └── AI_RULES.md                  <-- Quy tắc tối thượng, quy chuẩn tech stack, workflow 5 bước
│
├── Requirements/                    <-- ĐẶC TẢ YÊU CẦU NGHIỆP VỤ (PRD)
│   ├── README.md                    <-- Hướng dẫn quản lý yêu cầu & danh mục REQ
│   └── REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md <-- Yêu cầu tái cấu trúc Role & Multi-Tenant
│
├── Developing/                      <-- QUÁ TRÌNH PHÁT TRIỂN & NHẬT KÝ
│   ├── README.md                    <-- Tổng quan tiến trình phát triển
│   ├── plans/                       <-- KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT
│   │   └── README.md                <-- Hướng dẫn lập plan & danh sách PLAN-XX
│   └── logs/                        <-- NHẬT KÝ THAY ĐỔI & GOTCHAS
│       └── DEV_CHANGELOG.md         <-- Đọc file này để nắm ngữ cảnh nhanh mà không cần scan code
│
├── SCOPE_AND_FEATURES.md            <-- Chi tiết 8 phân hệ nghiệp vụ hệ thống Web POS
├── ROLES_AND_PERMISSIONS.md         <-- Ma trận phân quyền 5 vai trò (CRUD matrix)
└── MULTI_TENANT_ARCHITECTURE.md     <-- Kiến trúc Row-Level Tenancy, JWT context & Onboarding
```

---

## ⚡ HƯỚNG DẪN DÀNH CHO AI AGENT / LẬP TRÌNH VIÊN MỚI
Khi bắt đầu một phiên làm việc mới, bạn **BẮT BUỘC** phải tuân thủ:
1. Đọc ngay [docs/AI Rules/AI_RULES.md](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/docs/AI%20Rules/AI_RULES.md) để ghi nhớ các quy tắc bất di bất dịch.
2. Đọc các log gần nhất trong [docs/Developing/logs/DEV_CHANGELOG.md](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/docs/Developing/logs/DEV_CHANGELOG.md) để nắm nhanh tiến độ, các file đã sửa và các quyết định kỹ thuật trước đó.
3. Khi nhận mục tiêu mới: Lập file Requirement trong [docs/Requirements/](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/docs/Requirements/) ➔ Lập file Plan trong [docs/Developing/plans/](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/docs/Developing/plans/) ➔ Chờ User duyệt Plan ➔ Thực thi & Ghi log vào [docs/Developing/logs/DEV_CHANGELOG.md](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/docs/Developing/logs/DEV_CHANGELOG.md).

# KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT (ACTION PLANS)
**Vị trí**: `docs/Developing/plans/`  
**Mục đích**: Lưu trữ các bản kế hoạch thực thi trước khi tiến hành chỉnh sửa mã nguồn.

---

## 📌 QUY CHUẨN ĐẶT TÊN FILE KẾ HOẠCH
* Cú pháp: `PLAN-<Số thứ tự>_<Tên_kế_hoạch>.md`
* Ví dụ:
  * `PLAN-01_ROLE_RESTRUCTURING_PHASE1.md` (Kế hoạch tinh gọn Role nội bộ & Mở POS cho Owner)
  * `PLAN-02_DATABASE_MULTI_TENANT_MIGRATION.md` (Kế hoạch tạo bảng tenants & gắn tenant_id)
  * `PLAN-03_OWNER_ONBOARDING_FRONTEND.md` (Kế hoạch xây dựng giao diện đăng ký mở quán)

---

## 📋 CẤU TRÚC CHUẨN CỦA MỘT BẢN PLAN
1. **Thông tin chung**: Mã ID, Tên kế hoạch, Requirement liên kết (`REQ-XX`), Trạng thái (`Draft` / `Approved` / `In Progress` / `Completed`).
2. **Mục tiêu đợt thay đổi**: Kết quả kỳ vọng sau khi chạy plan này.
3. **Danh sách tập tin tác động**:
   * `[TẠO MỚI]`: đường dẫn file
   * `[CHỈNH SỬA]`: đường dẫn file
   * `[XÓA]`: đường dẫn file
4. **Các bước thực thi chi tiết (Step-by-step)**.
5. **Đánh giá rủi ro & Phương án dự phòng (Rollback plan)**.
6. **Kế hoạch kiểm thử & nghiệm thu (Verification plan)**.

## Kế hoạch bổ sung

| Kế hoạch | Phạm vi | Trạng thái |
|---|---|---|
| [PLAN-15B](./PLAN-15B_OWNER_STORE_INVITES_AND_STAFF_ACTIVATION.md) | Nối kín mã mời Owner, gia nhập Store, phân role và cập nhật phiên Staff | Code/database đã triển khai; API đạt, chờ browser |
| [PLAN-17](./PLAN-17_CANONICAL_ACCOUNT_MEMBERSHIP_FOUNDATION.md) | Phase 1: Account canonical, Tenant Membership và Store Access | Implemented — DB validation pending |
| [PLAN-18](./PLAN-18_UNIFIED_AUTH_AND_WORKSPACE_CONTEXT.md) | Phase 2: Unified Authentication & Workspace Context | Implemented — live DB rollout pending |

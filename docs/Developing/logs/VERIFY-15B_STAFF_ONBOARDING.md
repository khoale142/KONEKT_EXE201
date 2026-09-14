# VERIFY-15B — Owner mời nhân viên và kích hoạt Staff

**Thời gian:** 11–12/09/2026 (Asia/Saigon).  
**Trạng thái:** Đã triển khai code và migration; kiểm thử API/database đạt. Chưa nghiệm thu trình duyệt.  
**Phạm vi:** [PLAN-15B](../plans/PLAN-15B_OWNER_STORE_INVITES_AND_STAFF_ACTIVATION.md).

## 1. Database thực tế

Kết nối DATABASE_URL trong backend/.env, không in chuỗi kết nối hay mật khẩu. Audit trước thay đổi ghi nhận:

| Hạng mục | Trước | Sau migration và dọn fixture |
|---|---:|---:|
| tenants | 6 | 6 |
| stores | 6 | 6 |
| users | 12 | 12 |
| store_join_requests | 1 | 1 |
| Store thiếu mã | 0 | 0 |
| Request approved thiếu user_id | 1 | 1, giữ nguyên |
| Nhóm duplicate email chưa có tenant | 0 | 0 |
| Journal Drizzle | baseline 0000 | 0000 + 0001 |
| RLS trên 4 bảng nội bộ | tắt | bật |
| Quyền trực tiếp anon/authenticated trên 4 bảng | 56 grants | 0 |

Schema live đã có invite_code, custom_permissions, store_join_requests và role shift_leader; không cần tạo lại bảng. Đã áp dụng `backend/drizzle/0001_staff_onboarding_integrity.sql`, được sinh bằng Drizzle custom migration. Migration bổ sung:

- unique email chuẩn hóa cho nhóm users chưa có tenant;
- một pending request trên userId khác null;
- index lịch sử theo user và danh sách theo tenant/status;
- check status và assignedRole;
- RLS và thu hồi quyền Data API trên users/stores/tenants/store_join_requests. Backend dùng kết nối DB có bypassrls; API KONEKT tự kiểm tra JWT và tenant, không dùng Supabase Auth UUID.

Audit cuối xác nhận đủ bốn index mới, không còn constraint `verify15b_*`, số dữ liệu trở về baseline. Mã mời cũ không bị xoay lại.

**Bản ghi cần đối chiếu thủ công:** request ID 1, approved, user_id null, email khớp candidate user IDs 11 và 12. Không tự gộp, không xóa, không đổi mật khẩu hay chuyển lịch sử. `repair_staff_onboarding.ts` mặc định dry-run; `--apply` chỉ cấp mã còn thiếu. Việc liên kết tài khoản lịch sử cần xác định đúng danh tính trước.

**Lịch sử migration:** các PLAN trước đã dùng script riêng ngoài journal. 0001 được kiểm thử trên database mới đã audit, không chứng minh rằng chỉ chạy 0000 → 0001 sẽ dựng được một DB trống hoàn toàn. Custom snapshot vẫn kế thừa baseline; đợt hợp nhất lịch sử/schema toàn dự án cần audit riêng trước khi dùng generate/push rộng.

## 2. Thực thi và bằng chứng

Script `backend/src/scripts/test_staff_onboarding.ts` tạo API server riêng ở 127.0.0.1:3100 từ createApp, không khởi động cron gửi email. Fixture có prefix riêng, ID allowlist, không chạy khi NODE_ENV=production. Cleanup kiểm tra prefix tenant trước cascade và chỉ xóa user IDs của lần chạy.

| Lần chạy | Fixture prefix | Kết quả |
|---|---|---|
| Cơ bản, ba role | verify15b-1789145604353 | PASS; fixture đã dọn bằng manifest |
| Hồi quy, ba role | verify15b-1789145943834 | PASS; tự dọn fixture |
| Tập trung rollback/identity | verify15b-1789146158234 | PASS; tự dọn fixture |

Các assertion đã đạt:

- Owner đăng ký mới có invite; thêm Store có mã riêng; ensure giữ mã cũ. Store fixture bị đặt null mã: GET vẫn null, POST ensure cấp mã.
- Staff mới mang scope onboarding, không gọi được POS orders. Token cũ không có authSource bị yêu cầu đăng nhập lại; refresh pending vẫn pending.
- Mã sai, Store inactive hoặc Tenant suspended bị từ chối.
- Hai submit đồng thời trả cùng request ID; email body giả không thay userId/email đã xác thực. Pending ở Store khác bị 409.
- Owner khác tenant không duyệt hoặc cấp mã; payload role owner và store override bị 400.
- Duyệt–từ chối đồng thời trả đúng một 200 và một 409. Nhánh rejected gửi lại được với request ID mới, giữ lịch sử.
- Ba role staff/shift_leader/store_manager giữ nguyên user ID và passwordHash; có tenant/store đúng, portal STORE; me, refresh, login bằng email và username đúng role và quyền.
- Staff/Leader/Manager không gọi được API Owner, không chọn Store khác hoặc Tenant khác, không nhận inviteCode từ workspace list.
- Directory Owner có đúng nhân viên vừa duyệt; tenant khác thấy 0; phân trang và pendingCount đúng.
- Owner tạo thêm thương hiệu, chuyển lại thương hiệu cũ và đăng nhập lại vẫn có đủ membership đã chứng minh mật khẩu. User cùng email nhưng mật khẩu khác không được thêm vào session.
- Khóa tài khoản khiến me và refresh trả 401.
- Token Customer với numeric sub trùng users.id vẫn là Customer; không được dùng API KONEKT. Customer me/refresh hiện hữu hoạt động ở mức token contract; không khẳng định toàn bộ tính năng Customer legacy.
- **Rollback thực tế:** thêm CHECK NOT VALID chỉ chặn trạng thái approved của một request fixture. Bước update user chạy trước, update request lỗi 23514/HTTP 500; sau lỗi user vẫn tenantId/storeId null và request pending. Constraint được gỡ trong finally; duyệt lại thành công. HTTP 500 ở ca này là lỗi chủ động tạo để kiểm thử, không phải lỗi còn tồn tại.

Lệnh chạy (PowerShell dùng npm.cmd/npx.cmd):

```text
cd backend
npx.cmd ts-node src/scripts/audit_staff_onboarding.ts --summary
npx.cmd ts-node src/scripts/repair_staff_onboarding.ts
npx.cmd ts-node --files src/scripts/test_staff_onboarding.ts
npx.cmd ts-node --files src/scripts/test_staff_onboarding.ts --focused
npm.cmd run build
cd ../frontend
npm.cmd run build
```

Backend và frontend đã build thành công; kiểm tra build cuối được ghi trong changelog. Cảnh báo bundle lớn của Vite chưa được xử lý trong phạm vi này.

## 3. Giao diện đã implement, còn chờ browser verification

- Owner: `/office/hr?tab=requests`, panel mời ngay trên danh sách, chọn chi nhánh/copy/cấp mã thiếu, lọc Store/trạng thái và phân trang.
- Modal duyệt mặc định Staff; Owner chọn một trong ba role. Bỏ checkbox custom permission chưa được thực thi đầy đủ.
- Tab nhân sự dùng directory Drizzle mới, không gọi HR directory phụ thuộc roles/user_stores/lương của schema cũ.
- Staff: `/workspace/join-store`, loading/pending/rejected/error, poll mỗi 10 giây khi tab visible, focus và nút kiểm tra thủ công; approved dùng refresh credential lấy session mới.
- Staff/Leader về `/store/staff`; Manager về `/store/manager`. Guards đưa onboarding về trang gia nhập trước portal/role gate.
- Hydrate giữ email, permissions và scope. Axios refresh cập nhật đồng thời token/profile; badge HR/sidebar được thông báo sau quyết định và tải theo tenant.
- Luồng gia nhập cũ ở SelectTenant được chuyển về trang đã xác thực; giữ tạo/chọn thương hiệu cho Owner.

Browser skill đã được đọc và khởi tạo; runtime báo **No browser is available**, danh sách browser trả `[]`. Không có ảnh chụp và không đánh dấu đã test click/copy/F5/mobile/hai session.

Checklist cần chạy khi có browser:

1. Owner đăng nhập lại → HR → sao chép mã; thử copy bị chặn và cấp mã null.
2. Browser/profile độc lập: Staff đăng ký → nhập mã → gửi; F5 khi pending.
3. Owner duyệt Staff/Leader/Manager trên ba tài khoản mới; xem badge giảm và directory tăng.
4. Staff tự chuyển trang, F5 và refresh vẫn đúng role/store; thử URL quản lý bằng Staff.
5. Reject → lý do xuất hiện → gửi lại; ngắt mạng/khôi phục, focus tab, giao diện mobile, bàn phím/modal.

## 4. Cách dùng sau cập nhật

Khởi động lại backend/frontend và đăng nhập lại qua `/login` để nhận token KONEKT có nguồn định danh. Owner vào **Nhân sự → Duyệt nhân sự (Mã mời)**; nhân viên dùng tài khoản cá nhân tại `/register/staff` và trang gia nhập. Owner duyệt role rồi Staff vào màn hình làm việc; không cần tạo user bằng SQL.

Không đánh dấu toàn bộ PLAN-15B Completed khi phần browser còn chờ. Các thay đổi PLAN-16 có sẵn được giữ; các module legacy lịch/lương/kho/KDS/thanh toán không được nghiệm thu lại trong đợt này.

Tài liệu kỹ thuật đã đối chiếu: [Supabase connection/pooler](https://supabase.com/docs/guides/database/connecting-to-postgres), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), [Supabase changelog](https://supabase.com/changelog).

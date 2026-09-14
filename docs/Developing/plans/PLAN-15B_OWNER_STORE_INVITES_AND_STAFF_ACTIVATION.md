# PLAN-15B: Nối kín mã mời Owner, gia nhập Store và kích hoạt Staff theo role

**Ngày lập:** 11/09/2026  
**Trạng thái:** Đã triển khai code và migration / API đạt / Chờ browser verification (12/09/2026)  
**Requirement:** [REQ-15B](../../Requirements/REQ-15B_OWNER_STORE_INVITES_AND_STAFF_ACTIVATION.md)  
**Kế thừa:** [PLAN-15](PLAN-15_STAFF_ONBOARDING_ROLE_PORTAL.md), [REQ-04](../../Requirements/REQ-04_CONSOLIDATED_HUBS_AND_INVITE_HR.md)

## 1. Kết quả cần đạt

Một Owner mới có thể tự lấy mã mời từ trang quản lý và tuyển một nhân viên mới hoàn toàn qua giao diện. Nhân viên được gán đúng role/Store, nhận session mới, vào đúng portal và xuất hiện trong danh sách nhân sự. Kiểm thử lặp lại độc lập cho Staff, Shift Leader và Store Manager.

Dùng hậu tố **15B** vì đây là đợt hoàn thiện onboarding REQ-15; giữ REQ-17 dự kiến cho lịch/chấm công như tài liệu REQ-16 đã nêu.

## 2. Phương pháp và giới hạn bằng chứng

- Đã đọc tài liệu nền, REQ-04, REQ-15, PLAN-15, LOG về onboarding ngày 10/09 và LOG-037.
- Đã lần theo code từ Owner navigation → invite → đăng ký → request → approve/reject → login/me/refresh → directory/guards.
- Các phát hiện dưới đây là từ code local. Chưa chạy app, gọi API, kiểm tra schema thực tế hay thực hiện migration trong phiên lập kế hoạch.
- Working tree đang có thay đổi PLAN-16 ở schema, POS, guards và changelog. Khi implement phải giữ các thay đổi này, không reset/revert cả file.
- Skills đã tham chiếu: Supabase và Postgres best practices cho auth/data; design-taste-frontend, minimalist-ui, high-end-visual-design, brandkit theo quy định dự án. Đây là UI nghiệp vụ: giữ font, màu và Lucide hiện có; không áp dụng bố cục landing page hoặc sinh ảnh brand kit.

## 3. Đối chiếu tài liệu và code hiện tại

| Mã | Phát hiện và bằng chứng code | Hệ quả thực tế | Ưu tiên |
|---|---|---|---|
| F01 | `SelectStorePage.tsx:514` chỉ render khối mã khi `st.inviteCode` có giá trị. `OwnerHRHubPage.tsx` chỉ có các tab nhân sự, không có phần lấy mã. WorkspaceSwitcher có đường dẫn sang trang chọn Store nhưng mã nằm sâu hơn luồng HR. | Owner vào Quản lý nhân sự không thấy mã; Store null mã không có nút khắc phục. | P0 |
| F02 | `konektAuth.service.ts::registerOwner` tạo Store không gán inviteCode; `workspace.service.ts::createTenantWorkspace` có sinh/gán mã. Schema cho phép inviteCode null. | Hai cách tạo quán cho kết quả khác nhau; đăng ký Owner thông thường có thể tạo Store thiếu mã. Chưa xác nhận dữ liệu Store cụ thể của user. | P0 |
| F03 | `SelectStorePage::handleCreateNewStore` gọi `POST /stores`; `stores.routes.ts` không khai báo POST tạo Store. | Thêm chi nhánh từ UI hiện có chưa nối đúng API. | P1 |
| F04 | `workspace.routes.ts` không gắn authGuard cho verify/join. `joinStoreRequestHandler` lấy email body khi không có danh tính; `submitStoreJoinRequest` không lưu userId. | Gửi request từ Staff đang đăng nhập cũng chưa ràng buộc chắc vào tài khoản; có thể gửi bằng email người khác. | P0 |
| F05 | `registerStaff` tạo user chưa có Tenant/Store. `approveStoreJoinRequest` tìm user cùng email trong Tenant, không thấy thì INSERT user mới; giữ user chưa gán. `loginKonekt` dùng findFirst theo email/username không có quy tắc chọn membership. | Duyệt xong vẫn có thể đăng nhập vào bản ghi cũ chưa gán; trạng thái Approved chưa bảo đảm nhân viên vào làm được. | P0 |
| F06 | `/auth/me` chỉ trả JWT claims; `/auth/refresh` ký lại claims cũ. Trang chờ gọi hydrateFromStorage; bộ dựng AuthUser không giữ email, customPermissions và onboarding fields đầy đủ. | Nút Kiểm tra trạng thái không đọc kết quả duyệt mới từ DB; F5 có thể mất metadata/quyền; refresh không nhận role mới. | P0 |
| F07 | API list/approve/reject chỉ có authGuard; controller/service không kiểm tra approver là Owner. Role trong payload chỉ có TypeScript type, chưa validate runtime. Store override chưa xác minh đúng nơi xin vào. | Người đăng nhập có tenant context có thể gọi API duyệt ngoài quyền; payload có thể gán role/Store không hợp lệ. | P0 |
| F08 | Approval ghi user rồi request bằng các câu lệnh tách rời, không transaction. Kiểm tra pending trước khi ghi, chưa khóa cạnh tranh; customPermissions=[] bị thay bằng quyền mặc định. | Có thể ghi dở dang, xử lý trùng hoặc cấp quyền khác với lựa chọn Owner. | P0 |
| F09 | Login cấp storeIds là toàn bộ Store trong Tenant. getUserWorkspaces chỉ thu hẹp Store cho role staff. switchWorkspaceTenant nhận storeId chưa kiểm tra và gán Leader vào OFFICE, Staff vào POS. | Staff/Leader/Manager có thể nhận scope chi nhánh rộng; kết quả portal khác nhau giữa login và switch. | P0 |
| F10 | HREmployeesPage → hrEmployeeDirectory.api → API head-officer; query dùng user_stores, roles, role_id và cột lương cũ. Approval hiện ghi users với role enum/store_id mới. | Danh sách Owner chưa có nguồn dữ liệu thống nhất với quá trình duyệt. Không nên kết luận nhân viên chưa được tạo chỉ vì directory cũ trống/lỗi. | P0 |
| F11 | Guard frontend kiểm tra token/role/portal, chưa chặn user thiếu Tenant/Store. Một số controller POS/ca dùng fallback ID 1. | Staff mới chưa duyệt đã mang role staff nên không thể chỉ dùng role làm điều kiện cho vào nghiệp vụ. | P0 |
| F12 | Approval UI đã có ba role; role ban đầu có thể suy từ desiredPosition. Badge HR và directory cache tải riêng, chưa invalidation chung. Một số checkbox quyền chưa được enforce ở module đích. | Có thể gợi sẵn quyền quản lý theo tự khai; duyệt thành công nhưng badge/directory cũ; UI quyền dễ tạo kỳ vọng sai. | P1 |

**Điều chỉnh nhận định trước:** LOG ghi hoàn thành REQ-15 là bằng chứng lịch sử, không phải xác nhận runtime hiện tại. Approval hiện không dùng transaction như mô tả trong log. Cần nghiệm thu lại bằng tài khoản mới, không chỉ demo seed và ảnh modal.

## 4. Thiết kế nghiệp vụ và trải nghiệm

### 4.1 Owner: lấy mã và duyệt tại một nơi

- Giữ sidebar và route `/office/hr`, không thêm một Hub mới.
- Trong tab requests, phía trên có một khối phẳng: tên thương hiệu, bộ chọn chi nhánh, địa chỉ, trạng thái, mã mời, nút Sao chép.
- Một chi nhánh tự chọn; nhiều chi nhánh dùng bộ chọn rõ ràng. Bộ lọc chi nhánh trong danh sách request cùng ngữ cảnh với khối mời; vẫn có lựa chọn xem toàn Tenant cho danh sách.
- Mã thiếu: hiển thị Cấp mã mời; lỗi tải API có Thử lại; clipboard thất bại cho chọn văn bản thủ công, không báo Đã chép giả.
- Empty state chưa có request hướng dẫn: sao chép mã → gửi nhân viên → nhân viên đăng ký và gửi yêu cầu.
- Modal duyệt hiển thị người xin vào, Store, vị trí mong muốn, ba role. Default Staff; không tự chọn Manager theo từ người gửi nhập.
- Đợt này hiển thị quyền theo mẫu role bằng mô tả trung thực; ẩn thao tác tùy biến chưa được module đích kiểm soát. Không xóa customPermissions của tài khoản cũ khi đổi giao diện.
- Sau duyệt/từ chối, đồng bộ request list, badge sidebar/HR và directory; lỗi trả ngay tại modal, giữ thông tin đang nhập.

### 4.2 Staff: đăng ký, chờ, vào làm

- `/register/staff` → `/workspace/join-store`; dùng tài khoản đăng nhập làm danh tính cố định.
- Trang gia nhập hiển thị rõ bốn trạng thái: chưa gửi, đang chờ, được duyệt, bị từ chối. Phân biệt lỗi mạng với trạng thái nghiệp vụ.
- Verify code trả tối thiểu tên thương hiệu/cửa hàng/địa chỉ/trạng thái; Store ID lấy từ mã phía server khi submit.
- Pending tự tải lại khi tab có focus, thăm dò mỗi 10 giây khi tab visible, dừng khi trạng thái kết thúc hoặc rời trang; luôn có nút kiểm tra thủ công.
- Approved hiển thị role và chi nhánh; Vào làm việc đổi access/refresh token và AuthUser cùng lúc trước khi navigate.
- Rejected hiển thị lý do; gửi lại là request mới. Không cho pending biến mất khi F5, không xóa lịch sử từ chối.

### 4.3 Mô hình tài khoản

- Tái sử dụng `users`, `stores`, `store_join_requests`; chưa thêm hệ thống account/membership mới.
- Luồng Staff mới dùng chính userId vừa đăng ký. Request liên kết userId ngay khi tạo. Approval khóa user và request, gán tenantId/storeId/role trên user đó.
- Không clone password, không tạo mật khẩu mặc định cho guest, không chuyển ngầm một tài khoản đã thuộc Store/Tenant khác.
- Các bản ghi Owner cùng email ở nhiều Tenant có chủ ý phải được bảo tồn. Không thêm unique email toàn hệ thống khiến mô hình Owner hiện có hỏng.
- Login không còn chọn ngẫu nhiên first row: ưu tiên ngữ cảnh đã xác thực; với nhiều membership hợp lệ cần bước chọn workspace xác thực đúng tài khoản. Không cấp quyền sang một bản ghi chỉ vì trùng email. Trường hợp legacy mơ hồ đưa vào báo cáo dữ liệu và yêu cầu đăng nhập/chọn workspace đúng, không tự gộp account.
- Dữ liệu Staff cũ đã bị tách thành user chưa gán và user trong Tenant: công cụ dry-run phân loại dựa trên request, user và tham chiếu; chỉ repair mapping khi duy nhất và có bằng chứng. Không xóa hoặc đổi ID có lịch sử order/payroll.

### 4.4 Auth, scope và quyền

- Tạo resolver chung cho profile/session KONEKT, dùng ở login, me, refresh, activation và workspace switch.
- Session mới phân biệt nguồn KONEKT và trạng thái onboarding bằng claim có chủ đích; cần adapter cho token cũ, không giả định `sub` của khách hàng/legacy và users mới cùng namespace.
- Token pending chỉ được vào nhóm auth/onboarding: me, refresh, kiểm tra mã, gửi/xem request và kích hoạt. Các business API hiện dùng authGuard phải từ chối session onboarding theo mặc định; chỉ nhóm onboarding dùng guard cho phép onboarding riêng.
- Với token KONEKT cũ chưa có claim nguồn: đối chiếu ngữ cảnh DB đầy đủ, không chỉ numeric sub; nếu không xác định duy nhất thì yêu cầu đăng nhập lại. Không đổi cách xác thực Customer/legacy một cách ngầm định.
- Khi Owner duyệt, token cũ không được tự có quyền business chỉ nhờ UI thay đổi. Endpoint activation xác minh refresh credential hiện tại, đọc user/request mới và phát token workspace mới. Token KONEKT refresh thông thường cũng dựng lại claims từ DB.
- Profile chuẩn trả email, role/roles, portal, tenantId, storeId, storeName, stores, customPermissions và onboarding. JWT dùng permissions; có một mapping rõ sang customPermissions ở client, phân biệt [] với thiếu giá trị.
- Owner duyệt phải là Owner còn hoạt động của Tenant hiện tại; roleGuard dùng role mới đúng tên, không tái sử dụng danh sách role legacy không còn trong hierarchy.
- Staff/Leader/Manager chỉ nhận Store được gán; workspace switch kiểm tra Store thuộc Tenant và nằm trong tập được cấp, không tin payload.
- Loại mã mời khỏi response workspace list/switch của Staff/Leader/Manager; không chỉ bảo vệ endpoint mã mời mới rồi để endpoint cũ tiếp tục trả inviteCode. Owner vẫn nhận mã của Store thuộc Tenant được phép.
- Kiểm tra trực tiếp API lẫn route UI. Hoàn thiện guard onboarding không đồng nghĩa đã sửa mọi quyền nội bộ của POS/kho/lương; các lỗi đó được ghi riêng.

## 5. API contract dự kiến

Giữ response workspace `{ success, data }`; auth tiếp tục dạng `{ user, accessToken, refreshToken }` nơi cấp token.

| Method/path dưới `/api` | Người được dùng | Nội dung |
|---|---|---|
| `GET /workspace/stores` | Owner trong Tenant | Danh sách Store quản trị, mã mời và trạng thái; không phát sinh mã khi GET |
| `POST /workspace/stores` | Owner trong Tenant | Tạo chi nhánh và mã trong một transaction; FE SelectStorePage chuyển sang API này |
| `POST /workspace/stores/:id/invite-code` | Owner của Store | Cấp mã nếu còn thiếu; gọi lặp trả mã hiện có, không rotate |
| `POST /workspace/verify-store-invite` | Staff đã xác thực, có thể chưa gán Store | Chuẩn hóa mã, xác minh Store/Tenant hoạt động |
| `POST /workspace/join-store-request` | Staff chưa được gán Store | Body chỉ mã, thông tin ứng tuyển; server lấy userId/email |
| `GET /workspace/my-store-join-status` | Tài khoản đã xác thực | Trạng thái onboarding, request của chính user, thông tin role/Store sau duyệt; không trả token |
| `POST /auth/activate-workspace` | Chủ refresh credential hợp lệ của tài khoản | Đọc trạng thái mới, cấp token + profile nếu đã duyệt; pending trả lỗi nghiệp vụ rõ |
| `GET /workspace/staff-requests` | Owner | Lọc status/storeId, phân trang, tổng pending theo Tenant |
| `POST /workspace/staff-requests/:id/approve` | Owner | Body role trong enum ba giá trị; Store cố định theo request; transaction và chống xử lý trùng |
| `POST /workspace/staff-requests/:id/reject` | Owner | Lý do có giới hạn, chỉ pending được xử lý |
| `GET /workspace/staff` | Owner | Directory users/stores mới, lọc Store/role/từ khóa, phân trang |
| `/auth/me`, `/auth/refresh`, `/workspace/select-tenant` | Theo session hợp lệ | Dùng resolver thống nhất; không echo hoặc ký lại role/Store cũ cho KONEKT |

Validation dùng Zod hiện có. 401 cho chưa xác thực; 403 cho sai quyền hoặc chưa có workspace; 404 cho tài nguyên ngoài phạm vi; 409 cho xung đột trạng thái. Mã sai và Store/Tenant ngừng hoạt động có message nghiệp vụ rõ nhưng không lộ dữ liệu quản trị.

## 6. Danh sách file dự kiến

### Tạo mới

- `backend/src/modules/workspace/workspace.schema.ts`: validate code, tạo Store, request và quyết định role.
- `backend/src/modules/workspace/storeInvite.service.ts`: sinh mã và cấp mã có retry collision, dùng chung hai đường tạo quán.
- `backend/src/modules/auth/konektSession.service.ts`: profile/claims, onboarding state, activate/refresh và scope Store thống nhất.
- `backend/src/middlewares/workspaceOwnerGuard.ts`: kiểm tra Owner hiện hành và Tenant từ session/DB.
- `backend/src/scripts/audit_staff_onboarding.ts`: read-only audit mã thiếu, user trùng, orphan request, constraints và trạng thái migration; output không có token/password.
- `backend/src/scripts/repair_staff_onboarding.ts`: dry-run mặc định, manifest bản ghi ảnh hưởng; apply idempotent chỉ với mapping đã xác định, không tự gộp dữ liệu mơ hồ.
- `backend/src/scripts/test_staff_onboarding.ts`: regression API/data có assertion, fixture biệt lập, không dùng tài khoản demo làm bằng chứng duy nhất.
- `frontend/src/features/office/hr/components/StoreInvitePanel.tsx`: UI chọn Store, cấp/sao chép mã và hướng dẫn.
- `frontend/src/features/office/hr/pages/OwnerStaffDirectoryPage.tsx`: danh sách nhân sự KONEKT mới; dùng dữ liệu API mới, không giả dữ liệu lương.
- `docs/Developing/logs/VERIFY-15B_STAFF_ONBOARDING.md`: biên bản nghiệm thu, chưa tạo hoặc đánh pass trong phiên lập kế hoạch.

### Chỉnh sửa

- `backend/src/db/schema.ts`: constraints/index onboarding nếu kiểm tra DB cho thấy cần; giữ mọi thay đổi PLAN-16 hiện có.
- `backend/src/modules/auth/konektAuth.service.ts`: sinh mã registerOwner, giữ ID Staff, login lựa chọn membership có xác thực và resolver session.
- `backend/src/modules/auth/auth.controller.ts`, `auth.routes.ts`: me/refresh KONEKT, endpoint activation, onboarding guard.
- `backend/src/utils/jwt.ts`: type claims phân biệt nguồn và scope, tương thích token cũ có quy tắc.
- `backend/src/middlewares/authGuard.ts`: tách xác thực onboarding khỏi business authorization mặc định, bảo toàn các luồng Customer/legacy.
- `backend/src/modules/workspace/workspace.service.ts`, `workspace.controller.ts`, `workspace.routes.ts`, `workspace.types.ts`: Store API, request gắn user, status, transaction, scope và permission defaults nhất quán.
- `frontend/src/features/workspace/api/workspace.api.ts`: contract API mới và type onboarding/directory.
- `frontend/src/features/auth/api/auth.api.ts`: activation và profile chuẩn.
- `frontend/src/features/auth/pages/StaffRegisterPage.tsx`, `MerchantLoginPage.tsx`: điều hướng theo session state, xử lý trường hợp legacy nhiều workspace.
- `frontend/src/features/workspace/pages/StaffJoinStorePage.tsx`: trạng thái server, refresh/activation, lỗi/từ chối và gửi lại.
- `frontend/src/features/workspace/pages/SelectStorePage.tsx`: API tạo Store mới, mã thiếu và scope.
- `frontend/src/features/workspace/pages/SelectTenantPage.tsx`: luồng join cũ chuyển về flow đã xác thực, giữ Owner multi-workspace.
- `frontend/src/app/store/auth.store.ts`: profile type và hydrate giữ đủ dữ liệu; activation cập nhật tokens/user nguyên tử phía client.
- `frontend/src/lib/http/axios.ts`: refresh nhận profile mới, loại trừ đúng login/register/activation khỏi retry loop, không để token và store state lệch nhau.
- `frontend/src/app/router/guards/RequireAuth.tsx`, `RequireStoreRole.tsx`, `RequirePortal.tsx`: onboarding gate trước role gate; tránh vòng redirect ở trang gia nhập.
- `frontend/src/app/router/index.tsx`: bảo vệ route onboarding, lắp directory mới, giữ alias POS PLAN-16.
- `frontend/src/features/office/hr/pages/OwnerHRHubPage.tsx`, `StaffJoinRequestsPage.tsx`: panel mã, modal role, bộ lọc và đồng bộ dữ liệu sau quyết định.
- `frontend/src/shared/layouts/OfficeWorkspaceLayout.tsx`, `frontend/src/shared/components/WorkspaceSwitcher.tsx`: badge/cache theo Tenant; chỉ hiển thị Store được cấp, không điều hướng giả thành công khi switch lỗi.
- `docs/Requirements/REQ-15_STAFF_ONBOARDING_ROLE_PORTAL.md`, `docs/Developing/plans/PLAN-15_STAFF_ONBOARDING_ROLE_PORTAL.md`: bổ sung liên kết phát hiện và trạng thái nghiệm thu lại, giữ lịch sử.
- `docs/Requirements/README.md`, `docs/Developing/plans/README.md`, `docs/ROLES_AND_PERMISSIONS.md`, `docs/Developing/logs/DEV_CHANGELOG.md`: cập nhật mục 15B, quyền onboarding và kết quả.

### Migration có điều kiện và dữ liệu cũ

- Nếu cần thay constraints: sinh migration có tên mô tả `staff_onboarding_integrity` cùng metadata từ Drizzle sau khi đối chiếu schema live. File số thứ tự do công cụ sinh; không đoán số hoặc apply toàn bộ drift.
- Hiện journal chỉ có `0000_init_core_schema`, nhiều thay đổi về sau chạy script riêng. Phải phân biệt thiếu migration history với thiếu schema; không chạy db:generate/db:migrate mù lên DB đang có dữ liệu.
- Giữ `user_id` nullable cho request guest lịch sử nếu chưa link được; request mới bắt buộc có userId ở service. Index duy nhất có điều kiện cho một pending trên userId, loại trừ các bản ghi lịch sử chưa xác định danh tính.
- Ràng buộc request status/assignedRole phù hợp ba role; tiền kiểm dữ liệu không hợp lệ trước khi thêm constraint.
- Không đổi khóa chính, không unique email toàn cục. Bảo vệ đăng ký đồng thời tạo hai tài khoản chưa gán cùng email bằng transaction/khóa phù hợp và constraint chỉ cho nhóm chưa gán nếu dữ liệu cho phép.
- Mã mời sinh bằng `crypto`, có unique constraint hiện hữu và retry có giới hạn. Backfill chỉ mã null/rỗng, không thay mã đang dùng; không cấp quyền Data API mới.

**Không xóa file nghiệp vụ hiện có.** HREmployeesPage và adapter HR legacy giữ cho những nơi còn dùng; Owner Hub chuyển sang directory mới để không kéo cả payroll/scheduling vào scope.

## 7. Thứ tự triển khai

1. **Baseline và dữ liệu:** chạy audit read-only; kiểm tra bảng users/stores/requests, enum shift_leader, nullable tenant, indexes, migrations. Ghi rõ phát hiện confirmed và unknown, chọn fixture test biệt lập. Hoàn thiện repair manifest trước khi apply.
2. **Nền auth và scope:** xây session resolver; tách onboarding/business; chuẩn hóa me/refresh/activation; kiểm tra Owner và Store. Đây là điều kiện trước khi mở API mời/duyệt mới.
3. **Mã mời và Store:** dùng service sinh mã chung; API Owner list/create/ensure; bổ sung backfill có kiểm soát. Xác minh cả registerOwner lẫn createTenantWorkspace và Store đã có mã.
4. **Request và approval:** verify/submit có danh tính, status cá nhân, constraint pending; approve/reject transaction với khóa user và request; cố định Store theo request; bỏ guest provisioning bằng mật khẩu mặc định.
5. **Giao diện Owner và Staff:** panel mời trong HR, ba role rõ ràng, trang chờ/activation, directory mới, invalidation badge/directory theo Tenant; giữ màu xanh rêu/kem, Be Vietnam Pro, Lucide và label tiếng Việt.
6. **Nghiệm thu:** API regression, transaction/concurrency, browser hai phiên độc lập Owner/Staff, ba role, F5/refresh, negative access, old-data fixtures; typecheck/build hai phía, ghi biên bản rồi mới cập nhật Completed.

## 8. Kế hoạch kiểm thử

| Nhóm | Kịch bản và kết quả bắt buộc |
|---|---|
| Owner mới | Đăng ký thương hiệu mới qua form thật; vào HR thấy Store/mã, không dùng mã seed chép tay từ DB |
| Store cũ | Có mã giữ nguyên; null mã cấp được; gọi cấp mã đồng thời trả một mã hợp lệ |
| Thêm Store | UI tạo Store thành công qua API mới, đúng Tenant; Staff không gọi được |
| Staff mới | Đăng ký user U, gửi request gắn U; giả email/userId body không đổi danh tính |
| Pending | F5, tab khác, đăng nhập lại vẫn pending; không gọi được POS/Store/Owner API dù biết URL |
| Ba role | Dùng ba tài khoản mới, Owner duyệt lần lượt Staff/Leader/Manager; đối chiếu userId không đổi, DB role, JWT, profile, trang đích |
| Phân quyền | Staff không vào màn quản lý/duyệt; Leader không thành Manager; cả ba không xử lý request Owner bằng API; test cả Store khác trong cùng Tenant |
| Kích hoạt | Trang đang chờ nhận approved; Vào làm việc đổi token thật; token cũ vẫn bị giới hạn; refresh/F5 giữ email/quyền/store |
| Từ chối | Staff thấy lý do, gửi lại được, request cũ giữ rejected |
| Request trùng | Bấm đúp/hai tab tạo tối đa một pending; gửi sang Store khác khi pending có lỗi rõ |
| Quyết định trùng | Approve–approve và approve–reject đồng thời: một kết quả, không user/request lệch trạng thái |
| Rollback transaction | Cố tình làm bước ghi request lỗi trên DB test; user không bị gán dở |
| Scope | Owner A không list/approve/cấp mã Store Tenant B; target role owner/admin và payload Store khác bị từ chối |
| Directory/badge | Sau approve, số pending giảm và đúng nhân viên xuất hiện ngay; đổi Tenant không lộ cache Tenant trước |
| Dữ liệu cũ | Guest request thiếu userId, duplicate unassigned/member, Owner nhiều Tenant: không tự gộp/xóa hoặc chiếm membership theo email |
| Customer/legacy | Login/refresh hiện hữu vẫn đúng; không diễn giải numeric sub của Customer thành users mới |

- Tái sử dụng `ts-node` hiện cài để chạy script regression, không đưa thêm test framework chỉ cho đợt này. Assertions kiểm tra trạng thái, DB và quyền thực tế, không chỉ HTTP 200.
- Regression ghi DB chỉ chạy trên DB test/fixture được đánh dấu, có tenant allowlist, chặn chạy nhầm production; dọn đúng fixture của lần chạy, không xóa dữ liệu quán thật.
- Frontend/backend: `npx tsc --noEmit`; `npm run build` trong từng thư mục. Không dùng build pass thay cho E2E.
- Browser: Owner và Staff ở session độc lập để không ghi đè localStorage nhau; kiểm tra Owner desktop, Staff mobile onboarding, desktop portal, copy thành công/thất bại, loading/error/empty states và bàn phím trong modal.
- Không test SMS/email bằng cách gửi tin cho người thật. Không coi việc các launcher KDS/kho/lương hiện ra là đã nghiệm thu module đích.

## 9. Rủi ro và rollback

| Rủi ro | Kiểm soát / rollback |
|---|---|
| Dữ liệu legacy có nhiều user cùng email và lịch sử nghiệp vụ | Audit + mapping manifest; không auto merge/delete. Repair không rõ danh tính dừng riêng bản ghi, luồng mới vẫn phát triển được. |
| Schema live lệch journal | Tiền kiểm và migration additive nhỏ; không reset DB, không tạo lại bảng, không apply migration chứa thay đổi ngoài 15B. |
| Đổi auth ảnh hưởng Customer/legacy hoặc token cũ | Claim nguồn rõ ràng, adapter có giới hạn, test regression; nếu token không thể xác định an toàn thì yêu cầu login lại thay vì fallback Tenant 1. |
| Guard onboarding gây redirect loop | Guard riêng cho trang join; test F5/pending/approved/expired token và deep link. |
| UI ba role làm người dùng nghĩ toàn bộ quyền cũ đã hoạt động | Mô tả đúng phạm vi; không trình bày checkbox chưa enforce như tính năng hoàn chỉnh; ghi riêng backlog POS/kho/lương. |
| Rollback làm mất mã hoặc nhân viên đã kích hoạt | Revert code theo commit của 15B, giữ dữ liệu additive và mã hợp lệ. Không rollback bằng xóa users/stores/requests; dùng manifest khi cần sửa một mapping. |
| Đè thay đổi PLAN-16 đang có | Patch theo vùng, review diff trước commit; không reset cả schema/router/changelog. |

## 10. Điều kiện bàn giao

- [x] 15 tiêu chí trong REQ-15B được đối chiếu bằng chứng; những mục chưa kiểm thử ghi rõ, không đánh pass suy diễn.
- [ ] Có biên bản VERIFY-15B với fixture, timestamp, role, API assertions, DB checks và ảnh luồng quan trọng.
- [x] Không còn phụ thuộc mã seed hoặc thao tác DB thủ công để Owner tuyển một Staff mới (API đã kiểm thử; UI chờ browser).
- [x] Changelog và REQ/PLAN-15 cập nhật trạng thái đúng với kiểm thử mới.

Lịch sử: phiên lập kế hoạch chỉ phân tích; User sau đó đã duyệt triển khai và yêu cầu kiểm tra database mới. Xem [VERIFY-15B](../logs/VERIFY-15B_STAFF_ONBOARDING.md) cho trạng thái thực thi hiện tại.


## 11. Kết quả và điều chỉnh thực thi
- Hoàn thành các bước 1–5 ở mức code/database; bước 6 API và build đạt, browser chưa khả dụng.
- Audit live xác nhận bảng/cột cần thiết đã tồn tại; 0001 chỉ thêm constraints/indexes/RLS/quyền DB, không reset hoặc chạy toàn bộ drift.
- Tách nghiệp vụ transaction thành staffOnboarding.service.ts; thêm schema Zod và shared session resolver. Giữ request legacy userId null; không auto merge theo email.
- Login token cũ thiếu nguồn định danh yêu cầu đăng nhập lại, Customer token contract được giữ và kiểm thử chống sub collision.
- Cấp mã dùng crypto với Store ID duy nhất toàn DB; các thao tác ensure khóa Store và giữ mã hiện hữu. Không dùng retry ghi trong transaction đã abort.
- Owner registration và API thêm Store ghi quán/cửa hàng/mã trong transaction. createTenantWorkspace tiếp tục seed menu theo luồng cũ; ID tài khoản nguồn lấy từ token, không dò mật khẩu theo email.
- UI kế thừa phong cách nghiệp vụ hiện có; không sinh ảnh. Bộ lọc/phân trang danh sách yêu cầu hiện ở client, adapter tải các trang API để badge không chỉ đếm trang đầu.
- Đã thêm VERIFY-15B và cập nhật tài liệu role, REQ/PLAN-15. Không đánh Completed vì chưa có browser hai phiên và ảnh/F5.

# NHẬT KÝ THAY ĐỔI & TIẾN ĐỘ PHÁT TRIỂN (DEVELOPMENT CHANGELOG)
**Vị trí**: `docs/Developing/logs/DEV_CHANGELOG.md`  
**Mục đích**: Ghi lại toàn bộ lịch sử thay đổi, lý do kỹ thuật, các quyết định kiến trúc và hiện trạng dự án.  
**Quy tắc**: AI Agent và Lập trình viên khi bắt đầu phiên làm việc mới **chỉ cần đọc các mục gần nhất trong file này** để nắm trọn vẹn ngữ cảnh hiện tại mà không cần đọc lại toàn bộ mã nguồn.

---

## 📅 LỊCH SỬ THAY ĐỔI (CHRONOLOGICAL LOGS)

### [LOG-001] | 08/09/2026 - KHỞI TẠO BỘ TÀI LIỆU CHUYỂN ĐỔI & WORKFLOW QUẢN TRỊ DỰ ÁN
* **Người thực hiện**: Antigravity AI Agent (theo chỉ đạo của User).
* **Tác vụ**:
  * Khảo sát toàn bộ 35 modules backend và 20 feature modules frontend để tổng hợp scope hiện tại.
  * Thảo luận và thống nhất định hướng chuyển đổi từ mô hình Single-tenant chuỗi sang Multi-Tenant SaaS Web POS hướng tới vai trò `Owner` (Owner-Centric).
  * Chuẩn hóa cấu trúc thư mục tài liệu `docs/` gồm 3 nhánh nghiệp vụ chính:
    * `docs/AI Rules/`: Quy chuẩn hoạt động của AI Agent, quy trình 5 bước bắt buộc (Đọc rules ➔ Lập requirement ➔ Lập plan ➔ Code & ghi log ➔ Test).
    * `docs/Requirements/`: Nơi lưu trữ các bản đặc tả yêu cầu, khởi tạo bản yêu cầu đầu tiên `REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md`.
    * `docs/Developing/`: Phân chia thành `plans/` (lưu kế hoạch) và `logs/` (lưu nhật ký thay đổi).
* **Files tác động**:
  * `[TẠO MỚI]` `docs/AI Rules/AI_RULES.md`
  * `[TẠO MỚI]` `docs/Requirements/README.md`
  * `[TẠO MỚI]` `docs/Requirements/REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md`
  * `[TẠO MỚI]` `docs/Developing/README.md`
  * `[TẠO MỚI]` `docs/Developing/plans/README.md`
  * `[TẠO MỚI]` `docs/Developing/logs/DEV_CHANGELOG.md`
  * `[TẠO MỚI]` `docs/SCOPE_AND_FEATURES.md`
  * `[TẠO MỚI]` `docs/ROLES_AND_PERMISSIONS.md`
  * `[TẠO MỚI]` `docs/MULTI_TENANT_ARCHITECTURE.md`
  * `[TẠO MỚI]` `CAFE_POS_RESTRUCTURED_SCOPE.txt`
* **Quyết định Kỹ thuật then chốt (Architectural Decisions)**:
  1. *Không rewrite từ đầu*: Giữ nguyên 100% logic phức tạp của `orders.service.ts` (176KB), KDS sync, VietQR/Casso webhook, Chatbot AI.
  2. *Mô hình Tenancy*: Chọn Row-Level Tenancy (`tenant_id` trên từng bảng) để tối ưu kết nối Supabase transaction pooler và dễ bảo trì.
  3. *Mô hình Vai trò mới*: 4 vai trò nội bộ (`platform_admin`, `owner`, `store_manager`, `staff`) + 1 vai trò khách hàng (`customer`).
  4. *Owner linh hoạt*: Cho phép Owner vừa ở chế độ Quản trị vừa mở giao diện POS bán hàng trực tiếp.
* **Hiện trạng & Bước tiếp theo**:
  * Đã hoàn thiện toàn bộ khung tài liệu và quy chuẩn làm việc.
  * Chưa có bất kỳ dòng code mã nguồn nào bị thay đổi.
  * Sẵn sàng chuyển sang bước lập Kế hoạch hành động chi tiết (`PLAN-01`) cho giai đoạn 1 khi có chỉ đạo từ User.

---

### [LOG-002] | 08/09/2026 - THIẾT LẬP DATABASE MỚI, BỔ SUNG MA TRẬN REQ-01 VÀ CẬP NHẬT QUY CHUẨN UI/AI
* **Người thực hiện**: Antigravity AI Agent (theo chỉ đạo của User).
* **Tác vụ**:
  1. Đưa `DATABASE_URL` mới của Supabase (do User cung cấp) vào file `backend/.env`.
  2. Cấu hình xử lý chứng chỉ SSL Supabase Pooler (`NODE_TLS_REJECT_UNAUTHORIZED = "0"`) trong `backend/src/config/db.ts`. Kiểm tra kết nối thành công với `npm run check:schema`.
  3. Bổ sung Sơ đồ vai trò Mermaid và Bảng ma trận phân quyền tính năng tổng quan (ASCII Matrix Table) trực tiếp vào tài liệu `docs/Requirements/REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md`.
  4. Cập nhật `docs/AI Rules/AI_RULES.md` với 4 quy chuẩn mới được User ban hành:
     - **Quy tắc Icon**: Tuyệt đối không dùng icon bên ngoài, chỉ dùng icon có trong thư viện hỗ trợ của JavaScript/React.
     - **Quy tắc Màu sắc**: Bắt buộc tuân thủ 2 dải màu theo ảnh gốc: **Xanh rêu đậm (Dark Moss Green)** làm chủ đạo (`#364D39` / `#2A3B2C`) và **Kem ngà (Warm Ivory Cream)** làm nền (`#F4EFEB` / `#FAF6F3`); chỉ thay đổi sắc độ (tints/shades) để tạo phân cấp thị giác.
     - **Quy tắc Ghi Log**: Bắt buộc log action vào `DEV_CHANGELOG.md` sau mỗi task hoàn thành.
     - **Quy tắc Database**: Toàn bộ dữ liệu phát triển chuyển sang Database Supabase mới.
* **Files tác động**:
  * `[CHỈNH SỬA]` `backend/.env` (Cập nhật DATABASE_URL mới của Supabase)
  * `[CHỈNH SỬA]` `backend/src/config/db.ts` (Xử lý SSL pooler connection cho Supabase)
  * `[CHỈNH SỬA]` `docs/AI Rules/AI_RULES.md` (Bổ sung quy tắc icon, màu sắc, log action, database mới)
  * `[CHỈNH SỬA]` `docs/Requirements/REQ-01_MULTI_TENANT_ROLE_RESTRUCTURING.md` (Nhúng sơ đồ vai trò và ma trận tính năng)
  * `[CHỈNH SỬA]` `docs/Developing/logs/DEV_CHANGELOG.md` (Ghi nhận LOG-002)
* **Hiện trạng & Bước tiếp theo**:
  * Kết nối Database mới hoàn toàn thông suốt.
  * Toàn bộ quy tắc AI và sơ đồ tính năng đã được văn bản hóa đầy đủ.
  * Sẵn sàng chuyển sang bước tiếp theo theo yêu cầu của User.

---

### [LOG-003] | 08/09/2026 - CÀI ĐẶT SUPABASE SKILL, TEST DIRECT QUERY DB MỚI & BỔ SUNG QUY TẮC ORM
* **Người thực hiện**: Antigravity AI Agent (theo chỉ đạo của User).
* **Tác vụ**:
  1. Chạy thành công lệnh `npx skills add supabase/agent-skills`, cài đặt 2 skills chính thức từ Supabase vào workspace:
     - `.\.agents\skills\supabase` (Khai thác Supabase Auth, DB, RLS, Storage, Edge Functions)
     - `.\.agents\skills\supabase-postgres-best-practices` (Các quy chuẩn thiết kế schema, index, RLS policies chuẩn bảo mật của Postgres/Supabase)
  2. Test trực tiếp kết nối và truy vấn query tới Database Supabase mới:
     - Chạy script test: `SELECT current_database(), current_user, version()`.
     - Kết quả: `current_database: 'postgres'`, `current_user: 'postgres'`, `version: 'PostgreSQL 17.6 on aarch64-unknown-linux-gnu'`. Kết nối thành công 100%.
  3. Bổ sung Quy tắc số 9 vào `docs/AI Rules/AI_RULES.md`:
     - **Chuyển đổi từ SQL Driver thuần sang ORM**: Không dùng raw query string thủ công `pool.query('SELECT...')` nữa; bắt buộc áp dụng ORM (như Drizzle ORM hoặc Prisma) để đảm bảo 100% Type-safety, tự động hóa migration có version, và tự động inject `tenant_id` vào mọi câu lệnh truy vấn.
* **Files tác động**:
  * `[TẠO MỚI]` `.agents/skills/supabase/*` (Bộ skill Supabase)
  * `[TẠO MỚI]` `.agents/skills/supabase-postgres-best-practices/*` (Bộ skill Best Practices)
  * `[CHỈNH SỬA]` `docs/AI Rules/AI_RULES.md` (Thêm quy tắc 9 về ORM)
  * `[CHỈNH SỬA]` `docs/Developing/logs/DEV_CHANGELOG.md` (Ghi nhận LOG-003)
* **Hiện trạng & Bước tiếp theo**:
  * Database PostgreSQL 17.6 trên Supabase đã sẵn sàng nhận schema mới qua ORM.
  * Agent đã có đầy đủ Supabase Skills để hỗ trợ thao tác tự động, tuân thủ best practices về RLS và indexing.

---

### [LOG-004] | 08/09/2026 - CÀI ĐẶT TASTE-SKILL, BỔ SUNG QUY TẮC SKILLS-FIRST & LẬP KẾ HOẠCH PLAN-01
* **Người thực hiện**: Antigravity AI Agent (theo chỉ đạo của User).
* **Tác vụ**:
  1. Chạy lệnh `npx skills add Leonxlnx/taste-skill`, cài đặt thành công 13 skills thiết kế UI cao cấp vào `.agents/skills/` (gồm: `design-taste-frontend`, `minimalist-ui`, `high-end-visual-design`, `brandkit`,...).
  2. Bổ sung Quy tắc số 10 vào `docs/AI Rules/AI_RULES.md`: Bắt buộc đọc và tuân thủ các skills chuyên môn trước khi thực hiện tác vụ (Taste-skill cho UI/Frontend, Supabase skills cho DB/Backend).
  3. Lập kế hoạch hành động chi tiết giai đoạn 1: `docs/Developing/plans/PLAN-01_ROLE_RESTRUCTURING_AND_DATABASE_SETUP.md`.
* **Files tác động**:
  * `[TẠO MỚI]` `.agents/skills/design-taste-frontend/*` (+ 12 design skills)
  * `[CHỈNH SỬA]` `docs/AI Rules/AI_RULES.md` (Thêm quy tắc 10 - Skills-First Protocol)
  * `[TẠO MỚI]` `docs/Developing/plans/PLAN-01_ROLE_RESTRUCTURING_AND_DATABASE_SETUP.md`
  * `[CHỈNH SỬA]` `docs/Developing/logs/DEV_CHANGELOG.md` (Ghi nhận LOG-004)
* **Hiện trạng & Bước tiếp theo**:
  * Đã hoàn thiện toàn bộ công tác chuẩn bị, bộ kỹ năng và quy tắc.
  * Trình bản kế hoạch `PLAN-01` cho User xem xét phê duyệt trước khi bắt đầu thực thi code.

---

### [LOG-005] | 08/09/2026 - KHỞI TẠO GIT MỚI & PUSH TOÀN BỘ LÊN GITHUB KONEKT_EXE201
* **Người thực hiện**: Antigravity AI Agent (theo chỉ đạo của User).
* **Tác vụ**:
  1. Hủy bỏ Git repo cũ của FSoft mock project (xóa `.git` cũ theo lựa chọn của User).
  2. Khởi tạo Git repository mới tinh trên branch `main`.
  3. Sửa file `.gitignore` để đảm bảo thư mục `docs/Developing/logs/` (chứa changelog) được track đầy đủ vào Git, đồng thời giữ bí mật tuyệt đối `backend/.env` và các thư mục `node_modules/`.
  4. Trỏ remote `origin` sang repository GitHub mới: `https://github.com/khoale142/KONEKT_EXE201.git`.
  5. Commit toàn bộ mã nguồn, tài liệu, AI rules, Agent skills và push thành công lên `origin/main`.
* **Files tác động**:
  * `[CHỈNH SỬA]` `.gitignore` (Track `docs/Developing/logs/**`)
  * `[TẠO MỚI COMMIT]` Toàn bộ cấu trúc dự án lên GitHub `KONEKT_EXE201`.
  * `[CHỈNH SỬA]` `docs/Developing/logs/DEV_CHANGELOG.md` (Ghi nhận LOG-005)
* **Hiện trạng & Bước tiếp theo**:
  * Mã nguồn dự án mới đã được lưu trữ an toàn trên GitHub `https://github.com/khoale142/KONEKT_EXE201.git`.
  * Sẵn sàng bắt đầu triển khai các bước trong [PLAN-01](file:///c:/FPT_KHOA/cafe-management-platform-v1.0/docs/Developing/plans/PLAN-01_ROLE_RESTRUCTURING_AND_DATABASE_SETUP.md).

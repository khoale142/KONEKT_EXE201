# QUY CHUẨN HOẠT ĐỘNG CỦA AI AGENT (AI SYSTEM RULES & WORKFLOW PROTOCOL)
**Dự án**: Cafe Management Platform (Multi-Tenant SaaS Web POS)  
**Vị trí tài liệu**: `docs/AI Rules/AI_RULES.md`  
**Ngày cập nhật**: 08/09/2026  
**Đối tượng áp dụng**: Tất cả các AI Agent (Antigravity, Cursor, Copilot,...) và Lập trình viên tham gia phát triển dự án.

---

## 📌 NGUYÊN TẮC CỐT LÕI (MANDATORY WORKFLOW)

Mọi tác vụ kỹ thuật trong dự án **BẮT BUỘC** phải tuân theo chu trình 5 bước khép kín dưới đây:

```
[1. ĐỌC RULES & LOG GẦN NHẤT] 
          │
          ▼
[2. QUY ĐỔI MỤC TIÊU THÀNH REQUIREMENT] ──> Lưu vào `docs/Requirements/`
          │
          ▼
[3. LẬP KẾ HOẠCH CHI TIẾT (PLAN)] ───────> Lưu vào `docs/Developing/plans/`
          │ (Chờ User Duyệt Plan)
          ▼
[4. THỰC THI & GHI NHẬT KÝ (LOGGING)] ───> Ghi chi tiết vào `docs/Developing/logs/`
          │
          ▼
[5. KIỂM THỬ & TỔNG KẾT (VERIFY)]
```

---

## I. QUY TRÌNH LÀM VIỆC TỪNG BƯỚC CỦA AGENT

### BƯỚC 1: ĐỌC NGỮ CẢNH NHANH (FAST CONTEXT ONBOARDING)
* **Quy tắc**: Khi bắt đầu một phiên làm việc mới, Agent **KHÔNG ĐƯỢC** đọc lan man toàn bộ mã nguồn của dự án (tránh tốn token và mất ngữ cảnh).
* **Trình tự đọc bắt buộc**:
  1. Đọc file này: `docs/AI Rules/AI_RULES.md` để nắm chắc các quy tắc cấm kỵ và quy chuẩn code.
  2. Đọc file `docs/Developing/logs/DEV_CHANGELOG.md` (các mục gần nhất) để biết: Lần trước đã làm đến đâu? Đã sửa file nào? Quyết định kiến trúc là gì? Vấn đề còn tồn đọng là gì?
  3. Chỉ mở mã nguồn của các file trực tiếp liên quan đến tác vụ được giao.

---

### BƯỚC 2: QUY ĐỔI MỤC TIÊU THÀNH REQUIREMENT
* **Quy tắc**: Mọi yêu cầu/mục tiêu từ người dùng phải được tài liệu hóa thành một bản Đặc tả Yêu cầu (Requirement Specification) trước khi bắt tay vào làm.
* **Vị trí lưu trữ**: `docs/Requirements/REQ-XX_<TÊN_TÍNH_NĂNG>.md`.
* **Cấu trúc một bản Requirement**:
  1. **Mã định danh**: `REQ-01`, `REQ-02`,...
  2. **Mục tiêu & Bối cảnh**: Tại sao cần tính năng này?
  3. **User Stories**: "Là một [Vai trò], tôi muốn [Hành động] để [Mục đích]".
  4. **Phạm vi chi tiết (In-scope / Out-of-scope)**.
  5. **Tiêu chí nghiệm thu (Acceptance Criteria - AC)**: Dạng checklist `[ ]` có thể kiểm thử rõ ràng.

---

### BƯỚC 3: LẬP KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT (ACTION PLAN)
* **Quy tắc**: Tuyệt đối không nhảy vào sửa code khi chưa có Plan được lưu trữ.
* **Vị trí lưu trữ**: `docs/Developing/plans/PLAN-XX_<TÊN_KẾ_HOẠCH>.md`.
* **Nội dung bắt buộc trong Plan**:
  * Mục tiêu cụ thể của đợt thay đổi.
  * Danh sách chính xác các file sẽ: `[TẠO MỚI]`, `[CHỈNH SỬA]`, `[XÓA]`.
  * Các bước thực hiện tuần tự (Step-by-step).
  * Đánh giá rủi ro (Risk Assessment) & Phương án rollback nếu lỗi.
  * Kế hoạch kiểm thử (Automated test & Manual verification).
* **Điểm dừng (Stop & Wait)**: Lưu file Plan lại, trình bày vắn tắt cho User và **chờ User duyệt** mới được sang Bước 4.

---

### BƯỚC 4: THỰC THI & GHI NHẬT KÝ THAY ĐỔI (DEV LOGGING)
* **Quy tắc**: Mọi thay đổi code đều phải được ghi lại nhật ký theo thời gian thực để người sau/phiên làm việc sau chỉ cần đọc log là hiểu nguyên nhân và ngữ cảnh.
* **Vị trí lưu trữ**: `docs/Developing/logs/DEV_CHANGELOG.md`.
* **Mỗi lượt ghi Log (Log Entry) phải có**:
  * **Thời gian & Người thực hiện / Phiên làm việc**.
  * **Tác vụ đang thực hiện** (liên kết tới `REQ-XX` hoặc `PLAN-XX`).
  * **Danh sách file đã thay đổi**.
  * **Tóm tắt nội dung thay đổi & Lý do đưa ra quyết định kỹ thuật** (Non-obvious decisions, gotchas, bug fix rationale).
  * **Trạng thái hiện tại** (Hoàn thành / Đang dở dang / Cần lưu ý gì).

---

### BƯỚC 5: KIỂM THỬ & BÀN GIAO (VERIFICATION)
* Chạy build hoặc kiểm tra lỗi cú pháp/types (`tsc --noEmit` nếu cần).
* Cập nhật lại checklist trong file Requirement và Plan (`[x]`).

---

## II. CÁC QUY TẮC KỸ THUẬT BẤT DI BẤT DỊCH

1. **BẢO TỒN NGHIỆP VỤ CŨ**: Tuyệt đối không rewrite từ đầu. Kế thừa toàn bộ logic phức tạp đã chạy tốt trong `orders.service.ts` (176KB), KDS sync, VietQR/Casso webhook, Chatbot AI.
2. **NGUYÊN TẮC CÔ LẬP TENANT**: Mọi truy vấn DB phải có `WHERE tenant_id = $1`. Lấy `tenant_id` từ token JWT, không tin cậy input từ client.
3. **MÔ HÌNH VAI TRÒ TINH GỌN (OWNER-CENTRIC)**:
   * 4 vai trò nội bộ: `platform_admin`, `owner`, `store_manager`, `staff`.
   * Role `owner` là superuser trong tenant: có quyền vào cả trang Quản trị Back-office lẫn màn hình Bán hàng POS của bất kỳ store nào.
4. **QUY TẮC ICON (CHỈ DÙNG ICON TRONG THƯ VIỆN JS/REACT)**:
   * Không sử dụng các icon ngoài, không tải ảnh icon từ web ngoài, không nhúng CDN font icon bên ngoài.
   * Chỉ sử dụng các icon có trong thư viện hỗ trợ của JavaScript/React (React SVG components, inline SVG tiêu chuẩn hoặc thư viện icon JS chính thống trong dự án).
5. **QUY TẮC MÀU SẮC (PHỔ MÀU XANH RÊU ĐẬM & KEM NGÀ THEO ẢNH MẪU)**:
   * Giao diện phải tuân thủ nghiêm ngặt theo 2 dải màu gốc trong ảnh mẫu:
     * **Xanh rêu đậm (Dark Moss Green)**: Màu chủ đạo/Brand Primary (`#364D39`, biến thể đậm `#2A3B2C`, nhạt hơn `#4A664E`).
     * **Kem ngà (Warm Ivory Cream)**: Màu nền/Background & Card Surface (`#F4EFEB`, sáng hơn `#FAF6F3`, viền/phân cách `#E8E0D5`).
   * Ràng buộc thiết kế: Không dùng màu sắc tùy tiện ngoài phổ màu này. Chỉ thay đổi sắc độ (tints, shades, opacity) để tạo sự khác biệt, tương phản và phân cấp thị giác (visual hierarchy).
6. **QUY TẮC BẮT BUỘC GHI NHẬT KÝ (LOG ACTION SAU MỖI TASK)**:
   * Mỗi khi hoàn thành một task, Agent bắt buộc phải ghi log chi tiết vào `docs/Developing/logs/DEV_CHANGELOG.md` (nêu rõ file đã sửa, lý do, kết quả) để phiên làm việc sau chỉ cần đọc log là tiếp tục được ngay mà không mất ngữ cảnh.
7. **CƠ SỞ DỮ LIỆU MỚI (DATABASE CONFIGURATION)**:
   * Hệ thống kết nối cơ sở dữ liệu Supabase mới thông qua `DATABASE_URL` trong `backend/.env`.
   * Cấu hình SSL hỗ trợ Supabase Pooler qua `NODE_TLS_REJECT_UNAUTHORIZED = "0"` trong `backend/src/config/db.ts`.
8. **BẢO LƯU DOCUMENT & CODE COMMENTS**: Giữ nguyên các comment giải thích bug lịch sử, migration notes trong mã nguồn.
9. **SỬ DỤNG ORM THAY VÌ SQL DRIVER THUẦN (ORM ADOPTION)**:
   * Mã nguồn cũ trước đây sử dụng raw SQL driver (`pg` với các câu query string thủ công `pool.query('SELECT ...')`).
   * Khi tái cấu trúc và xây dựng trên Database mới, hệ thống bắt buộc chuyển sang sử dụng **ORM** (như Drizzle ORM hoặc Prisma) để:
     - Đảm bảo 100% Type-safety từ database schema đến backend API và application logic.
     - Quản lý migration schema tự động, an toàn và có kiểm soát phiên bản (Versioned Migrations).
     - Dễ dàng thiết lập cơ chế tự động lọc `tenant_id` vào mọi query (Row-Level Multi-Tenancy) mà không phải nối chuỗi SQL thủ công `WHERE tenant_id = ...`.
     - Tối ưu hóa quan hệ bảng (Relations) và transaction xử lý đơn hàng/kho hàng.
10. **BẮT BUỘC ĐỌC VÀ ÁP DỤNG AGENT SKILLS TRƯỚC KHI THỰC HIỆN (SKILLS-FIRST PROTOCOL)**:
    * Trước khi thực hiện bất kỳ tác vụ nào, AI Agent **BẮT BUỘC** phải đọc các skills chuyên biệt tương ứng đã được cài đặt trong thư mục `.agents/skills/`:
      - **Khi làm việc với UI / Frontend**: Bắt buộc đọc bộ `taste-skill` (`.agents/skills/design-taste-frontend`, `minimalist-ui`, `high-end-visual-design`, `brandkit`) để định hình thẩm mỹ cao cấp, chống thiết kế rập khuôn (anti-slop), căn chỉnh visual density, typography và tuân thủ nghiêm ngặt phổ màu xanh rêu đậm & kem ngà.
      - **Khi làm việc với Database / Backend**: Bắt buộc đọc bộ `supabase` và `supabase-postgres-best-practices` (`.agents/skills/supabase-postgres-best-practices`, `.agents/skills/supabase`) để tuân thủ thiết kế schema chuẩn mực, đánh index hiệu năng cao, viết RLS policy an toàn và quản lý connection pooling.
11. **ƯU TIÊN TÍCH HỢP & TỐI ƯU MODULE CŨ (INTEGRATION-FIRST)**:
    * Trước khi tạo trang, route, component hoặc API mới, bắt buộc kiểm tra các module/UI/API hiện có phục vụ cùng nghiệp vụ.
    * Ưu tiên mở rộng, tái sử dụng và gộp tính năng vào trang nghiệp vụ hiện hữu mà người dùng đang dùng (ví dụ tab/hub quản trị), thay vì tạo luồng hoặc màn hình song song.
    * Chỉ tạo mới khi không thể mở rộng an toàn hoặc khi việc tách riêng có lợi ích kiến trúc rõ ràng; Plan phải nêu lý do và cách liên kết từ UI hiện hữu.
    * Khi giữ luồng cũ để tương thích, phải làm rõ luồng nào là primary và bảo đảm tính năng mới xuất hiện ở giao diện primary; không để chức năng chỉ tồn tại ở một route phụ khó phát hiện.

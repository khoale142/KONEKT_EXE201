# THƯ MỤC TIẾN TRÌNH PHÁT TRIỂN (DEVELOPING DIRECTORY)
**Vị trí**: `docs/Developing/`  
**Mục đích**: Lưu trữ toàn bộ các **Kế hoạch hành động (Plans)** và **Nhật ký thay đổi (Dev Logs/Changelogs)** phát sinh trong suốt vòng đời dự án.

---

## 📁 CẤU TRÚC THƯ MỤC CON

```
docs/Developing/
├── plans/               <-- Chứa các bản kế hoạch hành động chi tiết trước khi code
│   └── PLAN-XX_...md
└── logs/                <-- Chứa nhật ký thay đổi chi tiết theo thời gian thực
    └── DEV_CHANGELOG.md
```

---

## 📌 NGUYÊN TẮC HOẠT ĐỘNG
1. **Trước khi đụng vào code**: Bắt buộc phải có 1 file Plan trong `docs/Developing/plans/` và được User phê duyệt.
2. **Trong và sau khi code**: Mọi thay đổi (sửa file gì, lý do tại sao, gotchas gì) phải được ghi ngay vào `docs/Developing/logs/DEV_CHANGELOG.md`.
3. **Khi bắt đầu phiên làm việc mới**: AI Agent hoặc Lập trình viên chỉ cần đọc các mục gần nhất trong `logs/DEV_CHANGELOG.md` để nắm ngay ngữ cảnh dự án mà không cần scan lại toàn bộ codebase.

# Thiết kế follow-up: Combo & Bánh theo món nước

## PHẦN 1: Intent đề xuất

| Intent Code | Mô tả | Giữ/Gộp |
|-------------|-------|---------|
| `drink_pairing_combo` | Hỏi combo phù hợp với món nước vừa gợi ý | **Giữ** |
| `drink_pairing_cake` | Hỏi bánh đi kèm món nước | **Giữ** |
| `drink_pairing_combo_and_cake` | Hỏi cả combo và bánh trong cùng câu | **Tách** – response 2 phần: combo trước, bánh sau |

Keyword / pattern: xem `../intent-config.ts` (TARGET_PATTERNS, INTENT_RULES, SYNONYMS).

---

## PHẦN 2: Flow context & handler

- **Context:** `follow-up-context.resolver.ts` → parse tin nhắn, extract tên món từ "gợi ý bạn thử X nhé", lookup product, trả `lastRecommendedDrink` / `lastMentionedDrink`.
- **Handler:** `../handlers/drink-pairing.handler.ts` → gọi `resolveConversationContext`, `findCombosForDrink`, `pickRandomCakes`, format bằng `response-templates.ts`.

---

## PHẦN 3: Module trong folder này

| File | Mô tả |
|------|--------|
| `follow-up-context.resolver.ts` | Parse conversation → ConversationContext, lookupProductByName, mapCategoryToComboGroup |
| `combo-finder.service.ts` | findCombosForDrink (combo chứa món → combo cùng category) |
| `cake-picker.service.ts` | pickRandomCakes(limit) |
| `response-templates.ts` | askWhichDrinkMessage, formatComboResponse, formatCakeResponse, noCombo*, noCakeMessage |

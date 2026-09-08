/**
 * Response templates cho drink_pairing intents
 */

import { ComboItem } from "./combo-finder.service";
import { CakeItem } from "./cake-picker.service";

export function askWhichDrinkMessage(): string {
  return "Dạ bạn muốn mình gợi ý combo hoặc bánh cho món nào ạ? Bạn có thể cho mình biết tên món hoặc để mình gợi ý món trước nhé.";
}

export function formatComboResponse(combos: ComboItem[], drinkName?: string): string {
  const intro = drinkName
    ? `Dạ món ${drinkName} của bạn có thể đi kèm các combo sau:\n\n`
    : "Dạ bên mình có các combo phù hợp:\n\n";
  let body = "";
  for (const c of combos.slice(0, 5)) {
    body += `• ${c.name} – ${c.price.toLocaleString("vi-VN")}đ\n`;
    if (c.items.length > 0) body += `  ${c.items.join(" + ")}\n`;
  }
  if (combos.length > 5) body += `  ...và ${combos.length - 5} combo khác.\n`;
  body += "\nBạn có thể đặt combo trực tiếp tại cửa hàng nhé.";
  return intro + body;
}

export function formatCakeResponse(cakes: CakeItem[], drinkName?: string): string {
  const intro = drinkName
    ? `Dạ kèm món ${drinkName} bạn có thể thử các loại bánh sau:\n\n`
    : "Dạ mình gợi ý bạn một số loại bánh:\n\n";
  const items = cakes
    .map((c) => {
      const price =
        c.minPrice != null && c.maxPrice != null
          ? c.minPrice === c.maxPrice
            ? `${c.minPrice.toLocaleString("vi-VN")}đ`
            : `${c.minPrice!.toLocaleString("vi-VN")}đ - ${c.maxPrice!.toLocaleString("vi-VN")}đ`
          : "";
      return price ? `• ${c.name} (${price})` : `• ${c.name}`;
    })
    .join("\n");
  return intro + items + "\n\nBạn muốn đặt món nào nhé?";
}

export function noComboFallbackToCakeMessage(cakes: CakeItem[], drinkName?: string): string {
  let msg = "Dạ hiện chưa có combo phù hợp với món đó. ";
  msg += formatCakeResponse(cakes, drinkName);
  return msg;
}

export function noComboNoCakeMessage(): string {
  return "Dạ hiện chưa có combo phù hợp với món đó, và cũng chưa có bánh để gợi ý. Bạn có thể xem menu hoặc hỏi mình về món khác nhé.";
}

export function noCakeMessage(): string {
  return "Dạ hiện tại chưa có bánh phù hợp để gợi ý. Bạn có thể xem menu hoặc hỏi về combo nhé.";
}

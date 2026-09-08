import { pool } from "../../../../config/db";
import { BaseIntentHandler } from "./base.handler";
import { ASSISTANT_CONFIG } from "../../assistant.config";
import { ChatIntent, IntentHandlerContext, ChatResponse } from "../../types";

type ComboCategory = "tea" | "coffee" | "phindi";

const CATEGORY_MAP: Record<ComboCategory, string[]> = {
  tea: ["TEA", "TRA", "TEA_COLD", "TEA_HOT"],
  coffee: ["COFFEE", "ESPRESSO", "COFFEE_HOT", "COFFEE_ICE"],
  phindi: ["PHINDI", "PHIN DI"],
};

const CATEGORY_LABELS: Record<ComboCategory, string> = {
  tea: "tra",
  coffee: "ca phe",
  phindi: "phindi",
};

function toFriendlyCategoryName(categoryName: string): string {
  switch (categoryName) {
    case "BAKERY_SWEET":
      return "banh ngot";
    case "BAKERY_SAVORY":
      return "banh man";
    case "COFFEE":
    case "ESPRESSO":
    case "COFFEE_HOT":
    case "COFFEE_ICE":
      return "ca phe";
    case "TEA":
    case "TRA":
    case "TEA_COLD":
    case "TEA_HOT":
      return "tra";
    case "PHINDI":
    case "PHIN DI":
      return "phindi";
    default:
      return categoryName.toLowerCase().replace(/_/g, " ");
  }
}

function formatRuleItem(row: any): string {
  const quantity = Number(row.quantity_required || 1);
  const requiredSize = row.required_size ? ` size ${row.required_size}` : "";

  if (row.product_name) {
    const variantSize = row.variant_size ? ` size ${row.variant_size}` : "";
    return `${quantity} x ${row.product_name}${variantSize}`;
  }

  if (row.category_name) {
    const categoryName = toFriendlyCategoryName(String(row.category_name || ""));
    return `${quantity} x ${categoryName}${requiredSize}`;
  }

  if (row.group_name) {
    return `${quantity} x ${row.group_name}${requiredSize}`;
  }

  return `${quantity} x mon trong combo`;
}

export class ComboRecommendationHandler extends BaseIntentHandler {
  canHandle(intent: ChatIntent): boolean {
    return intent.code === "combo_recommendation" && intent.handlerType === "dynamic";
  }

  private getComboCategory(matchedKeywords: string[], message?: string): ComboCategory | null {
    if (matchedKeywords.includes("combo_tea")) return "tea";
    if (matchedKeywords.includes("combo_coffee")) return "coffee";
    if (matchedKeywords.includes("combo_phindi")) return "phindi";

    if (message) {
      const normalizedMessage = this.normalizeText(message);
      if (normalizedMessage.includes("combo tra") || normalizedMessage.includes("tra co combo")) return "tea";
      if (normalizedMessage.includes("combo ca phe") || normalizedMessage.includes("ca phe co combo")) return "coffee";
      if (normalizedMessage.includes("combo phindi") || normalizedMessage.includes("phindi co combo")) return "phindi";
    }

    return null;
  }

  private async getComboAvailability(): Promise<Record<ComboCategory, number>> {
    const result = await pool.query(
      `
      SELECT
        CASE
          WHEN UPPER(TRIM(COALESCE(c.name, ''))) IN ('TEA', 'TRA', 'TEA_COLD', 'TEA_HOT') THEN 'tea'
          WHEN UPPER(TRIM(COALESCE(c.name, ''))) IN ('COFFEE', 'ESPRESSO', 'COFFEE_HOT', 'COFFEE_ICE') THEN 'coffee'
          WHEN UPPER(TRIM(COALESCE(c.name, ''))) IN ('PHINDI', 'PHIN DI') THEN 'phindi'
          ELSE NULL
        END AS combo_category,
        COUNT(DISTINCT r.id)::int AS total
      FROM coffee_chain_db.combo_rules r
      JOIN coffee_chain_db.combo_rule_groups g ON g.combo_rule_id = r.id
      LEFT JOIN coffee_chain_db.categories c ON c.id = g.category_id
      WHERE r.is_active = TRUE
        AND g.group_name = 'beverage'
      GROUP BY 1
      `
    );

    const counts: Record<ComboCategory, number> = { tea: 0, coffee: 0, phindi: 0 };
    for (const row of result.rows) {
      const comboCategory = row.combo_category as ComboCategory | null;
      if (comboCategory) {
        counts[comboCategory] = Number(row.total || 0);
      }
    }
    return counts;
  }

  async handle(context: IntentHandlerContext): Promise<ChatResponse> {
    const category = this.getComboCategory(context.detectedIntent.matchedKeywords, context.message);
    if (!category) {
      return this.handleGeneral();
    }

    return this.handleSpecific(category);
  }

  private async handleGeneral(): Promise<ChatResponse> {
    try {
      const counts = await this.getComboAvailability();
      const lines = [
        "Da hien tai ben minh dang co combo theo 3 nhom:",
        `- Tra: ${counts.tea} lua chon`,
        `- Ca phe: ${counts.coffee} lua chon`,
        `- Phindi: ${counts.phindi} lua chon`,
        "",
        'Ban co the hoi "combo tra co gi?", "combo ca phe co gi?" hoac "combo phindi co gi?" de xem chi tiet.',
      ];

      return {
        answer: lines.join("\n"),
        intentCode: "combo_recommendation",
      };
    } catch {
      return {
        answer: ASSISTANT_CONFIG.noDataMessage,
        intentCode: "combo_recommendation",
      };
    }
  }

  private async handleSpecific(category: ComboCategory): Promise<ChatResponse> {
    const label = CATEGORY_LABELS[category];
    const dbValues = CATEGORY_MAP[category];

    try {
      const fixedResult = await pool.query(
        `
        SELECT
          cp.id,
          cp.code,
          cp.name,
          cp.combo_price,
          cp.description,
          ci.quantity,
          p.name AS product_name,
          pv.size
        FROM coffee_chain_db.combo_products cp
        JOIN coffee_chain_db.combo_items ci ON ci.combo_id = cp.id
        JOIN coffee_chain_db.product_variants pv ON pv.id = ci.product_variant_id
        JOIN coffee_chain_db.products p ON p.id = pv.product_id
        LEFT JOIN coffee_chain_db.categories c ON c.id = p.category_id
        WHERE cp.is_active = TRUE
          AND pv.is_active = TRUE
          AND p.is_active = TRUE
          AND UPPER(TRIM(COALESCE(c.name, ''))) = ANY($1::text[])
        ORDER BY cp.priority DESC NULLS LAST, cp.id ASC, ci.product_variant_id
        `,
        [dbValues]
      );

      const fixedCombos = new Map<number, { name: string; price: number; description: string | null; items: string[] }>();
      for (const row of fixedResult.rows) {
        const comboId = Number(row.id);
        const item = `${row.quantity} x ${row.product_name}${row.size ? ` size ${row.size}` : ""}`;
        if (!fixedCombos.has(comboId)) {
          fixedCombos.set(comboId, {
            name: String(row.name || row.code || "Combo"),
            price: Number(row.combo_price || 0),
            description: row.description || null,
            items: [],
          });
        }
        fixedCombos.get(comboId)!.items.push(item);
      }

      const ruleResult = await pool.query(
        `
        SELECT
          r.id,
          r.code,
          r.name,
          r.description,
          r.combo_price,
          r.priority,
          g.group_no,
          g.group_name,
          g.quantity_required,
          g.required_size,
          UPPER(TRIM(COALESCE(c.name, ''))) AS category_name,
          p.name AS product_name,
          pv.size AS variant_size
        FROM coffee_chain_db.combo_rules r
        JOIN coffee_chain_db.combo_rule_groups g ON g.combo_rule_id = r.id
        LEFT JOIN coffee_chain_db.categories c ON c.id = g.category_id
        LEFT JOIN coffee_chain_db.products p ON p.id = g.product_id
        LEFT JOIN coffee_chain_db.product_variants pv ON pv.id = g.product_variant_id
        WHERE r.is_active = TRUE
          AND EXISTS (
            SELECT 1
            FROM coffee_chain_db.combo_rule_groups g2
            LEFT JOIN coffee_chain_db.categories c2 ON c2.id = g2.category_id
            WHERE g2.combo_rule_id = r.id
              AND UPPER(TRIM(COALESCE(c2.name, ''))) = ANY($1::text[])
          )
        ORDER BY r.priority DESC NULLS LAST, r.id ASC, g.group_no ASC
        `,
        [dbValues]
      );

      const ruleCombos = new Map<number, { name: string; price: number; description: string | null; items: string[] }>();
      for (const row of ruleResult.rows) {
        const ruleId = Number(row.id);
        if (!ruleCombos.has(ruleId)) {
          ruleCombos.set(ruleId, {
            name: String(row.name || row.code || "Combo uu dai"),
            price: Number(row.combo_price || 0),
            description: row.description || null,
            items: [],
          });
        }
        ruleCombos.get(ruleId)!.items.push(formatRuleItem(row));
      }

      if (fixedCombos.size === 0 && ruleCombos.size === 0) {
        return {
          answer: `Da hien tai minh chua co combo ${label}. Ban co the hoi nhom combo khac hoac xem menu ${label} nhe.`,
          intentCode: "combo_recommendation",
        };
      }

      const lines = [`Combo ${label} hien co:`];

      if (fixedCombos.size > 0) {
        lines.push("");
        lines.push("Combo co san:");
        for (const combo of Array.from(fixedCombos.values()).slice(0, 5)) {
          lines.push(`- ${combo.name}: ${combo.price.toLocaleString("vi-VN")}d`);
          lines.push(`  ${combo.items.join(" + ")}`);
        }
      }

      if (ruleCombos.size > 0) {
        lines.push("");
        lines.push("Combo uu dai theo nhom mon:");
        for (const combo of Array.from(ruleCombos.values()).slice(0, 5)) {
          lines.push(`- ${combo.name}: ${combo.price.toLocaleString("vi-VN")}d`);
          lines.push(`  ${combo.items.join(" + ")}`);
          if (combo.description) {
            lines.push(`  ${combo.description}`);
          }
        }
      }

      lines.push("");
      lines.push("Ban muon minh goi y tiep combo nhom khac hoac mon di kem nao khong?");

      return {
        answer: lines.join("\n"),
        intentCode: "combo_recommendation",
        metadata: {
          category,
          fixedCount: fixedCombos.size,
          dynamicCount: ruleCombos.size,
        },
      };
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err.message?.includes("does not exist") || err.message?.includes("relation") || err.code === "42P01") {
        return {
          answer: ASSISTANT_CONFIG.noDataMessage,
          intentCode: "combo_recommendation",
        };
      }

      return {
        answer: ASSISTANT_CONFIG.noDataMessage,
        intentCode: "combo_recommendation",
      };
    }
  }
}

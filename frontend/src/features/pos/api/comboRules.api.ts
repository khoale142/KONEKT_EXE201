import api from "../../../lib/http/axios";

export type ComboRulePreviewSelectedItem = {
  groupNo: number;
  productVariantId: number;
  productName: string;
  size?: string | null;
  unitPrice: number;
};

export type ComboRulePreviewApplication = {
  selectedItems: ComboRulePreviewSelectedItem[];
};

export type ComboRulePreview = {
  comboRuleId: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  maxApplicable: number;
  totalSaving: number;
  applications: ComboRulePreviewApplication[];
};

export type ComboRuleSuggestedItem = {
  groupNo: number;
  productVariantId: number;
  productName: string;
  size?: string | null;
  unitPrice: number;
  categoryKey?: string | null;
  categoryName?: string | null;
};

export type ComboRuleSuggestedPreview = {
  comboRuleId: number;
  code: string;
  name: string;
  description?: string | null;
  comboPrice: number;
  originalTotal: number;
  totalSaving: number;
  matchedItems: ComboRuleSuggestedItem[];
  missingItems: ComboRuleSuggestedItem[];
};

export async function previewComboRules(
  items: Array<{ productVariantId: number; quantity: number }>
) {
  const r = await api.post("/pos/combo-rules/preview", { items });
  return r.data as {
    ok: boolean;
    eligibleRules: ComboRulePreview[];
    suggestedRules: ComboRuleSuggestedPreview[];
  };
}
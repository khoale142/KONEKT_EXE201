import "dotenv/config";
import { posPreviewOrderPricingService } from "../modules/pos-orders/posOrder.service";
import { getPosMenu } from "../modules/menu/menu.service";

async function testServices() {
  console.log("--- Testing getPosMenu ---");
  try {
    const menu = await getPosMenu();
    console.log("getPosMenu OK, categories:", menu.categories?.length);
  } catch (e: any) {
    console.error("getPosMenu ERROR:", e.message, e.code);
  }

  console.log("\n--- Testing posPreviewOrderPricingService ---");
  try {
    const preview = await posPreviewOrderPricingService({
      storeId: 1,
      items: [{ productVariantId: 1, quantity: 1 }],
      orderType: "NORMAL",
      combos: [],
      appliedComboRules: [],
    });
    console.log("posPreviewOrderPricingService OK:", JSON.stringify(preview, null, 2));
  } catch (e: any) {
    console.error("posPreviewOrderPricingService ERROR:", e.message, e.code);
  }

  process.exit(0);
}

testServices();

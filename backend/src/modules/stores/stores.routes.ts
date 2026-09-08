import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import { listStores, getStoreDetail } from "./stores.service";
import { patchStoreReview, deleteStoreReviewHandler } from "../store-reviews/storeReviews.controller";

const router = Router();

/** Danh sách cửa hàng - public, optional ?city= filter */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const city = (req.query.city as string) || undefined;
    const stores = await listStores(city);
    res.json({ stores });
  })
);

/** Chi tiết cửa hàng */
router.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);

    const store = await getStoreDetail(id);

    if (!store) {
      return res.status(404).json({
        message: "Store not found",
      });
    }

    res.json({ store });
  })
);

/** PATCH /stores/:storeId/reviews/:reviewId - Edit review (auth required, owner only) */
router.patch(
  "/:storeId/reviews/:reviewId",
  authGuard,
  portalGuard(["CUSTOMER"]),
  asyncHandler(patchStoreReview)
);

/** DELETE /stores/:storeId/reviews/:reviewId - Delete review (auth required, owner only) */
router.delete(
  "/:storeId/reviews/:reviewId",
  authGuard,
  portalGuard(["CUSTOMER"]),
  asyncHandler(deleteStoreReviewHandler)
);

export default router;
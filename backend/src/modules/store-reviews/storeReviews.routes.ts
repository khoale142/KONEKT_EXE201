import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { optionalAuthGuard } from "../../middlewares/optionalAuthGuard";
import { authGuard } from "../../middlewares/authGuard";
import { portalGuard } from "../../middlewares/portalGuard";
import {
    listStoreReviews,
    addStoreReview,
    getMyStoreReview,
} from "./storeReviews.controller";

const router = Router();

router.get(
    "/:storeId/my-review",
    authGuard,
    portalGuard(["CUSTOMER"]),
    asyncHandler(getMyStoreReview)
);

router.get(
    "/:storeId",
    asyncHandler(listStoreReviews)
);

router.post(
    "/:storeId",
    optionalAuthGuard,
    asyncHandler(addStoreReview)
);

export default router;
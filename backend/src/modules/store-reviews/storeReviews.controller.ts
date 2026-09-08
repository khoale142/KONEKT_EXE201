import { Request, Response } from "express";
import {
    getStoreReviews,
    createStoreReview,
    updateStoreReview,
    deleteStoreReview,
    getReviewById,
    getUserReviewForStore,
    countCompletedOrdersForCustomerAtStore,
} from "./storeReviews.service";
import { ApiError } from "../../utils/apiError";

function assertIntegerRatings1To5(
    overall: number,
    serviceRating: number,
    spaceRating: number,
    foodRating: number
): void {
    for (const x of [overall, serviceRating, spaceRating, foodRating]) {
        if (!Number.isInteger(x) || x < 1 || x > 5) {
            throw new ApiError(400, "Mọi điểm đánh giá phải là số nguyên từ 1 đến 5");
        }
    }

    const avg = (serviceRating + spaceRating + foodRating) / 3;
    const rounded = Math.round(avg);
    if (Math.abs(overall - rounded) > 1) {
        throw new ApiError(
            400,
            "Điểm tổng phải phù hợp với trung bình ba tiêu chí (dịch vụ, không gian, thực phẩm), chênh lệch tối đa 1 sao"
        );
    }
}

/* GET my review for store - authenticated customer only */
export async function getMyStoreReview(req: Request, res: Response) {
    const storeId = String(req.params.storeId);
    const userId = req.user?.portal === "CUSTOMER" && req.user?.sub
        ? Number(req.user.sub)
        : null;
    if (userId == null) {
        return res.status(401).json({ message: "Cần đăng nhập tài khoản khách hàng" });
    }
    const [review, purchaseCount] = await Promise.all([
        getUserReviewForStore(storeId, userId),
        countCompletedOrdersForCustomerAtStore(storeId, userId),
    ]);
    const hasCompletedOrder = purchaseCount > 0;
    if (!review) {
        return res.json({
            review: null,
            hasCompletedOrder,
            completedOrderCount: purchaseCount,
        });
    }
    const overall = Number(review.rating);
    res.json({
        review: {
            id: review.id,
            rating: overall,
            serviceRating: Number(review.service_rating ?? overall),
            spaceRating: Number(review.space_rating ?? overall),
            foodRating: Number(review.food_rating ?? overall),
            comment: review.comment ?? "",
            createdAt: review.created_at,
            images: Array.isArray(review.images) ? review.images : [],
        },
        hasCompletedOrder,
        completedOrderCount: purchaseCount,
    });
}

/* GET reviews - public, returns rating summary + latest 10 */
export async function listStoreReviews(req: Request, res: Response) {
    const storeId = String(req.params.storeId);
    const data = await getStoreReviews(storeId);
    res.json(data);
}

/* POST review — chỉ CUSTOMER đã có ít nhất 1 đơn completed tại quán. Mỗi user 1 review/store (có thể sửa). */
export async function addStoreReview(req: Request, res: Response) {
    const storeId = String(req.params.storeId);
    const { rating, serviceRating, spaceRating, foodRating, comment, images } = req.body;

    const r = Number(rating);
    const sr = Number(serviceRating);
    const sp = Number(spaceRating);
    const f = Number(foodRating);
    try {
        assertIntegerRatings1To5(r, sr, sp, f);
    } catch (e: unknown) {
        const msg = e instanceof ApiError ? e.message : "Dữ liệu đánh giá không hợp lệ";
        const code = e instanceof ApiError ? e.statusCode : 400;
        return res.status(code).json({ message: msg });
    }

    const userId = req.user?.portal === "CUSTOMER" && req.user?.sub
        ? Number(req.user.sub)
        : null;

    if (userId == null) {
        return res.status(401).json({ message: "Cần đăng nhập tài khoản khách hàng để đánh giá cửa hàng" });
    }

    const purchaseCount = await countCompletedOrdersForCustomerAtStore(storeId, userId);
    if (purchaseCount < 1) {
        return res.status(403).json({
            message: "Chỉ khách đã hoàn thành ít nhất một đơn tại cửa hàng này mới được đánh giá",
        });
    }

    const existing = await getUserReviewForStore(storeId, userId);
    if (existing) {
        return res.status(400).json({ message: "Bạn đã đánh giá cửa hàng này rồi. Chỉ có thể sửa hoặc xóa đánh giá." });
    }

    const safeImages = Array.isArray(images)
        ? images.filter((u) => typeof u === "string").slice(0, 10)
        : [];

    const review = await createStoreReview(storeId, r, sr, sp, f, (comment ?? "").trim(), userId, safeImages);
    res.status(201).json({ review });
}

/* PATCH edit review - requires auth, only owner can edit */
export async function patchStoreReview(req: Request, res: Response) {
    const storeId = String(req.params.storeId);
    const reviewId = Number(req.params.reviewId);

    if (!req.user?.sub) {
        return res.status(401).json({ message: "Cần đăng nhập để sửa đánh giá" });
    }
    if (req.user.portal !== "CUSTOMER") {
        return res.status(403).json({ message: "Chỉ khách hàng mới được sửa đánh giá" });
    }

    const { rating, serviceRating, spaceRating, foodRating, comment, images } = req.body;
    const r = Number(rating);
    const sr = Number(serviceRating);
    const sp = Number(spaceRating);
    const f = Number(foodRating);
    try {
        assertIntegerRatings1To5(r, sr, sp, f);
    } catch (e: unknown) {
        const msg = e instanceof ApiError ? e.message : "Dữ liệu đánh giá không hợp lệ";
        const code = e instanceof ApiError ? e.statusCode : 400;
        return res.status(code).json({ message: msg });
    }

    const existing = await getReviewById(reviewId, storeId);
    if (!existing) {
        return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }
    const existingUserId = existing.user_id != null ? Number(existing.user_id) : null;
    const currentUserId = Number(req.user.sub);
    if (existingUserId !== currentUserId) {
        return res.status(403).json({ message: "Chỉ chủ sở hữu đánh giá mới được sửa" });
    }

    const safeImages = Array.isArray(images)
        ? images.filter((u) => typeof u === "string").slice(0, 10)
        : undefined;

    const review = await updateStoreReview(
        reviewId,
        storeId,
        r,
        sr,
        sp,
        f,
        (comment ?? "").trim(),
        currentUserId,
        safeImages
    );
    if (!review) {
        return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }
    res.json({ review });
}

/* DELETE review - requires auth, only owner can delete */
export async function deleteStoreReviewHandler(req: Request, res: Response) {
    const storeId = String(req.params.storeId);
    const reviewId = Number(req.params.reviewId);

    if (!req.user?.sub) {
        return res.status(401).json({ message: "Cần đăng nhập để xóa đánh giá" });
    }
    if (req.user.portal !== "CUSTOMER") {
        return res.status(403).json({ message: "Chỉ khách hàng mới được xóa đánh giá" });
    }

    const existing = await getReviewById(reviewId, storeId);
    if (!existing) {
        return res.status(404).json({ message: "Không tìm thấy đánh giá" });
    }
    const existingUserId = existing.user_id != null ? Number(existing.user_id) : null;
    const currentUserId = Number(req.user.sub);
    if (existingUserId !== currentUserId) {
        return res.status(403).json({ message: "Chỉ chủ sở hữu đánh giá mới được xóa" });
    }

    const deleted = await deleteStoreReview(reviewId, storeId, currentUserId);
    if (!deleted) {
        return res.status(404).json({ message: "Không thể xóa đánh giá" });
    }
    res.json({ message: "Đã xóa đánh giá" });
}

/* PUT edit review - backward compatible, delegates to patch logic */
export async function editStoreReview(req: Request, res: Response) {
    const reviewId = req.params.reviewId;
    const storeId = req.body.storeId ?? req.query.storeId;
    if (!storeId) {
        return res.status(400).json({ message: "Thiếu storeId" });
    }
    req.params.storeId = String(storeId);
    req.params.reviewId = String(reviewId);
    return patchStoreReview(req, res);
}

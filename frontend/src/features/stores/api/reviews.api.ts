import api from "../../../lib/http/axios";

export type ReviewRating = {
    average: number;
    serviceAverage: number;
    spaceAverage: number;
    foodAverage: number;
    totalReviews: number;
};

export type ReviewUser = {
    id: number | null;
    name: string;
};

export type StoreReview = {
    id: number;
    rating: number;
    serviceRating: number;
    spaceRating: number;
    foodRating: number;
    comment: string;
    createdAt: string;
    user: ReviewUser;
    images?: string[];
};

export type StoreReviewsResponse = {
    rating: ReviewRating;
    reviews: StoreReview[];
};

export async function getStoreReviews(storeId: string): Promise<StoreReviewsResponse> {
    const r = await api.get(`/store-reviews/${storeId}`);
    return r.data;
}

export type MyStoreReview = {
    id: number;
    rating: number;
    serviceRating: number;
    spaceRating: number;
    foodRating: number;
    comment: string;
    createdAt: string;
    images?: string[];
} | null;

export type MyStoreReviewResponse = {
    review: MyStoreReview;
    hasCompletedOrder: boolean;
    completedOrderCount: number;
};

export async function getMyStoreReview(storeId: string): Promise<MyStoreReviewResponse> {
    const r = await api.get(`/store-reviews/${storeId}/my-review`);
    return r.data;
}

export async function createStoreReview(
    storeId: string,
    rating: number,
    serviceRating: number,
    spaceRating: number,
    foodRating: number,
    comment: string,
    images?: string[]
) {
    const r = await api.post(`/store-reviews/${storeId}`, {
        rating,
        serviceRating,
        spaceRating,
        foodRating,
        comment: (comment ?? "").trim(),
        images: Array.isArray(images) ? images : undefined,
    });
    return r.data;
}

export async function updateStoreReview(
    storeId: string,
    reviewId: number,
    rating: number,
    serviceRating: number,
    spaceRating: number,
    foodRating: number,
    comment: string,
    images?: string[]
) {
    const r = await api.patch(`/stores/${storeId}/reviews/${reviewId}`, {
        rating,
        serviceRating,
        spaceRating,
        foodRating,
        comment: (comment ?? "").trim(),
        images: Array.isArray(images) ? images : undefined,
    });
    return r.data;
}

export async function deleteStoreReview(storeId: string, reviewId: number) {
    const r = await api.delete(`/stores/${storeId}/reviews/${reviewId}`);
    return r.data;
}

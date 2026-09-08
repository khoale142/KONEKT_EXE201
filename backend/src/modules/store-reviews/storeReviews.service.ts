import { pool } from "../../config/db";

export async function countCompletedOrdersForCustomerAtStore(
  storeId: string,
  customerId: number
): Promise<number> {
  const sid = Number(storeId);
  if (!Number.isFinite(sid) || sid <= 0) return 0;
  const r = await pool.query(
    `
      SELECT COUNT(*)::int AS n
      FROM coffee_chain_db.orders
      WHERE customer_id = $1 AND store_id = $2 AND status = 'completed'
    `,
    [customerId, sid]
  );
  return Number(r.rows[0]?.n ?? 0);
}

/* lấy danh sách review của store với avg, total, latest 10 */
export async function getStoreReviews(storeId: string) {
  const ratingQ = `
    SELECT
      COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS average,
      COALESCE(ROUND(AVG(service_rating)::numeric, 1), 0)::float AS service_average,
      COALESCE(ROUND(AVG(space_rating)::numeric, 1), 0)::float AS space_average,
      COALESCE(ROUND(AVG(food_rating)::numeric, 1), 0)::float AS food_average,
      COUNT(*)::int AS total_reviews
    FROM store_reviews
    WHERE store_id = $1
  `;
  const ratingRes = await pool.query(ratingQ, [storeId]);
  const ratingRow = ratingRes.rows[0] || {
    average: 0,
    service_average: 0,
    space_average: 0,
    food_average: 0,
    total_reviews: 0,
  };

  const reviewsQ = `
    SELECT
      sr.id,
      sr.rating,
      sr.service_rating,
      sr.space_rating,
      sr.food_rating,
      sr.comment,
      sr.created_at,
      sr.user_id,
      COALESCE(c.full_name, 'Guest') AS user_name,
      sr.images
    FROM store_reviews sr
    LEFT JOIN customers c ON c.id = sr.user_id
    WHERE sr.store_id = $1
    ORDER BY sr.created_at DESC
    LIMIT 10
  `;
  const reviewsRes = await pool.query(reviewsQ, [storeId]);

  const reviews = reviewsRes.rows.map((row: Record<string, unknown>) => {
    const rawImages = row.images as unknown;
    let images: string[] = [];
    if (Array.isArray(rawImages)) {
      images = rawImages.filter((u) => typeof u === "string");
    }
    const overall = Number(row.rating ?? 0);
    return {
      id: row.id,
      rating: overall,
      serviceRating: Number(row.service_rating ?? overall),
      spaceRating: Number(row.space_rating ?? overall),
      foodRating: Number(row.food_rating ?? overall),
      comment: row.comment ?? "",
      createdAt: row.created_at,
      user: {
        id: row.user_id ?? null,
        name: String(row.user_name ?? "Guest"),
      },
      images,
    };
  });

  return {
    rating: {
      average: Number(ratingRow.average ?? 0),
      serviceAverage: Number(ratingRow.service_average ?? 0),
      spaceAverage: Number(ratingRow.space_average ?? 0),
      foodAverage: Number(ratingRow.food_average ?? 0),
      totalReviews: Number(ratingRow.total_reviews ?? 0),
    },
    reviews,
  };
}

/* kiểm tra user đã đánh giá store chưa */
export async function getUserReviewForStore(storeId: string, userId: number) {
  const q = `
    SELECT id, rating, service_rating, space_rating, food_rating, comment, created_at, images
    FROM store_reviews
    WHERE store_id = $1 AND user_id = $2
    LIMIT 1
  `;
  const r = await pool.query(q, [storeId, userId]);
  return r.rows[0] ?? null;
}

/* lấy chi tiết 1 review (cho ownership check) */
export async function getReviewById(reviewId: number, storeId: string) {
  const q = `
    SELECT id, user_id, store_id
    FROM store_reviews
    WHERE id = $1 AND store_id = $2
  `;
  const r = await pool.query(q, [reviewId, storeId]);
  return r.rows[0] ?? null;
}

/* tạo review */
export async function createStoreReview(
  storeId: string,
  rating: number,
  serviceRating: number,
  spaceRating: number,
  foodRating: number,
  comment: string,
  userId: number | null = null,
  images: string[] = []
) {
  const hasUserId = userId != null;
  const q = hasUserId
    ? `INSERT INTO store_reviews (store_id, rating, service_rating, space_rating, food_rating, comment, user_id, images)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, store_id, rating, service_rating, space_rating, food_rating, comment, created_at, user_id, images`
    : `INSERT INTO store_reviews (store_id, rating, service_rating, space_rating, food_rating, comment, images)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, store_id, rating, service_rating, space_rating, food_rating, comment, created_at, user_id, images`;

  const safeImages = Array.isArray(images) ? images.filter((u) => typeof u === "string") : [];
  const params = hasUserId
    ? [
        storeId,
        rating,
        serviceRating,
        spaceRating,
        foodRating,
        (comment || "").trim(),
        userId,
        JSON.stringify(safeImages),
      ]
    : [
        storeId,
        rating,
        serviceRating,
        spaceRating,
        foodRating,
        (comment || "").trim(),
        JSON.stringify(safeImages),
      ];
  const r = await pool.query(q, params);
  return r.rows[0];
}

/* xóa review - chỉ owner mới được xóa */
export async function deleteStoreReview(reviewId: number, storeId: string, userId: number) {
  const q = `
    DELETE FROM store_reviews
    WHERE id = $1 AND store_id = $2 AND user_id = $3
    RETURNING id
  `;
  const r = await pool.query(q, [reviewId, storeId, userId]);
  return r.rowCount ? r.rows[0] : null;
}

/* sửa review - chỉ owner mới được sửa */
export async function updateStoreReview(
  reviewId: number,
  storeId: string,
  rating: number,
  serviceRating: number,
  spaceRating: number,
  foodRating: number,
  comment: string,
  userId: number,
  images?: string[]
) {
  const q = `
    UPDATE store_reviews
    SET rating = $1,
        service_rating = $2,
        space_rating = $3,
        food_rating = $4,
        comment = $5,
        images = COALESCE($6, images),
        updated_at = NOW()
    WHERE id = $7 AND store_id = $8 AND user_id = $9
    RETURNING id, store_id, rating, service_rating, space_rating, food_rating, comment, created_at, images, updated_at
  `;
  const safeImages = Array.isArray(images) ? images.filter((u) => typeof u === "string") : undefined;
  const r = await pool.query(q, [
    rating,
    serviceRating,
    spaceRating,
    foodRating,
    (comment || "").trim(),
    safeImages ? JSON.stringify(safeImages) : null,
    reviewId,
    storeId,
    userId,
  ]);
  return r.rows[0];
}

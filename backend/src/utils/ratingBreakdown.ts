import { ApiError } from "./apiError";


export function assertIntegerRatings1To5(
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

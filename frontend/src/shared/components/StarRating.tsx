import { useState } from "react";

type Props = {
    rating: number;
    setRating?: (r: number) => void;
    size?: number;
};

export default function StarRating({ rating, setRating, size = 24 }: Props) {
    const [hover, setHover] = useState(0);
    const display = setRating ? (hover || rating) : rating;
    const isInteractive = !!setRating;

    return (
        <div
            style={{
                display: "flex",
                gap: 4,
                alignItems: "center",
            }}
            onMouseLeave={() => isInteractive && setHover(0)}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <span
                    key={star}
                    role={isInteractive ? "button" : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                    aria-label={isInteractive ? `Đánh giá ${star} sao` : undefined}
                    style={{
                        fontSize: size,
                        cursor: isInteractive ? "pointer" : "default",
                        color: star <= display ? "#f5b301" : "#ccc",
                        transition: "color 0.15s ease, transform 0.15s ease",
                    }}
                    onClick={() => setRating?.(star)}
                    onKeyDown={(e) => {
                        if (isInteractive && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            setRating?.(star);
                        }
                    }}
                    onMouseEnter={() => isInteractive && setHover(star)}
                    onFocus={() => isInteractive && setHover(star)}
                >
                    ★
                </span>
            ))}
        </div>
    );
}
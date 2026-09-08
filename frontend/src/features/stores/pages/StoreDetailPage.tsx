import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import { useAuthStore } from "../../../app/store/auth.store";
import { showToast } from "../../../shared/components/Toast";
import { getStoreDetail, type StoreDetail } from "../api/stores.api";
import StarRating from "../../../shared/components/StarRating";
import {
    getStoreReviews,
    getMyStoreReview,
    createStoreReview,
    updateStoreReview,
    deleteStoreReview,
    type MyStoreReview,
    type StoreReview,
    type StoreReviewsResponse,
} from "../api/reviews.api";
import { uploadReviewImage } from "../utils/uploadReviewImage";
import { getStoreOpenStatus } from "../utils/openStatus";
import { getMapEmbedUrl } from "../utils/mapUrl";

function formatReviewDate(createdAt: string) {
    try {
        const d = new Date(createdAt);
        return d.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return createdAt;
    }
}

function getInitial(name: string) {
    return (name || "G").charAt(0).toUpperCase();
}

function getRatingLabel(value: number) {
    if (value >= 4.5) return "Rất tốt";
    if (value >= 4.0) return "Tốt";
    if (value >= 3.0) return "Khá ổn";
    if (value >= 2.0) return "Chưa tốt";
    if (value > 0) return "Cần cải thiện";
    return "Chưa có đánh giá";
}

function ReviewCategoryChips({
    service,
    space,
    food,
}: {
    service: number;
    space: number;
    food: number;
}) {
    const items = [
        { label: "Dịch vụ", value: service },
        { label: "Không gian", value: space },
        { label: "Chất lượng món", value: food },
    ];

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
            }}
        >
            {items.map((item) => (
                <span
                    key={item.label}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: "#f6f3ef",
                        border: "1px solid #e7ddd1",
                        color: "#5a4636",
                        fontSize: "0.84rem",
                        fontWeight: 500,
                        lineHeight: 1,
                    }}
                >
                    <span>{item.label}</span>
                    <span style={{ fontWeight: 700 }}>{item.value.toFixed(1)}</span>
                </span>
            ))}
        </div>
    );
}

export default function StoreDetailPage() {
    const { id } = useParams();
    const user = useAuthStore((s) => s.user);
    const customerDisplayName = user?.fullName?.trim() || user?.username?.trim() || "Bạn";

    type EditableReview = NonNullable<MyStoreReview>;

    const [store, setStore] = useState<StoreDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [reviewsData, setReviewsData] = useState<StoreReviewsResponse | null>(null);
    const [myReview, setMyReview] = useState<MyStoreReview>(null);
    const [hasCompletedOrderAtStore, setHasCompletedOrderAtStore] = useState(false);
    const [reviewAccessLoading, setReviewAccessLoading] = useState(false);

    const [rating, setRating] = useState(0);
    const [serviceRating, setServiceRating] = useState(0);
    const [spaceRating, setSpaceRating] = useState(0);
    const [foodRating, setFoodRating] = useState(0);
    const [comment, setComment] = useState("");
    const [editingReview, setEditingReview] = useState<EditableReview | null>(null);
    const [editRating, setEditRating] = useState(0);
    const [editServiceRating, setEditServiceRating] = useState(0);
    const [editSpaceRating, setEditSpaceRating] = useState(0);
    const [editFoodRating, setEditFoodRating] = useState(0);
    const [editComment, setEditComment] = useState("");
    const [newImages, setNewImages] = useState<string[]>([]);
    const [editImages, setEditImages] = useState<string[]>([]);
    const [uploadingNew, setUploadingNew] = useState(false);
    const [uploadingEdit, setUploadingEdit] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const isCustomer = user?.portal === "CUSTOMER";
    const currentUserId = user?.id ?? (user?.sub ? Number(user.sub) : null);

    const loadReviews = async () => {
        if (!id) return;
        try {
            const data = await getStoreReviews(id);
            setReviewsData(data);
        } catch (err) {
            console.error("Load reviews failed", err);
        }
    };

    const loadMyReview = async () => {
        if (!id || !isCustomer) {
            setMyReview(null);
            setHasCompletedOrderAtStore(false);
            setReviewAccessLoading(false);
            return;
        }

        setReviewAccessLoading(true);
        try {
            const data = await getMyStoreReview(id);
            setMyReview(data.review);
            setHasCompletedOrderAtStore(Boolean(data.hasCompletedOrder));
        } catch (err) {
            console.error("Load my review failed", err);
            setMyReview(null);
            setHasCompletedOrderAtStore(false);
        } finally {
            setReviewAccessLoading(false);
        }
    };

    const refreshReviewData = async () => {
        await Promise.all([
            loadReviews(),
            isCustomer ? loadMyReview() : Promise.resolve(),
        ]);
    };

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const data = await getStoreDetail(id);
                setStore(data);
            } catch (err) {
                console.error("Load store failed", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    useEffect(() => {
        loadReviews();
    }, [id]);

    useEffect(() => {
        if (!id) return;
        if (!isCustomer) {
            setMyReview(null);
            setHasCompletedOrderAtStore(false);
            setReviewAccessLoading(false);
            return;
        }
        loadMyReview();
    }, [id, isCustomer, currentUserId]);

    const openStatus = store?.openHours ? getStoreOpenStatus(store.openHours) : null;
    const mapUrl = store ? getMapEmbedUrl(store) : "";

    const syncOverallFromParts = (svc: number, spc: number, food: number, setOverall: (n: number) => void) => {
        if (svc >= 1 && spc >= 1 && food >= 1) {
            setOverall(Math.round((svc + spc + food) / 3));
        }
    };

    const handleSubmitReview = async () => {
        if (!id || rating < 1 || serviceRating < 1 || spaceRating < 1 || foodRating < 1) {
            showToast("error", "Vui lòng chọn đủ các mức sao (dịch vụ, không gian, chất lượng món, tổng thể)");
            return;
        }
        if (!isCustomer) {
            showToast("error", "Vui lòng đăng nhập tài khoản khách hàng để đánh giá");
            return;
        }
        setSubmitting(true);
        try {
            await createStoreReview(id, rating, serviceRating, spaceRating, foodRating, comment.trim(), newImages);
            setComment("");
            setRating(0);
            setServiceRating(0);
            setSpaceRating(0);
            setFoodRating(0);
            setNewImages([]);
            await refreshReviewData();
        } catch (err: any) {
            showToast("error", err?.response?.data?.message ?? "Gửi đánh giá thất bại");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStartEdit = (r: EditableReview) => {
        setEditingReview(r);
        const o = r.rating;
        setEditRating(o);
        setEditServiceRating(r.serviceRating ?? o);
        setEditSpaceRating(r.spaceRating ?? o);
        setEditFoodRating(r.foodRating ?? o);
        setEditComment(r.comment);
        setEditImages(Array.isArray(r.images) ? r.images : []);
        setDeleteConfirm(null);
    };

    const handleCancelEdit = () => {
        setEditingReview(null);
        setEditRating(0);
        setEditServiceRating(0);
        setEditSpaceRating(0);
        setEditFoodRating(0);
        setEditComment("");
    };

    const handleSaveEdit = async () => {
        if (!id || !editingReview || editRating < 1 || editServiceRating < 1 || editSpaceRating < 1 || editFoodRating < 1) {
            showToast("error", "Vui lòng chọn đủ các mức sao");
            return;
        }
        setSubmitting(true);
        try {
            await updateStoreReview(
                id,
                editingReview.id,
                editRating,
                editServiceRating,
                editSpaceRating,
                editFoodRating,
                editComment.trim(),
                editImages
            );
            handleCancelEdit();
            await refreshReviewData();
        } catch (err: any) {
            showToast("error", err?.response?.data?.message ?? "Cập nhật đánh giá thất bại");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteClick = (reviewId: number) => {
        setDeleteConfirm(deleteConfirm === reviewId ? null : reviewId);
    };

    const handleDeleteConfirm = async (reviewId: number) => {
        if (!id) return;
        setSubmitting(true);
        try {
            await deleteStoreReview(id, reviewId);
            setDeleteConfirm(null);
            if (editingReview?.id === reviewId) handleCancelEdit();
            await refreshReviewData();
        } catch (err: any) {
            showToast("error", err?.response?.data?.message ?? "Xóa đánh giá thất bại");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="cafe-theme">
                <CafeHeader />
                <main style={{ padding: 48, textAlign: "center", color: "var(--cafe-text-muted)" }}>
                    Đang tải thông tin cửa hàng...
                </main>
            </div>
        );
    }

    if (!store) {
        return (
            <div className="cafe-theme">
                <CafeHeader />
                <main style={{ padding: 48, textAlign: "center", color: "var(--cafe-text-muted)" }}>
                    Không tìm thấy cửa hàng
                </main>
            </div>
        );
    }

    const avg = reviewsData?.rating?.average ?? 0;
    const svcAvg = reviewsData?.rating?.serviceAverage ?? 0;
    const spaceAvg = reviewsData?.rating?.spaceAverage ?? 0;
    const foodAvg = reviewsData?.rating?.foodAverage ?? 0;
    const total = reviewsData?.rating?.totalReviews ?? 0;
    const allReviews = reviewsData?.reviews ?? [];
    const otherReviews = myReview ? allReviews.filter((r) => r.id !== myReview.id) : allReviews;
    const canCreateReview = isCustomer && hasCompletedOrderAtStore && !myReview;
    const canEditOrDelete = (r: StoreReview) =>
        isCustomer && r.user?.id != null && currentUserId != null && r.user.id === currentUserId;

    const heroBg = Array.isArray(store.images) && store.images[0]
        ? `linear-gradient(90deg, rgba(30,51,33,0.92) 0%, rgba(30,51,33,0.6) 50%, transparent 100%), url(${store.images[0]}) center/cover`
        : undefined;

    const reviewCardStyle: React.CSSProperties = {
        background: "#fff",
        border: "1px solid #ece3d8",
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 8px 24px rgba(92, 70, 53, 0.06)",
        marginBottom: 16,
    };

    const reviewHeaderStyle: React.CSSProperties = {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
    };

    const reviewUserBlockStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        minWidth: 0,
        flex: 1,
    };

    const reviewMetaStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
        flex: 1,
    };

    const reviewCommentStyle: React.CSSProperties = {
        margin: "14px 0 0",
        color: "var(--cafe-text)",
        lineHeight: 1.7,
        fontSize: "0.95rem",
        whiteSpace: "pre-wrap",
    };

    return (
        <div className="cafe-theme" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <CafeHeader />

            <main className="store-detail-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 48px", flex: 1 }}>
                <div
                    className={`store-hero ${heroBg ? "has-image" : ""}`}
                    style={heroBg ? { background: heroBg } : undefined}
                >
                    <div className="store-hero-content">
                        <h1 className="store-hero-title">{store.name}</h1>
                        <div className="store-meta-row">
                            <span className="store-badge">
                                <StarRating rating={avg} size={18} />
                                <span style={{ marginLeft: 4 }}>{avg.toFixed(1)}</span>
                            </span>

                            <span className="store-badge">{total} đánh giá</span>

                            {total > 0 && (
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        width: "100%",
                                    }}
                                >
                                    <span className="store-badge">Dịch vụ {svcAvg.toFixed(1)}</span>
                                    <span className="store-badge">Không gian {spaceAvg.toFixed(1)}</span>
                                    <span className="store-badge">Chất lượng món {foodAvg.toFixed(1)}</span>
                                </div>
                            )}

                            {openStatus !== null && (
                                <span className={`store-badge ${openStatus ? "open" : "closed"}`}>
                                    {openStatus ? "Đang mở cửa" : "Đã đóng cửa"}
                                </span>
                            )}
                        </div>
                        {store.busyness && (
                            <div className="store-busyness-row" style={{ marginTop: 10 }}>
                                <span
                                    className={`store-badge store-busyness-badge ${store.busyness.level === "busy" ? "busy" : "quiet"}`}
                                    title="Theo số đơn đã thanh toán/hoàn thành trong 30 phút gần nhất (từ lúc mở cửa hôm nay)"
                                >
                                    {store.busyness.title}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: 20, marginBottom: 24 }}>
                    <Link
                        to="/customer/order/menu"
                        state={{ storeId: Number(store.id), storeName: store.name }}
                        className="cafe-btn-primary"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "14px 28px",
                            fontSize: "1.1rem",
                            fontWeight: 600,
                            textDecoration: "none",
                            borderRadius: 12,
                            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.15)";
                        }}
                    >
                        <span>🛒</span>
                        Đặt món tại quán này
                    </Link>
                </div>

                <div className="store-map-info-row">
                    <section className="store-card">
                        <h2 className="store-card-title">Vị trí</h2>
                        <div className="store-map-wrap">
                            <iframe
                                src={mapUrl}
                                title="Vị trí cửa hàng"
                                width="100%"
                                height={260}
                                style={{ border: 0 }}
                                loading="lazy"
                                allowFullScreen
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                        <a
                            href={`https://www.google.com/maps?q=${store.lat ?? 0},${store.lng ?? 0}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="store-link-maps"
                        >
                            Mở Google Maps →
                        </a>
                    </section>

                    <section className="store-card">
                        <h2 className="store-card-title">Thông tin</h2>
                        <div className="store-info-row">
                            <span className="store-info-icon">📍</span>
                            <span>{store.address}</span>
                        </div>

                        {store.phone && (
                            <div className="store-info-row">
                                <span className="store-info-icon">📞</span>
                                <a href={`tel:${store.phone}`} style={{ color: "var(--cafe-brown)", textDecoration: "none" }}>
                                    {store.phone}
                                </a>
                            </div>
                        )}

                        {store.openHours && (
                            <div className="store-info-row">
                                <span className="store-info-icon">🕐</span>
                                <span>{store.openHours}</span>
                            </div>
                        )}
                    </section>
                </div>

                <div className="store-grid">
                    <div>
                        {store.description && (
                            <section className="store-card">
                                <h2 className="store-card-title">Giới thiệu</h2>
                                <p style={{ margin: 0, color: "var(--cafe-text)", lineHeight: 1.7 }}>
                                    {store.description}
                                </p>
                            </section>
                        )}

                        {Array.isArray(store.images) && store.images.length > 0 && (
                            <section className="store-card">
                                <h2 className="store-card-title">Hình ảnh</h2>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                                    {store.images.map((img: string, i: number) => (
                                        <img
                                            key={i}
                                            src={img}
                                            alt={`${store.name} ${i + 1}`}
                                            style={{
                                                width: "100%",
                                                borderRadius: 8,
                                                objectFit: "cover",
                                                aspectRatio: "1",
                                                cursor: "pointer",
                                            }}
                                            onClick={() => setImagePreviewUrl(img)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {myReview && (
                            <section className="store-card">
                                <h2 className="store-section-head">Đánh giá của bạn</h2>

                                <div className="store-review-card cafe-review-card" style={reviewCardStyle}>
                                    <div style={reviewHeaderStyle}>
                                        <div style={reviewUserBlockStyle}>
                                            <span
                                                className="store-review-avatar"
                                                style={{
                                                    width: 52,
                                                    height: 52,
                                                    minWidth: 52,
                                                    borderRadius: "50%",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    fontSize: "1.05rem",
                                                    fontWeight: 700,
                                                    background: "#8b6b4f",
                                                    color: "#fff",
                                                }}
                                            >
                                                {getInitial(customerDisplayName)}
                                            </span>

                                            <div style={reviewMetaStyle}>
                                                <strong
                                                    style={{
                                                        color: "var(--cafe-olive-dark)",
                                                        display: "block",
                                                        fontSize: "1.08rem",
                                                        lineHeight: 1.2,
                                                    }}
                                                >
                                                    {customerDisplayName}
                                                </strong>

                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                    <StarRating rating={myReview.rating} size={17} />
                                                    <span
                                                        style={{
                                                            fontSize: "0.92rem",
                                                            fontWeight: 700,
                                                            color: "#3d2f25",
                                                        }}
                                                    >
                                                        {myReview.rating.toFixed(1)}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: "0.82rem",
                                                            color: "var(--cafe-text-muted)",
                                                        }}
                                                    >
                                                        {getRatingLabel(myReview.rating)}
                                                    </span>
                                                </div>

                                                <ReviewCategoryChips
                                                    service={myReview.serviceRating ?? myReview.rating}
                                                    space={myReview.spaceRating ?? myReview.rating}
                                                    food={myReview.foodRating ?? myReview.rating}
                                                />
                                            </div>
                                        </div>

                                        <div className="store-action-btns" style={{ marginTop: 0 }}>
                                            {editingReview?.id !== myReview.id ? (
                                                <>
                                                    <button type="button" className="store-action-link" onClick={() => handleStartEdit(myReview)}>
                                                        Sửa
                                                    </button>
                                                    {deleteConfirm === myReview.id ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="store-action-link danger"
                                                                onClick={() => handleDeleteConfirm(myReview.id)}
                                                                disabled={submitting}
                                                            >
                                                                Xác nhận
                                                            </button>
                                                            <button type="button" className="store-action-link" onClick={() => setDeleteConfirm(null)}>
                                                                Hủy
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="store-action-link danger"
                                                            onClick={() => handleDeleteClick(myReview.id)}
                                                        >
                                                            Xóa
                                                        </button>
                                                    )}
                                                </>
                                            ) : null}
                                        </div>
                                    </div>

                                    {editingReview?.id === myReview.id ? (
                                        <div style={{ marginTop: 16 }}>
                                            <div style={{ marginBottom: 10 }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Dịch vụ</div>
                                                <StarRating
                                                    rating={editServiceRating}
                                                    setRating={(n) => {
                                                        setEditServiceRating(n);
                                                        syncOverallFromParts(n, editSpaceRating, editFoodRating, setEditRating);
                                                    }}
                                                    size={20}
                                                />
                                            </div>

                                            <div style={{ marginBottom: 10 }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Không gian</div>
                                                <StarRating
                                                    rating={editSpaceRating}
                                                    setRating={(n) => {
                                                        setEditSpaceRating(n);
                                                        syncOverallFromParts(editServiceRating, n, editFoodRating, setEditRating);
                                                    }}
                                                    size={20}
                                                />
                                            </div>

                                            <div style={{ marginBottom: 10 }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Chất lượng món</div>
                                                <StarRating
                                                    rating={editFoodRating}
                                                    setRating={(n) => {
                                                        setEditFoodRating(n);
                                                        syncOverallFromParts(editServiceRating, editSpaceRating, n, setEditRating);
                                                    }}
                                                    size={20}
                                                />
                                            </div>

                                            <div style={{ marginBottom: 10 }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Tổng thể</div>
                                                <StarRating rating={editRating} setRating={setEditRating} size={20} />
                                            </div>

                                            <textarea
                                                className="cafe-input"
                                                value={editComment}
                                                onChange={(e) => setEditComment(e.target.value)}
                                                style={{ width: "100%", minHeight: 80, marginTop: 10, boxSizing: "border-box" }}
                                            />

                                            {Array.isArray(editImages) && editImages.length > 0 && (
                                                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
                                                    {editImages.map((url) => (
                                                        <div key={url} style={{ position: "relative" }}>
                                                            <img
                                                                src={url}
                                                                alt="review"
                                                                style={{
                                                                    width: 116,
                                                                    height: 116,
                                                                    objectFit: "cover",
                                                                    borderRadius: 14,
                                                                    cursor: "pointer",
                                                                    border: "1px solid #ece3d8",
                                                                }}
                                                                onClick={() => setImagePreviewUrl(url)}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditImages((prev) => prev.filter((u) => u !== url))}
                                                                style={{
                                                                    position: "absolute",
                                                                    top: -6,
                                                                    right: -6,
                                                                    borderRadius: "50%",
                                                                    border: "none",
                                                                    width: 22,
                                                                    height: 22,
                                                                    background: "rgba(0,0,0,0.72)",
                                                                    color: "#fff",
                                                                    cursor: "pointer",
                                                                    fontSize: 11,
                                                                }}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={{ marginTop: 12 }}>
                                                <label style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)", display: "block", marginBottom: 4 }}>
                                                    Thêm ảnh (tối đa 10):
                                                </label>

                                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                    <label
                                                        className="cafe-btn-secondary"
                                                        style={{ cursor: "pointer", padding: "6px 14px", fontSize: "0.85rem" }}
                                                    >
                                                        Chọn ảnh
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            onChange={async (e) => {
                                                                const files = Array.from(e.target.files ?? []);
                                                                if (!files.length) return;
                                                                try {
                                                                    setUploadingEdit(true);
                                                                    const uploaded: string[] = [];
                                                                    for (const file of files) {
                                                                        const url = await uploadReviewImage(file);
                                                                        uploaded.push(url);
                                                                    }
                                                                    setEditImages((prev) => [...prev, ...uploaded].slice(0, 10));
                                                                } catch (err: any) {
                                                                    const msg = err?.message ?? "Upload ảnh thất bại. Vui lòng thử lại.";
                                                                    alert(msg);
                                                                } finally {
                                                                    setUploadingEdit(false);
                                                                    e.target.value = "";
                                                                }
                                                            }}
                                                            style={{ display: "none" }}
                                                        />
                                                    </label>

                                                    <span style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)" }}>
                                                        {editImages.length > 0 ? `${editImages.length} ảnh đã chọn` : "Không có tệp nào được chọn"}
                                                    </span>
                                                </div>

                                                {uploadingEdit && (
                                                    <p style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)", marginTop: 4 }}>
                                                        Đang upload ảnh...
                                                    </p>
                                                )}
                                            </div>

                                            <div className="store-action-btns" style={{ marginTop: 12 }}>
                                                <button className="cafe-btn-primary" onClick={handleSaveEdit} disabled={submitting}>
                                                    Lưu
                                                </button>
                                                <button className="cafe-btn-secondary" onClick={handleCancelEdit} disabled={submitting}>
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {myReview.comment && <p style={reviewCommentStyle}>{myReview.comment}</p>}

                                            {Array.isArray(myReview.images) && myReview.images.length > 0 && (
                                                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
                                                    {myReview.images.map((url) => (
                                                        <img
                                                            key={url}
                                                            src={url}
                                                            alt="review"
                                                            style={{
                                                                width: 116,
                                                                height: 116,
                                                                objectFit: "cover",
                                                                borderRadius: 14,
                                                                cursor: "pointer",
                                                                border: "1px solid #ece3d8",
                                                            }}
                                                            onClick={() => setImagePreviewUrl(url)}
                                                        />
                                                    ))}
                                                </div>
                                            )}

                                            <small
                                                style={{
                                                    color: "var(--cafe-text-muted)",
                                                    marginTop: 12,
                                                    display: "block",
                                                    fontSize: "0.82rem",
                                                }}
                                            >
                                                {formatReviewDate(myReview.createdAt)}
                                            </small>
                                        </>
                                    )}
                                </div>
                            </section>
                        )}

                        {!myReview && (
                            <section className="store-card">
                                <h2 className="store-section-head">Viết đánh giá</h2>

                                {reviewAccessLoading && isCustomer ? (
                                    <p style={{ fontSize: "0.9rem", color: "var(--cafe-text-muted)", marginBottom: 12 }}>
                                        Đang kiểm tra quyền đánh giá...
                                    </p>
                                ) : !isCustomer ? (
                                    <p style={{ fontSize: "0.9rem", color: "var(--cafe-text-muted)", marginBottom: 12 }}>
                                        Đăng nhập tài khoản khách hàng và từng mua hàng tại quán để gửi đánh giá.
                                    </p>
                                ) : !hasCompletedOrderAtStore ? (
                                    <p style={{ fontSize: "0.9rem", color: "var(--cafe-text-muted)", marginBottom: 12 }}>
                                        Chỉ khách hàng đã hoàn thành ít nhất một đơn tại cửa hàng này mới được đánh giá.
                                    </p>
                                ) : null}

                                {canCreateReview && (
                                <>
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Dịch vụ</div>
                                    <StarRating
                                        rating={serviceRating}
                                        setRating={(n) => {
                                            setServiceRating(n);
                                            syncOverallFromParts(n, spaceRating, foodRating, setRating);
                                        }}
                                        size={24}
                                    />
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Không gian</div>
                                    <StarRating
                                        rating={spaceRating}
                                        setRating={(n) => {
                                            setSpaceRating(n);
                                            syncOverallFromParts(serviceRating, n, foodRating, setRating);
                                        }}
                                        size={24}
                                    />
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Chất lượng món</div>
                                    <StarRating
                                        rating={foodRating}
                                        setRating={(n) => {
                                            setFoodRating(n);
                                            syncOverallFromParts(serviceRating, spaceRating, n, setRating);
                                        }}
                                        size={24}
                                    />
                                </div>

                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 4 }}>Tổng thể</div>
                                    <StarRating rating={rating} setRating={setRating} size={26} />
                                </div>

                                <textarea
                                    className="cafe-input store-form-textarea"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Chia sẻ trải nghiệm của bạn..."
                                    style={{ width: "100%", boxSizing: "border-box" }}
                                />

                                {newImages.length > 0 && (
                                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {newImages.map((url) => (
                                            <div key={url} style={{ position: "relative" }}>
                                                <img
                                                    src={url}
                                                    alt="review"
                                                    style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, cursor: "pointer" }}
                                                    onClick={() => setImagePreviewUrl(url)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setNewImages((prev) => prev.filter((u) => u !== url))}
                                                    style={{
                                                        position: "absolute",
                                                        top: -6,
                                                        right: -6,
                                                        borderRadius: "50%",
                                                        border: "none",
                                                        width: 20,
                                                        height: 20,
                                                        background: "rgba(0,0,0,0.7)",
                                                        color: "#fff",
                                                        cursor: "pointer",
                                                        fontSize: 10,
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ marginTop: 12 }}>
                                    <label style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)", display: "block", marginBottom: 4 }}>
                                        Thêm ảnh (tối đa 10):
                                    </label>

                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <label
                                            className="cafe-btn-secondary"
                                            style={{ cursor: "pointer", padding: "6px 14px", fontSize: "0.85rem" }}
                                        >
                                            Chọn ảnh
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={async (e) => {
                                                    const files = Array.from(e.target.files ?? []);
                                                    if (!files.length) return;
                                                    try {
                                                        setUploadingNew(true);
                                                        const uploaded: string[] = [];
                                                        for (const file of files) {
                                                            const url = await uploadReviewImage(file);
                                                            uploaded.push(url);
                                                        }
                                                        setNewImages((prev) => [...prev, ...uploaded].slice(0, 10));
                                                    } catch (err: any) {
                                                        const msg = err?.message ?? "Upload ảnh thất bại. Vui lòng thử lại.";
                                                        showToast("error", msg);
                                                    } finally {
                                                        setUploadingNew(false);
                                                        e.target.value = "";
                                                    }
                                                }}
                                                style={{ display: "none" }}
                                            />
                                        </label>

                                        <span style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)" }}>
                                            {newImages.length > 0 ? `${newImages.length} ảnh đã chọn` : "Không có tệp nào được chọn"}
                                        </span>
                                    </div>

                                    {uploadingNew && (
                                        <p style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)", marginTop: 4 }}>
                                            Đang upload ảnh...
                                        </p>
                                    )}
                                </div>

                                <button
                                    className="cafe-btn-primary"
                                    onClick={handleSubmitReview}
                                    disabled={submitting || uploadingNew}
                                    style={{ marginTop: 12 }}
                                >
                                    {submitting ? "Đang gửi..." : "Gửi đánh giá"}
                                </button>
                                </>
                                )}
                            </section>
                        )}

                        <section className="store-card">
                            <h2 className="store-section-head">Đánh giá gần đây</h2>

                            {otherReviews.length === 0 ? (
                                <p style={{ color: "var(--cafe-text-muted)", margin: 0, fontSize: "0.95rem" }}>
                                    Chưa có đánh giá nào. Hãy là người đầu tiên!
                                </p>
                            ) : (
                                <div>
                                    {otherReviews.map((r) => (
                                        <div key={r.id} className="store-review-card cafe-review-card" style={reviewCardStyle}>
                                            <div style={reviewHeaderStyle}>
                                                <div style={reviewUserBlockStyle}>
                                                    <span
                                                        className="store-review-avatar"
                                                        style={{
                                                            width: 52,
                                                            height: 52,
                                                            minWidth: 52,
                                                            borderRadius: "50%",
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: "1.05rem",
                                                            fontWeight: 700,
                                                            background: "#8b6b4f",
                                                            color: "#fff",
                                                        }}
                                                    >
                                                        {getInitial(r.user?.name ?? "G")}
                                                    </span>

                                                    <div style={reviewMetaStyle}>
                                                        <strong
                                                            style={{
                                                                color: "var(--cafe-olive-dark)",
                                                                display: "block",
                                                                fontSize: "1.08rem",
                                                                lineHeight: 1.2,
                                                            }}
                                                        >
                                                            {r.user?.name ?? "Guest"}
                                                        </strong>

                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                            <StarRating rating={r.rating} size={17} />
                                                            <span
                                                                style={{
                                                                    fontSize: "0.92rem",
                                                                    fontWeight: 700,
                                                                    color: "#3d2f25",
                                                                }}
                                                            >
                                                                {r.rating.toFixed(1)}
                                                            </span>
                                                            <span
                                                                style={{
                                                                    fontSize: "0.82rem",
                                                                    color: "var(--cafe-text-muted)",
                                                                }}
                                                            >
                                                                {getRatingLabel(r.rating)}
                                                            </span>
                                                        </div>

                                                        <ReviewCategoryChips
                                                            service={r.serviceRating ?? r.rating}
                                                            space={r.spaceRating ?? r.rating}
                                                            food={r.foodRating ?? r.rating}
                                                        />
                                                    </div>
                                                </div>

                                                {editingReview?.id !== r.id && canEditOrDelete(r) && (
                                                    <div className="store-action-btns" style={{ marginTop: 0 }}>
                                                        <button type="button" className="store-action-link" onClick={() => handleStartEdit(r)}>
                                                            Sửa
                                                        </button>
                                                        {deleteConfirm === r.id ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="store-action-link danger"
                                                                    onClick={() => handleDeleteConfirm(r.id)}
                                                                    disabled={submitting}
                                                                >
                                                                    Xác nhận
                                                                </button>
                                                                <button type="button" className="store-action-link" onClick={() => setDeleteConfirm(null)}>
                                                                    Hủy
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="store-action-link danger"
                                                                onClick={() => handleDeleteClick(r.id)}
                                                            >
                                                                Xóa
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {editingReview?.id === r.id ? (
                                                <div style={{ marginTop: 16 }}>
                                                    <div style={{ marginBottom: 10 }}>
                                                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Dịch vụ</div>
                                                        <StarRating
                                                            rating={editServiceRating}
                                                            setRating={(n) => {
                                                                setEditServiceRating(n);
                                                                syncOverallFromParts(n, editSpaceRating, editFoodRating, setEditRating);
                                                            }}
                                                            size={20}
                                                        />
                                                    </div>

                                                    <div style={{ marginBottom: 10 }}>
                                                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Không gian</div>
                                                        <StarRating
                                                            rating={editSpaceRating}
                                                            setRating={(n) => {
                                                                setEditSpaceRating(n);
                                                                syncOverallFromParts(editServiceRating, n, editFoodRating, setEditRating);
                                                            }}
                                                            size={20}
                                                        />
                                                    </div>

                                                    <div style={{ marginBottom: 10 }}>
                                                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Chất lượng món</div>
                                                        <StarRating
                                                            rating={editFoodRating}
                                                            setRating={(n) => {
                                                                setEditFoodRating(n);
                                                                syncOverallFromParts(editServiceRating, editSpaceRating, n, setEditRating);
                                                            }}
                                                            size={20}
                                                        />
                                                    </div>

                                                    <div style={{ marginBottom: 10 }}>
                                                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Tổng thể</div>
                                                        <StarRating rating={editRating} setRating={setEditRating} size={20} />
                                                    </div>

                                                    <textarea
                                                        className="cafe-input"
                                                        value={editComment}
                                                        onChange={(e) => setEditComment(e.target.value)}
                                                        style={{ width: "100%", minHeight: 80, marginTop: 10, boxSizing: "border-box" }}
                                                    />

                                                    {Array.isArray(editImages) && editImages.length > 0 && (
                                                        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
                                                            {editImages.map((url) => (
                                                                <div key={url} style={{ position: "relative" }}>
                                                                    <img
                                                                        src={url}
                                                                        alt="review"
                                                                        style={{
                                                                            width: 116,
                                                                            height: 116,
                                                                            objectFit: "cover",
                                                                            borderRadius: 14,
                                                                            cursor: "pointer",
                                                                            border: "1px solid #ece3d8",
                                                                        }}
                                                                        onClick={() => setImagePreviewUrl(url)}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditImages((prev) => prev.filter((u) => u !== url))}
                                                                        style={{
                                                                            position: "absolute",
                                                                            top: -6,
                                                                            right: -6,
                                                                            borderRadius: "50%",
                                                                            border: "none",
                                                                            width: 22,
                                                                            height: 22,
                                                                            background: "rgba(0,0,0,0.72)",
                                                                            color: "#fff",
                                                                            cursor: "pointer",
                                                                            fontSize: 11,
                                                                        }}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div style={{ marginTop: 12 }}>
                                                        <label style={{ fontSize: "0.85rem", color: "var(--cafe-text-muted)", display: "block", marginBottom: 4 }}>
                                                            Thêm ảnh (tối đa 10):
                                                        </label>

                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                            <label
                                                                className="cafe-btn-secondary"
                                                                style={{ cursor: "pointer", padding: "6px 14px", fontSize: "0.85rem" }}
                                                            >
                                                                Chọn ảnh
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    multiple
                                                                    onChange={async (e) => {
                                                                        const files = Array.from(e.target.files ?? []);
                                                                        if (!files.length) return;
                                                                        try {
                                                                            setUploadingEdit(true);
                                                                            const uploaded: string[] = [];
                                                                            for (const file of files) {
                                                                                const url = await uploadReviewImage(file);
                                                                                uploaded.push(url);
                                                                            }
                                                                            setEditImages((prev) => [...prev, ...uploaded].slice(0, 10));
                                                                        } catch (err: any) {
                                                                            const msg = err?.message ?? "Upload ảnh thất bại. Vui lòng thử lại.";
                                                                            alert(msg);
                                                                        } finally {
                                                                            setUploadingEdit(false);
                                                                            e.target.value = "";
                                                                        }
                                                                    }}
                                                                    style={{ display: "none" }}
                                                                />
                                                            </label>

                                                            <span style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)" }}>
                                                                {editImages.length > 0 ? `${editImages.length} ảnh đã chọn` : "Không có tệp nào được chọn"}
                                                            </span>
                                                        </div>

                                                        {uploadingEdit && (
                                                            <p style={{ fontSize: "0.8rem", color: "var(--cafe-text-muted)", marginTop: 4 }}>
                                                                Đang upload ảnh...
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="store-action-btns" style={{ marginTop: 12 }}>
                                                        <button className="cafe-btn-primary" onClick={handleSaveEdit} disabled={submitting}>
                                                            Lưu
                                                        </button>
                                                        <button className="cafe-btn-secondary" onClick={handleCancelEdit} disabled={submitting}>
                                                            Hủy
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    {r.comment && <p style={reviewCommentStyle}>{r.comment}</p>}

                                                    {Array.isArray(r.images) && r.images.length > 0 && (
                                                        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
                                                            {r.images.map((url) => (
                                                                <img
                                                                    key={url}
                                                                    src={url}
                                                                    alt="review"
                                                                    style={{
                                                                        width: 116,
                                                                        height: 116,
                                                                        objectFit: "cover",
                                                                        borderRadius: 14,
                                                                        cursor: "pointer",
                                                                        border: "1px solid #ece3d8",
                                                                    }}
                                                                    onClick={() => setImagePreviewUrl(url)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}

                                                    <small
                                                        style={{
                                                            color: "var(--cafe-text-muted)",
                                                            marginTop: 12,
                                                            display: "block",
                                                            fontSize: "0.82rem",
                                                        }}
                                                    >
                                                        {formatReviewDate(r.createdAt)}
                                                    </small>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </main>

            {imagePreviewUrl && (
                <div
                    onClick={() => setImagePreviewUrl(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.65)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: 16,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            maxWidth: "90vw",
                            maxHeight: "90vh",
                            position: "relative",
                        }}
                    >
                        <img
                            src={imagePreviewUrl}
                            alt="Xem ảnh"
                            style={{
                                maxWidth: "90vw",
                                maxHeight: "90vh",
                                borderRadius: 12,
                                boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
                                objectFit: "contain",
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setImagePreviewUrl(null)}
                            style={{
                                position: "absolute",
                                top: -12,
                                right: -12,
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                border: "none",
                                background: "rgba(0,0,0,0.8)",
                                color: "#fff",
                                cursor: "pointer",
                                fontSize: 16,
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <CafeFooter />
        </div>
    );
}

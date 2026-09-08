import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import CafeHeader from "../../../shared/components/CafeHeader";
import CafeFooter from "../../../shared/components/CafeFooter";
import ChatButton from "../../../shared/components/ChatButton";
import { useAuthStore } from "../../../app/store/auth.store";
import { memberApi } from "../../member/api/member.api";
import { getStoreLocations, type StoreLocation } from "../api/stores.api";
import { matchesVietnameseSearch, getStoreCity, getStoreDistrict, getStoreWard, normalizeVietnamese } from "../utils/vietnameseSearch";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const mapContainerStyle = { width: "100%", height: "400px", borderRadius: 16 };
const defaultCenter = { lat: 16.0544, lng: 108.2022 };
const defaultZoom = 6;

export default function StoreLocationsPage() {
  const user = useAuthStore((s) => s.user);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStore, setSelectedStore] = useState<StoreLocation | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState<string>(""); // "" = all, "my" = member city, or city name
  const [districtFilter, setDistrictFilter] = useState<string>("");
  const [wardFilter, setWardFilter] = useState<string>("");
  const [districtOpen, setDistrictOpen] = useState<boolean>(false);
  const [wardOpen, setWardOpen] = useState<boolean>(false);
  const [memberCity, setMemberCity] = useState<string>("");

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getStoreLocations();
        setStores(data);
      } catch (e: unknown) {
        setError((e as Error)?.message || "Không tải được danh sách cửa hàng");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user?.portal === "CUSTOMER" && user?.id) {
      memberApi.getProfile().then((res: { customer?: { city?: string } }) => {
        const city = res?.customer?.city?.trim() || "";
        setMemberCity(city);
      }).catch(() => { });
    }
  }, [user?.portal, user?.id]);

  const activeCityName = useMemo(() => {
    if (cityFilter === "my" && memberCity) {
      return memberCity;
    }
    if (cityFilter && cityFilter !== "my") {
      return cityFilter;
    }
    return "";
  }, [cityFilter, memberCity]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      const c = getStoreCity(s);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [stores]);

  const districts = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (activeCityName) {
        const storeCity = getStoreCity(s);
        if (normalizeVietnamese(storeCity) !== normalizeVietnamese(activeCityName)) return;
      }
      const d = getStoreDistrict(s);
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [stores, activeCityName]);

  const wards = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (activeCityName) {
        const storeCity = getStoreCity(s);
        if (normalizeVietnamese(storeCity) !== normalizeVietnamese(activeCityName)) return;
      }
      const w = getStoreWard(s);
      if (w) set.add(w);
    });
    return Array.from(set).sort();
  }, [stores, activeCityName]);

  useEffect(() => {
    // Khi đổi thành phố thì reset filter quận/huyện & phường/xã
    setDistrictFilter("");
    setWardFilter("");
    setDistrictOpen(false);
    setWardOpen(false);
  }, [cityFilter]);

  const filteredStores = useMemo(() => {
    let list = stores;
    if (cityFilter === "my" && memberCity) {
      list = list.filter((s) => matchesVietnameseSearch(getStoreCity(s), memberCity));
    } else if (cityFilter && cityFilter !== "my") {
      list = list.filter((s) => matchesVietnameseSearch(getStoreCity(s), cityFilter));
    }
    if (districtFilter.trim()) {
      const qDistrict = districtFilter.trim();
      list = list.filter((s) => matchesVietnameseSearch(getStoreDistrict(s), qDistrict));
    }
    if (wardFilter.trim()) {
      const qWard = wardFilter.trim();
      list = list.filter((s) => matchesVietnameseSearch(getStoreWard(s), qWard));
    }
    const q = searchQuery.trim();
    if (q) {
      list = list.filter(
        (s) =>
          matchesVietnameseSearch(s.name || "", q) ||
          matchesVietnameseSearch(s.address || "", q) ||
          matchesVietnameseSearch(s.city || "", q)
      );
    }
    return list;
  }, [stores, cityFilter, memberCity, searchQuery, districtFilter, wardFilter]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onMapUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const fitBounds = useCallback(() => {
    if (!map || filteredStores.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    filteredStores.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));

    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }, [map, filteredStores]);

  useEffect(() => {
    if (map && filteredStores.length > 0) fitBounds();
  }, [map, filteredStores, fitBounds]);

  if (loading) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <p style={{ color: "var(--cafe-text-muted)" }}>Đang tải vị trí cửa hàng...</p>
        </main>
        <CafeFooter />
        <ChatButton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <CafeHeader />
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            flexDirection: "column",
            gap: 16,
          }}
        >
          <p className="cafe-error">{error}</p>
          <Link to="/" className="cafe-link">
            ← Quay lại trang chủ
          </Link>
        </main>
        <CafeFooter />
        <ChatButton />
      </div>
    );
  }

  const showMap = isLoaded && !loadError && GOOGLE_MAPS_API_KEY;

  return (
    <div className="cafe-theme" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <CafeHeader />

      <section className="cafe-hero" style={{ padding: "40px 24px 36px" }}>
        <h1 className="cafe-hero-title" style={{ marginBottom: 12 }}>Vị trí cửa hàng</h1>
        <p className="cafe-hero-subtitle" style={{ maxWidth: 560 }}>
          Tìm cửa hàng kōhī coffee gần bạn. Ghé thăm và thưởng thức cà phê đặc sản tươi mỗi ngày.
        </p>
      </section>

      <main style={{ flex: 1, padding: "28px 20px 40px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        <div className="cafe-card-elevated store-search-filter" style={{ padding: "28px", marginBottom: 28 }}>
          <h2 className="cafe-section-heading" style={{ marginBottom: 20 }}>Tìm kiếm & Lọc</h2>
          <div className="store-search-filter-row">
            <div className="store-search-filter-field">
              <label className="store-search-filter-label" htmlFor="store-search">
                Tìm cửa hàng
              </label>
              <div className="store-search-wrap">
                <svg className="store-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  id="store-search"
                  type="text"
                  className="store-search-input"
                  placeholder="Tên, địa chỉ hoặc thành phố..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="store-search-filter-field">
              <label className="store-search-filter-label" htmlFor="store-city-filter">
                Thành phố
              </label>
              <select
                id="store-city-filter"
                className="store-filter-select"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              >
                <option value="">Tất cả thành phố</option>
                {memberCity && (
                  <option value="my">Thành phố của tôi ({memberCity})</option>
                )}
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="store-search-filter-field" style={{ position: "relative" }}>
              <label className="store-search-filter-label" htmlFor="store-district-filter">
                Quận / Huyện
              </label>
              <div className="store-search-wrap">
                <input
                  id="store-district-filter"
                  type="text"
                  className="store-search-input"
                  placeholder="Nhập quận/huyện..."
                  value={districtFilter}
                  onChange={(e) => {
                    setDistrictFilter(e.target.value);
                    setDistrictOpen(true);
                  }}
                  onFocus={() => setDistrictOpen(true)}
                />
              </div>
              {districtOpen && districts.length > 0 && (
                <div
                  className="cafe-card"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    zIndex: 20,
                    maxHeight: 220,
                    overflowY: "auto",
                    padding: 0,
                  }}
                >
                  {districts
                    .filter((d) => matchesVietnameseSearch(d, districtFilter))
                    .map((d) => (
                      <button
                        key={d}
                        type="button"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 12px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                        onClick={() => {
                          setDistrictFilter(d);
                          setDistrictOpen(false);
                        }}
                      >
                        {d}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="store-search-filter-field" style={{ position: "relative" }}>
              <label className="store-search-filter-label" htmlFor="store-ward-filter">
                Phường / Xã
              </label>
              <div className="store-search-wrap">
                <input
                  id="store-ward-filter"
                  type="text"
                  className="store-search-input"
                  placeholder="Nhập phường/xã..."
                  value={wardFilter}
                  onChange={(e) => {
                    setWardFilter(e.target.value);
                    setWardOpen(true);
                  }}
                  onFocus={() => setWardOpen(true)}
                />
              </div>
              {wardOpen && wards.length > 0 && (
                <div
                  className="cafe-card"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    zIndex: 20,
                    maxHeight: 220,
                    overflowY: "auto",
                    padding: 0,
                  }}
                >
                  {wards
                    .filter((w) => matchesVietnameseSearch(w, wardFilter))
                    .map((w) => (
                      <button
                        key={w}
                        type="button"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 12px",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                        }}
                        onClick={() => {
                          setWardFilter(w);
                          setWardOpen(false);
                        }}
                      >
                        {w}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {showMap && (
          <div className="cafe-card-elevated" style={{ padding: 0, overflow: "hidden", marginBottom: 32 }}>
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--cafe-cream-dark)" }}>
              <h2 className="cafe-section-heading" style={{ margin: 0 }}>
                Bản đồ
              </h2>
            </div>

            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={defaultZoom}
              onLoad={onMapLoad}
              onUnmount={onMapUnmount}
              options={{
                styles: [
                  {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }],
                  },
                ],
              }}
            >
              {filteredStores.map((store) => (
                <Marker
                  key={store.id}
                  position={{ lat: store.lat, lng: store.lng }}
                  onClick={() => setSelectedStore(store)}
                />
              ))}

              {selectedStore && (
                <InfoWindow
                  position={{ lat: selectedStore.lat, lng: selectedStore.lng }}
                  onCloseClick={() => setSelectedStore(null)}
                >
                  <div style={{ padding: 8, minWidth: 200 }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: "1rem", color: "#2d3b2d" }}>
                      {selectedStore.name}
                    </h3>

                    <p style={{ margin: "0 0 4px", fontSize: "0.85rem", color: "#555" }}>
                      {selectedStore.address}, {selectedStore.city}
                    </p>

                    {selectedStore.phone && (
                      <p style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
                        📞 {selectedStore.phone}
                      </p>
                    )}

                    {selectedStore.openHours && (
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
                        🕐 {selectedStore.openHours}
                      </p>
                    )}

                    <Link
                      to={`/stores/${selectedStore.id}`}
                      style={{
                        fontSize: "0.85rem",
                        display: "inline-block",
                        marginTop: 8,
                        color: "#6b5344",
                        fontWeight: 600,
                      }}
                    >
                      Xem chi tiết →
                    </Link>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </div>
        )}

        <div className="cafe-card-elevated" style={{ padding: 32 }}>
          <h2 className="cafe-section-heading" style={{ marginBottom: 24 }}>
            Danh sách cửa hàng
            {filteredStores.length !== stores.length && (
              <span style={{ fontWeight: 400, fontSize: "0.9rem", color: "var(--cafe-text-muted)", marginLeft: 8 }}>
                ({filteredStores.length} / {stores.length})
              </span>
            )}
          </h2>

          {filteredStores.length === 0 ? (
            <p style={{ color: "var(--cafe-text-muted)", margin: 0 }}>
              Không tìm thấy cửa hàng phù hợp.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {filteredStores.map((store) => (
                <div
                  key={store.id}
                  className="cafe-store-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          margin: "0 0 8px",
                          fontSize: "1.1rem",
                          color: "var(--cafe-olive-dark)",
                        }}
                      >
                        {store.name}
                      </h3>

                      <p
                        style={{
                          margin: "0 0 4px",
                          fontSize: "0.95rem",
                          color: "var(--cafe-text-muted)",
                        }}
                      >
                        {store.address}, {store.city}
                      </p>

                      {store.phone && (
                        <p style={{ margin: "0 0 4px", fontSize: "0.9rem" }}>
                          📞 {store.phone}
                        </p>
                      )}

                      {store.openHours && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.85rem",
                            color: "var(--cafe-text-muted)",
                          }}
                        >
                          🕐 {store.openHours}
                        </p>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                      <Link
                        to="/customer/order/menu"
                        state={{ storeId: Number(store.id), storeName: store.name }}
                        className="cafe-btn-primary"
                        style={{
                          display: "block",
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          textDecoration: "none",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Đặt món tại quán này
                      </Link>
                      <Link
                        to={`/stores/${store.id}`}
                        className="cafe-btn-secondary"
                        style={{
                          display: "block",
                          padding: "6px 12px",
                          fontSize: "0.8rem",
                          textDecoration: "none",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <CafeFooter />
      <ChatButton />
    </div>
  );
}
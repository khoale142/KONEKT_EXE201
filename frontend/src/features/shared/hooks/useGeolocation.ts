/**
 * Lấy vị trí hiện tại từ trình duyệt.
 * Dùng cho check-in / check-out chấm công.
 */
export type GeolocationResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; error: string };

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

export function getCurrentPosition(): Promise<GeolocationResult> {
  if (!navigator.geolocation) {
    return Promise.resolve({
      ok: false,
      error: "Trình duyệt không hỗ trợ định vị. Vui lòng dùng thiết bị có GPS.",
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          resolve({
            ok: false,
            error: "Không lấy được tọa độ hợp lệ.",
          });
          return;
        }
        resolve({ ok: true, latitude: lat, longitude: lng });
      },
      (err) => {
        let msg = "Không lấy được vị trí.";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg = "Bạn đã từ chối quyền truy cập vị trí. Vui lòng bật trong cài đặt trình duyệt để check-in.";
            break;
          case err.POSITION_UNAVAILABLE:
            msg = "Vị trí tạm thời không khả dụng. Vui lòng thử lại.";
            break;
          case err.TIMEOUT:
            msg = "Hết thời gian chờ định vị. Vui lòng thử lại.";
            break;
        }
        resolve({ ok: false, error: msg });
      },
      DEFAULT_OPTIONS
    );
  });
}

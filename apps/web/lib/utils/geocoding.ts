/**
 * Tiện ích Geocoding & Reverse Geocoding miễn phí sử dụng Photon (OSM) & Nominatim fallback.
 * Phục vụ định vị bản đồ và đồng bộ địa chỉ hai chiều.
 */

export interface GeocodingResult {
  coordinates: [number, number]; // [lat, lng]
  displayName: string;
}

/** Tách địa chỉ chính và ghi chú mở ngoặc `(*...)` */
export function extractAddressAndNote(raw: string): { address: string; note: string | null } {
  const match = raw.match(/\(\*([^*)]*)\)/);
  const note = match?.[1] ? match[1].trim() : null;
  const address = raw.replace(/\(\*.*?\)/g, '').trim();
  return { address, note };
}

/** Geocode: Nhập địa chỉ -> Tìm tọa độ [lat, lng] */
export async function geocodeAddress(rawAddress: string): Promise<[number, number] | null> {
  const { address } = extractAddressAndNote(rawAddress);
  if (!address || address.length < 3) return null;

  // 1. Thử Photon (OpenStreetMap - Komoot)
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const coords = data.features?.[0]?.geometry?.coordinates;
      if (
        Array.isArray(coords) &&
        coords.length >= 2 &&
        typeof coords[0] === 'number' &&
        typeof coords[1] === 'number'
      ) {
        // Photon trả về [lng, lat] -> đổi sang [lat, lng]
        return [coords[1], coords[0]];
      }
    }
  } catch {
    // Bỏ qua lỗi mạng, thử fallback
  }

  // 2. Fallback Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=vn&accept-language=vi`;
    const res = await fetch(url, { headers: { 'User-Agent': 'BookSportsCourt/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    }
  } catch {
    // Bỏ qua
  }

  return null;
}

/** Reverse Geocode: Cắm ghim [lat, lng] -> Tự động tìm địa chỉ tiếng Việt */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // 1. Thử Photon reverse trước
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const p = data.features?.[0]?.properties;
      if (p) {
        const streetPart = p.housenumber && p.street
          ? `${p.housenumber} ${p.street}`
          : p.street || p.name || '';
        const parts = [
          streetPart,
          p.locality,
          p.district,
          p.city,
        ].filter(Boolean);

        if (parts.length > 0) {
          return parts.join(', ');
        }
      }
    }
  } catch {
    // Thử fallback
  }

  // 2. Fallback Nominatim reverse
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`;
    const res = await fetch(url, { headers: { 'User-Agent': 'BookSportsCourt/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data?.display_name) {
        return data.display_name;
      }
    }
  } catch {
    // Bỏ qua
  }

  return null;
}

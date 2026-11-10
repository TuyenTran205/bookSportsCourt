import { PROVINCES, matchUnaccent, type Province, type Ward } from '@bsc/shared';

/**
 * Tiện ích Geocoding & Reverse Geocoding miễn phí sử dụng Photon (OSM) & Nominatim fallback.
 * Phục vụ định vị bản đồ và đồng bộ địa chỉ hai chiều.
 */

export interface GeocodingResult {
  coordinates: [number, number]; // [lat, lng]
  displayName: string;
}

export interface ReverseGeocodeDetails {
  formattedAddress: string;
  city?: string;
  district?: string;
  locality?: string;
  street?: string;
}

/** Bảng tọa độ trung tâm của 34 Tỉnh / Thành phố Việt Nam */
export const PROVINCE_COORDINATES: Record<string, [number, number]> = {
  '01': [21.0285, 105.8542], // Hà Nội
  '02': [22.8233, 104.9839], // Hà Giang
  '04': [22.6657, 106.2625], // Cao Bằng
  '08': [21.8233, 105.218],  // Tuyên Quang
  '19': [21.5928, 105.8442], // Thái Nguyên
  '20': [21.8537, 106.7618], // Lạng Sơn
  '22': [21.0069, 107.2925], // Quảng Ninh
  '24': [21.2731, 106.1946], // Bắc Giang
  '25': [21.3228, 105.228],  // Phú Thọ
  '26': [21.3089, 105.6049], // Vĩnh Phúc
  '27': [21.1861, 106.0763], // Bắc Ninh
  '30': [20.9398, 106.3308], // Hải Dương
  '31': [20.8449, 106.6881], // Hải Phòng
  '33': [20.6464, 106.0511], // Hưng Yên
  '34': [20.4463, 106.3366], // Thái Bình
  '35': [20.5453, 105.9122], // Hà Nam
  '36': [20.4344, 106.1777], // Nam Định
  '37': [20.2506, 105.9745], // Ninh Bình
  '38': [19.8067, 105.7852], // Thanh Hóa
  '40': [18.6734, 105.6813], // Nghệ An
  '42': [18.356, 105.9058],  // Hà Tĩnh
  '44': [17.4761, 106.6],    // Quảng Bình
  '45': [16.8167, 107.1],    // Quảng Trị
  '46': [16.4637, 107.5909], // Huế
  '48': [16.0471, 108.2068], // Đà Nẵng
  '49': [15.5667, 108.4833], // Quảng Nam
  '51': [15.1205, 108.7923], // Quảng Ngãi
  '52': [13.783, 109.2197],  // Bình Định
  '56': [12.2388, 109.1967], // Khánh Hòa
  '68': [11.9404, 108.4583], // Lâm Đồng
  '74': [11.1606, 106.6576], // Bình Dương
  '77': [10.4114, 107.1362], // Bà Rịa - Vũng Tàu
  '79': [10.7769, 106.7008], // TP. Hồ Chí Minh
  '92': [10.0452, 105.7469], // Cần Thơ
};

export function getProvinceCenter(code?: string): [number, number] {
  if (code && PROVINCE_COORDINATES[code]) {
    return PROVINCE_COORDINATES[code];
  }
  return [10.7769, 106.7008];
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

/** Reverse Geocode chi tiết: Cắm ghim [lat, lng] -> Lấy địa chỉ, tỉnh, huyện, xã */
export async function reverseGeocodeDetails(lat: number, lng: number): Promise<ReverseGeocodeDetails | null> {
  // 1. Thử Photon reverse trước
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const data = await res.json();
      const p = data.features?.[0]?.properties;
      if (p) {
        const streetPart = p.housenumber && p.street
          ? `${p.housenumber} ${p.street}`
          : p.street || p.name || '';
        const rawParts = [
          streetPart,
          p.locality,
          p.district,
          p.city,
          p.state,
        ].filter(Boolean);

        const uniqueParts = rawParts.filter((item, index) => rawParts.indexOf(item) === index);
        const formattedAddress = uniqueParts.join(', ');

        return {
          formattedAddress: formattedAddress || (p.name ?? ''),
          city: p.state || p.city || undefined,
          district: p.district || undefined,
          locality: p.locality || undefined,
          street: streetPart || undefined,
        };
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
        const addr = data.address || {};
        return {
          formattedAddress: data.display_name,
          city: addr.city || addr.state || addr.province || undefined,
          district: addr.district || addr.county || undefined,
          locality: addr.suburb || addr.ward || addr.quarter || addr.village || undefined,
          street: addr.road || undefined,
        };
      }
    }
  } catch {
    // Bỏ qua
  }

  return null;
}

/** Reverse Geocode: Cắm ghim [lat, lng] -> Tự động tìm địa chỉ tiếng Việt */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const details = await reverseGeocodeDetails(lat, lng);
  return details?.formattedAddress ?? null;
}

/** Tự động đối soát tên Tỉnh/Thành phố từ kết quả Reverse Geocode sang Province */
export function matchProvinceFromLocation(details: ReverseGeocodeDetails): Province | null {
  const candidateNames = [
    details.city,
    details.formattedAddress,
  ].filter(Boolean) as string[];

  for (const text of candidateNames) {
    const cleanText = text.toLowerCase().replace(/^(thành phố|thanh pho|tp\.?|tỉnh|tinh)\s*/gi, '').trim();

    for (const p of PROVINCES) {
      const pClean = p.name.toLowerCase().replace(/^(thành phố|thanh pho|tp\.?|tỉnh|tinh)\s*/gi, '').trim();
      if (
        cleanText.includes(pClean) ||
        pClean.includes(cleanText) ||
        matchUnaccent(cleanText, pClean) ||
        matchUnaccent(pClean, cleanText)
      ) {
        return p;
      }
    }
  }
  return null;
}

/** Tự động đối soát tên Xã/Phường từ kết quả Reverse Geocode sang Ward */
export function matchWardFromLocation(wards: Ward[], details: ReverseGeocodeDetails): Ward | null {
  if (!wards.length) return null;

  const candidateKeywords = [
    details.locality,
    details.district,
    details.street,
  ].filter(Boolean) as string[];

  for (const kw of candidateKeywords) {
    const cleanKw = kw.toLowerCase().replace(/^(phường|phuong|xã|xa|thị trấn|thi tran)\s*/gi, '').trim();
    if (cleanKw.length < 2) continue;

    for (const w of wards) {
      const wClean = w.name.toLowerCase().replace(/^(phường|phuong|xã|xa|thị trấn|thi tran)\s*/gi, '').trim();
      if (
        wClean === cleanKw ||
        matchUnaccent(cleanKw, wClean) ||
        matchUnaccent(wClean, cleanKw)
      ) {
        return w;
      }
    }
  }

  const fullAddress = details.formattedAddress.toLowerCase();
  for (const w of wards) {
    const wClean = w.name.toLowerCase().replace(/^(phường|phuong|xã|xa|thị trấn|thi tran)\s*/gi, '').trim();
    if (wClean.length >= 3 && matchUnaccent(fullAddress, wClean)) {
      return w;
    }
  }

  return null;
}

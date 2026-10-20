/**
 * Định nghĩa kiểu dữ liệu cho hệ thống bản đồ tự phục hồi tile (SPEC-MAP-002)
 */

/** Danh sách định danh các nhà cung cấp tile bản đồ được hỗ trợ */
export type MapProviderId =
  | 'carto-voyager'
  | 'esri-world-street'
  | 'osm-france-hot'
  | 'opentopomap'
  | 'osm-standard'
  | 'maptiler-streets'
  | 'stadia-smooth'
  | 'geoapify-osm-bright'
  | 'thunderforest-transport';

/** Cấu hình chi tiết của một nhà cung cấp tile */
export interface TileProviderConfig {
  /** Định danh duy nhất */
  id: MapProviderId;
  /** Tên kỹ thuật / hiển thị */
  name: string;
  /** Nhãn thân thiện cho người dùng */
  label?: string;
  /** Mẫu URL tile có chứa {z}/{x}/{y} và các tham số {s}, {r}, {apiKey} nếu có */
  url: string;
  /** Chuỗi HTML ghi nhận quyền tác giả bắt buộc */
  attribution: string;
  /** Danh sách tên miền con cân bằng tải (ví dụ ['a', 'b', 'c', 'd']) */
  subdomains?: string[] | string;
  /** Độ phóng đại tối đa mà bản đồ cho phép */
  maxZoom: number;
  /** Độ phóng đại tối đa thực tế của máy chủ tile (Leaflet tự co phóng khi zoom sâu hơn) */
  maxNativeZoom: number;
  /** Độ phóng đại tối thiểu */
  minZoom?: number;
  /** Có bắt buộc API key hay không */
  requiresKey: boolean;
  /** Tên biến môi trường NEXT_PUBLIC_* chứa API key */
  keyEnvVar?: string;
  /** Điểm ưu tiên cơ bản (số càng nhỏ độ ưu tiên càng cao) */
  priority: number;
  /** Cờ hỗ trợ màn hình độ phân giải cao retina (@2x) */
  supportsRetina?: boolean;
}

/** Bí danh tương thích cho cấu hình nhà cung cấp tile */
export type TileProvider = TileProviderConfig;

/** Trạng thái vòng đời tải tile của bản đồ */
export type MapResilienceStatus = 'loading' | 'ready' | 'degraded' | 'failed';

/** Trạng thái phục hồi và chuyển đổi của lớp bản đồ */
export interface MapResilienceState {
  /** Vị trí index của provider đang sử dụng trong danh sách khả dụng */
  currentProviderIndex: number;
  /** Bí danh tương thích cho vị trí index hiện tại */
  providerIndex: number;
  /** Thông tin nhà cung cấp tile đang hoạt động */
  activeProvider: TileProviderConfig;
  /** Danh sách tất cả nhà cung cấp khả dụng sau khi lọc key */
  availableProviders: TileProviderConfig[];
  /** Tổng số lỗi tile ghi nhận trên provider hiện tại trong cửa sổ trượt */
  errorCount: number;
  /** Đang trong tiến trình chuyển đổi sang provider dự phòng */
  isSwitching: boolean;
  /** Toàn bộ danh sách provider đều đã thất bại */
  isAllFailed: boolean;
  /** Trạng thái tổng thể của hệ thống tile */
  status: MapResilienceStatus;
  /** Thông báo lỗi hoặc thông điệp trạng thái chi tiết */
  statusMessage: string | null;
}

/** Các hàm tương tác và phục hồi lỗi */
export interface MapResilienceActions {
  /** Đổi thủ công sang nhà cung cấp tiếp theo */
  switchToNextProvider: () => void;
  /** Thử lại từ đầu với nhà cung cấp ưu tiên số 1 */
  retryFromStart: () => void;
  /** Bí danh tương thích cho thao tác thử lại từ đầu */
  retry: () => void;
  /** Báo cáo một tile bị tải hỏng từ sự kiện tileerror */
  reportTileError: () => void;
  /** Báo cáo một tile tải thành công từ sự kiện tileload */
  reportTileSuccess: () => void;
  /** Bí danh tương thích cho báo cáo tile tải thành công */
  reportTileLoad: () => void;
}

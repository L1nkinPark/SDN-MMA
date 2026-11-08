import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { latitudeError, longitudeError, parseDecimal } from '../utils/validation';
import { Button, TextField } from './ui';

const CAMPUS: L.LatLngExpression = [10.8411, 106.8098];
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const FALLBACK_TILE_URL = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';

type LocationPickerProps = {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
  disabled?: boolean;
  error?: string | null;
};

function position(latitude: string, longitude: string): L.LatLngExpression | null {
  if (latitudeError(latitude) || longitudeError(longitude)) return null;
  return [parseDecimal(latitude) as number, parseDecimal(longitude) as number];
}

/** Shared location control for new places and merchant change requests. */
export function LocationPicker({ latitude, longitude, onChange, disabled, error }: LocationPickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const currentOnChange = useRef(onChange);
  const currentDisabled = useRef(disabled);
  const [locationError, setLocationError] = useState<string | null>(null);
  const hasSelected = position(latitude, longitude) !== null;

  useEffect(() => {
    currentOnChange.current = onChange;
    currentDisabled.current = disabled;
  }, [onChange, disabled]);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(CAMPUS, 15);
    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    if (!import.meta.env.VITE_MAP_TILE_URL) {
      tiles.once('tileerror', () => tiles.setUrl(FALLBACK_TILE_URL));
    }
    instance.on('click', (event: L.LeafletMouseEvent) => {
      if (currentDisabled.current) return;
      currentOnChange.current(event.latlng.lat.toFixed(6), event.latlng.lng.toFixed(6));
      setLocationError(null);
    });
    map.current = instance;
    return () => {
      map.current = null;
      marker.current = null;
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const selected = position(latitude, longitude);
    if (!selected) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) {
      marker.current.setLatLng(selected);
    } else {
      marker.current = L.marker(selected, {
        draggable: !disabled,
        icon: L.divIcon({ className: 'location-picker__pin', iconSize: [28, 28], iconAnchor: [14, 28] }),
      }).addTo(map.current);
      marker.current.on('dragend', () => {
        const point = marker.current?.getLatLng();
        if (point && !currentDisabled.current) currentOnChange.current(point.lat.toFixed(6), point.lng.toFixed(6));
      });
      map.current.setView(selected, 17);
    }
    marker.current.dragging?.[disabled ? 'disable' : 'enable']();
  }, [latitude, longitude, disabled]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt này không hỗ trợ lấy vị trí. Hãy chạm vào bản đồ để đặt ghim.');
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point: L.LatLngExpression = [coords.latitude, coords.longitude];
        map.current?.setView(point, 17);
        currentOnChange.current(coords.latitude.toFixed(6), coords.longitude.toFixed(6));
      },
      () => setLocationError('Không lấy được vị trí. Hãy cho phép quyền vị trí hoặc chạm vào bản đồ để đặt ghim.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  return (
    <div className="location-picker form-grid__wide">
      <div className="location-picker__heading">
        <div>
          <strong>Vị trí quán trên bản đồ</strong>
          <p className="field__hint">Chạm vào vị trí quán để đặt ghim. Có thể kéo ghim để chỉnh lại.</p>
        </div>
        <Button type="button" variant="secondary" size="small" onClick={useCurrentLocation} disabled={disabled}>
          Dùng vị trí hiện tại
        </Button>
      </div>
      <div ref={container} className="location-picker__map" aria-label="Bản đồ chọn vị trí quán" />
      {hasSelected ? (
        <p className="field__hint" role="status">Đã chọn vị trí quán. Hãy kiểm tra ghim đúng ở cửa hàng trước khi gửi.</p>
      ) : (
        <p className="field__hint">Chưa chọn vị trí. Bản đồ đang mở gần Đại học FPT, Khu Công nghệ cao.</p>
      )}
      {error || locationError ? <p className="field__error" role="alert">{error || locationError}</p> : null}
      <details className="location-picker__manual">
        <summary>Nhập tọa độ thủ công (tùy chọn)</summary>
        <div className="form-grid">
          <TextField label="Vĩ độ" inputMode="decimal" value={latitude} onChange={(event) => onChange(event.target.value, longitude)} disabled={disabled} />
          <TextField label="Kinh độ" inputMode="decimal" value={longitude} onChange={(event) => onChange(latitude, event.target.value)} disabled={disabled} />
        </div>
      </details>
    </div>
  );
}

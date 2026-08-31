"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { confirmedLabel, groupByCoord, type Stall } from "@/lib/map-view";
import type { Bbox } from "@/lib/geo";

/**
 * Leaflet 실물. `window`를 참조하므로 이 파일은 클라이언트에서만 로드된다
 * (`MapView.tsx`가 dynamic import로 감싼다).
 *
 * ⚠️ 마커를 `Marker`가 아니라 `CircleMarker`로 그린다.
 *   1. Leaflet 기본 아이콘은 번들러에서 이미지 경로가 깨진다
 *   2. Canvas 렌더라 마커가 많아져도 가볍다
 *   3. **원이 "대략적인 구역"이라는 뜻을 더 정직하게 전한다** — 좌표가 11m 흐려져 있어서
 *      뾰족한 핀은 정확한 지점을 가리키는 것처럼 오해를 준다
 */

/**
 * ⚠️ `{s}` 서브도메인(`a.`/`b.`/`c.`)을 넣지 않는다. OSM은 더 이상 쓰지 않고,
 *   넣으면 경로가 `/a/16/...`가 되어 **400이 떨어져 지도가 회색으로 남는다**(실측 2026-08-31).
 * 환경변수로 뺀 이유: OSM 기본 타일은 SLA가 없고 트래픽이 많으면 차단된다.
 * 차단되면 URL 하나만 바꿔 다른 제공자로 옮길 수 있어야 한다.
 */
const TILE_URL =
  process.env.NEXT_PUBLIC_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

function BoundsWatcher({ onMove }: { onMove: (b: Bbox) => void }) {
  const map = useMapEvents({
    moveend: () => emit(),
    zoomend: () => emit(),
  });
  function emit() {
    const b = map.getBounds();
    onMove({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  }
  // ⚠️ 첫 진입에는 moveend가 안 난다 — 사용자가 지도를 움직이기 전까지 조회가 없어
  //    마커가 하나도 안 뜬다(실측 2026-08-31). 마운트 때 한 번 직접 부른다.
  useEffect(() => {
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/**
 * 위치를 받으면 그쪽으로 한 번 옮긴다.
 * ⚠️ `MapContainer`의 `center` prop은 최초 1회만 쓰인다 — 나중에 바꿔도 지도가 안 움직인다.
 *    그래서 `useMap().setView`로 명령한다.
 */
function MoveTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (!pos || done.current) return;
    done.current = true;
    map.setView(pos, map.getZoom());
  }, [pos, map]);
  return null;
}

export default function Map({
  center,
  moveTo,
  stalls,
  onMove,
}: {
  center: LatLngExpression;
  moveTo: [number, number] | null;
  stalls: Stall[];
  onMove: (b: Bbox) => void;
}) {
  const groups = groupByCoord(stalls);

  return (
    <MapContainer center={center} zoom={16} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url={TILE_URL}
        // OSM 타일 정책상 attribution은 필수다.
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자'
        maxZoom={19}
      />
      <BoundsWatcher onMove={onMove} />
      <MoveTo pos={moveTo} />

      {groups.map((g) => (
        <CircleMarker
          key={g.key}
          center={[g.lat, g.lng]}
          radius={9}
          pathOptions={{ color: "#c2410c", fillColor: "#fb923c", fillOpacity: 0.7, weight: 2 }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              {g.stalls.length > 1 && (
                <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
                  이 주변 제보 {g.stalls.length}건
                </p>
              )}
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {g.stalls.map((s) => (
                  <li key={s.id} style={{ marginBottom: 6 }}>
                    <strong>{s.kinds.join(" · ")}</strong>
                    {s.name && <span> — {s.name}</span>}
                    <br />
                    <small style={{ color: "#666" }}>{confirmedLabel(s.lastConfirmedAt)}</small>
                  </li>
                ))}
              </ul>
              <small style={{ color: "#888", display: "block", marginTop: 6 }}>
                위치는 상인 보호를 위해 약 11m 단위로 흐려져 있어요.
              </small>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

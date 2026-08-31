"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { isTooWide, type Stall } from "@/lib/map-view";
import type { Bbox } from "@/lib/geo";

/**
 * 지도 화면의 상태를 쥔다. Leaflet 자체는 `Map.tsx`에 있다.
 *
 * ⚠️ `ssr: false`는 **Client Component 안에서만 동작한다** — Server Component인
 * `page.tsx`에서 직접 쓰면 안 된다. 그래서 이 파일이 한 겹 끼어 있다.
 * (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` 확인)
 */
const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <Centered>지도를 불러오는 중…</Centered>,
});

const SEOUL_CITY_HALL: [number, number] = [37.5665, 126.978];
const DEBOUNCE_MS = 300;

type Load =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; stalls: Stall[]; truncated: boolean }
  | { kind: "tooWide" }
  | { kind: "error" };

export default function MapView() {
  // 위치를 **기다리지 않고** 서울시청에서 시작한다. 권한 모달을 띄운 채 화면을
  // 멈춰두면 사용자가 결정을 미루는 동안 아무것도 못 본다(설계 리뷰 지적).
  // 위치가 오면 지도를 그쪽으로 옮긴다.
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [load, setLoad] = useState<Load>({ kind: "idle" });
  const [lastBbox, setLastBbox] = useState<Bbox | null>(null);

  // 오래된 응답이 새 응답을 덮어쓰지 못하게 한다. 지도를 빠르게 움직이면
  // 먼저 보낸 요청이 나중에 도착할 수 있다(설계 리뷰 지적).
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⚠️ effect 본문에서 동기적으로 setState를 부르지 않는다 (react-hooks/set-state-in-effect).
  //    거부·실패·미지원은 오류가 아니므로 아무것도 안 하면 서울시청에 그대로 있는다.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => {},
      { timeout: 5000 },
    );
  }, []);

  const fetchStalls = useCallback(async (bbox: Bbox) => {
    const mine = ++seq.current;
    setLoad({ kind: "loading" });
    try {
      const q = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const res = await fetch(`/api/stalls?bbox=${q}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (mine !== seq.current) return; // 낡은 응답은 버린다
      setLoad({ kind: "ok", stalls: body.data, truncated: body.meta.truncated });
    } catch {
      if (mine === seq.current) setLoad({ kind: "error" });
    }
  }, []);

  const onMove = useCallback(
    (bbox: Bbox) => {
      setLastBbox(bbox);
      if (timer.current) clearTimeout(timer.current);
      // 400을 받고 처리하는 대신 미리 막는다 — 줌아웃 상태로 지도를 움직일 때마다
      // 실패할 요청이 나가지 않는다.
      if (isTooWide(bbox)) return setLoad({ kind: "tooWide" });
      timer.current = setTimeout(() => fetchStalls(bbox), DEBOUNCE_MS);
    },
    [fetchStalls],
  );

  return (
    <div style={{ position: "relative", height: "100dvh", width: "100%" }}>
      <Map
        center={SEOUL_CITY_HALL}
        moveTo={userPos}
        stalls={load.kind === "ok" ? load.stalls : []}
        onMove={onMove}
      />
      <Banner load={load} onRetry={() => lastBbox && fetchStalls(lastBbox)} />
    </div>
  );
}

function Banner({ load, onRetry }: { load: Load; onRetry: () => void }) {
  const base: React.CSSProperties = {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000, // Leaflet 페인 위로
    background: "rgba(255,255,255,.95)",
    borderRadius: 999,
    padding: "8px 16px",
    boxShadow: "0 2px 8px rgba(0,0,0,.15)",
    fontSize: 14,
    maxWidth: "90%",
  };

  if (load.kind === "tooWide") return <div style={base}>지도를 더 확대해 주세요</div>;
  if (load.kind === "loading") return <div style={base}>노점을 찾는 중…</div>;
  if (load.kind === "error")
    return (
      <div style={base}>
        불러오지 못했어요{" "}
        <button
          onClick={onRetry}
          style={{
            marginLeft: 8,
            border: "1px solid #ddd",
            borderRadius: 999,
            padding: "2px 10px",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </div>
    );
  if (load.kind === "ok" && load.truncated)
    return <div style={base}>노점이 많아 일부만 표시돼요. 더 확대해 보세요</div>;
  if (load.kind === "ok" && load.stalls.length === 0)
    return <div style={base}>아직 제보가 없어요</div>;
  return null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100dvh",
        display: "grid",
        placeItems: "center",
        color: "#666",
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}

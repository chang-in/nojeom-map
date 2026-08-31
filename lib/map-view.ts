import type { Bbox } from "./geo";

export type Stall = {
  id: string;
  kinds: string[];
  name: string | null;
  lat: number;
  lng: number;
  lastConfirmedAt: string;
};

export type StallGroup = {
  key: string;
  lat: number;
  lng: number;
  stalls: Stall[];
};

/**
 * 같은 공개 좌표의 노점을 한 마커로 묶는다.
 *
 * `trunc(,4)`는 약 11m 격자라서 가까운 두 노점이 같은 칸에 들어간다.
 * 그러면 마커가 완전히 겹쳐 **뒤엣것을 클릭할 수 없다** — 우리 흐리기의 부작용이다.
 * 설계 리뷰(codex·agy)에서 둘 다 지적했다.
 *
 * ⚠️ 묶어도 좌표는 그대로 쓴다. 평균을 내면 원본에 없던 좌표가 생겨 격자가 흐트러진다.
 * ⚠️ spiderfy(핀을 원형으로 벌리기)는 쓰지 않는다 — 흐린 좌표를 각각 다른 실제 위치처럼
 *    보이게 만들어 정직하지 않다. 목록 팝업으로 보여준다.
 */
export function groupByCoord(stalls: Stall[]): StallGroup[] {
  const map = new Map<string, StallGroup>();
  for (const s of stalls) {
    const key = `${s.lat},${s.lng}`;
    const g = map.get(key);
    if (g) g.stalls.push(s);
    else map.set(key, { key, lat: s.lat, lng: s.lng, stalls: [s] });
  }
  return [...map.values()];
}

const DAY = 86_400_000;

/**
 * "언제 확인됐나"를 사람 말로.
 *
 * ⚠️ **"영업중"이라고 쓰지 않는다.** 실시간 영업 여부를 단정하면
 * 상인의 현재 위치를 알려주는 셈이 된다. 확인 시점만 말한다.
 */
export function confirmedLabel(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const days = Math.floor(diff / DAY);
  if (days <= 0) return "오늘 확인됨"; // 미래 시각이 와도 여기로 떨어진다
  if (days < 30) return `${days}일 전 확인됨`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전 확인됨`;
  return "오래된 제보";
}

const MAX_SPAN_DEG = 1;

/**
 * 요청을 보내기 전에 판정한다. 400을 받고 처리하는 것보다 낫다 —
 * 넓게 줌아웃한 상태에서 지도를 움직일 때마다 실패 요청이 나가지 않는다.
 * ⚠️ 기준은 `lib/geo.ts`의 `parseBbox`와 같아야 한다.
 */
export function isTooWide(b: Bbox): boolean {
  return b.east - b.west > MAX_SPAN_DEG || b.north - b.south > MAX_SPAN_DEG;
}

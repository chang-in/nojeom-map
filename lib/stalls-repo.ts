import type { Bbox } from "./geo";

/**
 * Supabase(PostgREST)에서 공개 노점을 읽는다.
 *
 * SDK를 안 쓰는 이유: 조회가 bbox 필터 + limit 하나뿐이라 fetch로 충분하고,
 * Node 18+에 fetch가 내장이다. 쿼리가 복잡해지면 그때 올린다.
 */

/** 한 요청이 DB를 다 긁어가지 못하게 하는 상한. */
export const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

/** 공개 뷰. 좌표가 이미 흐려져 있고 active만 들어 있다. */
const PUBLIC_VIEW = "stall_public";

export function parseLimit(raw: string | null): number {
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error("limit은 1 이상의 정수여야 한다");
  // 상한을 넘으면 거부가 아니라 자른다 — 거부하면 지도가 빈 화면이 된다.
  return Math.min(n, MAX_LIMIT);
}

/**
 * ⚠️ `stall`이 아니라 `stall_public`을 읽는다.
 * 정확한 좌표는 `stall`에만 있고, 여기를 잘못 쓰면 흐리기가 무의미해진다.
 */
export function buildStallsQuery(bbox: Bbox, limit: number): string {
  const p = new URLSearchParams({
    select: "id,kinds,name,lat,lng,last_confirmed_at",
    lng: `gte.${bbox.west}`,
    lat: `gte.${bbox.south}`,
    // ⚠️ 정렬을 반드시 건다. 없으면 Postgres가 주는 대로 나가고, 상한에서 잘릴 때
    //    화면 한쪽 구역이 통째로 비어 보인다 — 사용자는 "여긴 노점이 없나 보다" 한다.
    //    최근 확인순이면 잘려도 살아남는 쪽이 더 믿을 만한 정보다.
    order: "last_confirmed_at.desc",
    limit: String(limit),
  });
  // URLSearchParams는 같은 키를 두 번 못 넣으므로 나머지 두 변은 따로 붙인다.
  return `/${PUBLIC_VIEW}?${p}&lng=lte.${bbox.east}&lat=lte.${bbox.north}`;
}

export type PublicStallRow = {
  id: string;
  kinds: string[];
  name: string | null;
  lat: number;
  lng: number;
  last_confirmed_at: string;
};

export type StallsResponse = {
  data: {
    id: string;
    kinds: string[];
    name: string | null;
    lat: number;
    lng: number;
    lastConfirmedAt: string;
  }[];
  meta: { count: number; truncated: boolean };
};

/**
 * 응답을 `{ data, meta }`로 감싼다.
 *
 * 벌거벗은 배열이면 **500개가 진짜 전부인지 잘린 건지 클라이언트가 알 수 없다.**
 * 잘린 걸 모르면 지도 한쪽이 비어 보이는데 사용자는 "노점이 없구나" 한다.
 * 배열로 배포한 뒤 객체로 바꾸면 부르는 쪽을 전부 고쳐야 해서 **지금 정한다.**
 *
 * `rows`는 `limit + 1`개를 요청해서 받은 것이다 — 하나 더 왔으면 뒤에 더 있다는 뜻이다.
 * 별도 count 질의보다 싸다.
 */
export function toResponse(rows: PublicStallRow[], limit: number): StallsResponse {
  const truncated = rows.length > limit;
  const kept = truncated ? rows.slice(0, limit) : rows;
  return {
    data: kept.map((r) => ({
      id: r.id,
      kinds: r.kinds,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      lastConfirmedAt: r.last_confirmed_at,
    })),
    meta: { count: kept.length, truncated },
  };
}

export async function fetchStalls(bbox: Bbox, limit: number): Promise<PublicStallRow[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY가 없다");

  const res = await fetch(`${url}/rest/v1${buildStallsQuery(bbox, limit)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

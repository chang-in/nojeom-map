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

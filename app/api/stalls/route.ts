import { parseBbox } from "@/lib/geo";
import { fetchStalls, parseLimit, toResponse } from "@/lib/stalls-repo";

/**
 * GET /api/stalls?bbox=west,south,east,north&limit=100
 *   → { data: [...], meta: { count, truncated } }
 *
 * 좌표를 흐리는 일은 여기서 하지 않는다 — `stall_public` 뷰가 이미 했다.
 * 앱에서만 흐리면 anon 키로 우회되기 때문이다(실측 2026-08-31).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // 입력이 잘못된 것은 400이다. 500으로 새면 그건 버그다.
  let bbox, limit;
  try {
    const raw = params.get("bbox");
    if (!raw) throw new Error("bbox가 필요하다 (west,south,east,north)");
    bbox = parseBbox(raw);
    limit = parseLimit(params.get("limit"));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    // limit + 1개를 요청한다. 하나 더 오면 뒤에 더 있다는 뜻이라 truncated를 판정할 수 있다.
    const rows = await fetchStalls(bbox, limit + 1);
    return Response.json(toResponse(rows, limit));
  } catch (e) {
    // 원인 문자열은 내보내지 않는다 — 연결 정보가 새어 나갈 수 있다.
    console.error("[stalls] 조회 실패:", e);
    return Response.json({ error: "일시적으로 조회할 수 없다" }, { status: 500 });
  }
}

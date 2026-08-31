import { describe, it, expect } from "vitest";
import { buildStallsQuery, MAX_LIMIT, parseLimit } from "./stalls-repo";

describe("parseLimit — 한 요청이 DB를 다 긁어가지 못하게 한다", () => {
  it("안 주면 기본값", () => {
    expect(parseLimit(null)).toBe(100);
  });

  it("정상 범위는 그대로", () => {
    expect(parseLimit("50")).toBe(50);
  });

  it("상한을 넘으면 상한으로 자른다 — 거부가 아니라 자르기다", () => {
    // 거부하면 지도가 빈 화면이 된다. 자르면 일부라도 보인다.
    expect(parseLimit("99999")).toBe(MAX_LIMIT);
  });

  it("숫자가 아니거나 0 이하면 거부한다", () => {
    expect(() => parseLimit("abc")).toThrow();
    expect(() => parseLimit("0")).toThrow();
    expect(() => parseLimit("-5")).toThrow();
  });
});

describe("buildStallsQuery — bbox를 PostgREST 질의로 옮긴다", () => {
  const bbox = { west: 126.9, south: 37.5, east: 127.0, north: 37.6 };

  it("공개 뷰를 조회한다 — stall 테이블이 아니다", () => {
    // 정확한 좌표는 stall에만 있다. 여기를 잘못 쓰면 흐리기가 무의미해진다.
    expect(buildStallsQuery(bbox, 100)).toContain("stall_public");
    expect(buildStallsQuery(bbox, 100)).not.toContain("/stall?");
  });

  it("네 변을 모두 조건에 건다", () => {
    const q = buildStallsQuery(bbox, 100);
    expect(q).toContain("lng=gte.126.9");
    expect(q).toContain("lng=lte.127");
    expect(q).toContain("lat=gte.37.5");
    expect(q).toContain("lat=lte.37.6");
  });

  it("limit을 붙인다", () => {
    expect(buildStallsQuery(bbox, 42)).toContain("limit=42");
  });

  it("내부 필드는 요청하지 않는다", () => {
    const q = buildStallsQuery(bbox, 100);
    expect(q).not.toContain("status");
    expect(q).not.toContain("created_at");
  });

  it("최근 확인순으로 정렬한다 — 잘릴 때 무엇이 살아남는지 정해야 한다", () => {
    // 정렬이 없으면 Postgres가 주는 대로 나가고, 상한에서 잘릴 때
    // 화면 한쪽 구역이 통째로 비어 보인다("여긴 노점이 없나 보다").
    expect(buildStallsQuery(bbox, 100)).toContain("order=last_confirmed_at.desc");
  });
});

describe("toResponse — 잘렸는지 알 수 있어야 한다", () => {
  const row = (id: string) => ({
    id,
    kinds: ["붕어빵"],
    name: null,
    lat: 37.5,
    lng: 126.9,
    last_confirmed_at: "2026-08-31T00:00:00Z",
  });

  it("limit 이하면 truncated=false", async () => {
    const { toResponse } = await import("./stalls-repo");
    const r = toResponse([row("a"), row("b")], 10);
    expect(r.meta.truncated).toBe(false);
    expect(r.meta.count).toBe(2);
    expect(r.data).toHaveLength(2);
  });

  it("limit을 넘겨 받으면 잘라내고 truncated=true", async () => {
    // 판정을 위해 limit+1개를 요청한다. 하나 더 왔다는 건 뒤에 더 있다는 뜻이다.
    const { toResponse } = await import("./stalls-repo");
    const r = toResponse([row("a"), row("b"), row("c")], 2);
    expect(r.meta.truncated).toBe(true);
    expect(r.data).toHaveLength(2);
    expect(r.meta.count).toBe(2);
  });

  it("snake_case를 camelCase로 바꾼다", async () => {
    const { toResponse } = await import("./stalls-repo");
    const r = toResponse([row("a")], 10) as unknown as {
      data: Record<string, unknown>[];
    };
    expect(r.data[0].lastConfirmedAt).toBe("2026-08-31T00:00:00Z");
    expect(r.data[0].last_confirmed_at).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
});

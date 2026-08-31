import { describe, it, expect } from "vitest";
import { KINDS, validateStallInput, toPublicStall } from "./stall";

describe("validateStallInput — 제보를 받기 전에 판정한다", () => {
  const ok = { kinds: ["붕어빵"], lat: 37.5665, lng: 126.978 };

  it("최소 입력을 통과시킨다", () => {
    expect(validateStallInput(ok)).toEqual({ ...ok, name: undefined });
  });

  it("이름은 선택이고 공백은 없는 것으로 본다", () => {
    expect(validateStallInput({ ...ok, name: "  " }).name).toBeUndefined();
    expect(validateStallInput({ ...ok, name: " 종로 붕어빵 " }).name).toBe("종로 붕어빵");
  });

  it("종류는 여러 개를 받는다 — 복합 메뉴 노점이 대부분이다", () => {
    expect(validateStallInput({ ...ok, kinds: ["붕어빵", "어묵"] }).kinds).toEqual([
      "붕어빵",
      "어묵",
    ]);
  });

  it("정해진 종류가 아니면 거부한다", () => {
    expect(() => validateStallInput({ ...ok, kinds: ["마라탕"] })).toThrow();
  });

  it("종류가 비면 거부한다", () => {
    expect(() => validateStallInput({ ...ok, kinds: [] })).toThrow();
  });

  it("같은 종류를 여러 번 보내면 하나로 줄인다", () => {
    expect(validateStallInput({ ...ok, kinds: ["붕어빵", "붕어빵"] }).kinds).toEqual(["붕어빵"]);
  });

  it("좌표 범위를 벗어나면 거부한다", () => {
    expect(() => validateStallInput({ ...ok, lat: 91 })).toThrow();
    expect(() => validateStallInput({ ...ok, lng: -181 })).toThrow();
  });

  it("좌표가 숫자가 아니면 거부한다", () => {
    expect(() => validateStallInput({ ...ok, lat: "37.5" as unknown as number })).toThrow();
    expect(() => validateStallInput({ ...ok, lat: NaN })).toThrow();
  });

  it("이름이 너무 길면 거부한다", () => {
    expect(() => validateStallInput({ ...ok, name: "가".repeat(101) })).toThrow();
  });
});

describe("toPublicStall — 밖으로 나가는 형태로 바꾼다", () => {
  const row = {
    id: "abc",
    kinds: ["붕어빵"],
    name: "종로 붕어빵",
    lat: 37.5665123,
    lng: 126.9779692,
    status: "active",
    lastConfirmedAt: "2026-08-31T00:00:00Z",
    createdAt: "2026-08-01T00:00:00Z",
  };

  it("좌표를 흐려서 내보낸다 — 정확한 값은 DB에만 남는다", () => {
    const pub = toPublicStall(row);
    expect(pub.lat).toBe(37.5665);
    expect(pub.lng).toBe(126.9779);
  });

  it("내부 필드는 응답에 넣지 않는다", () => {
    const pub = toPublicStall(row) as Record<string, unknown>;
    expect(pub.status).toBeUndefined();
    expect(pub.createdAt).toBeUndefined();
  });

  it("최근 확인 시각은 남긴다 — 유령 마커를 가리는 근거다", () => {
    expect(toPublicStall(row).lastConfirmedAt).toBe("2026-08-31T00:00:00Z");
  });
});

describe("KINDS", () => {
  it("첫 바퀴의 종류 목록이 정해져 있다", () => {
    expect(KINDS).toContain("붕어빵");
    expect(KINDS).toContain("기타");
  });
});

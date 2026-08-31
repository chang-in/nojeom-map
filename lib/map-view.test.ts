import { describe, it, expect } from "vitest";
import { groupByCoord, confirmedLabel, isTooWide } from "./map-view";

const s = (id: string, lat: number, lng: number, name: string | null = null) => ({
  id,
  kinds: ["붕어빵"],
  name,
  lat,
  lng,
  lastConfirmedAt: "2026-08-31T00:00:00Z",
});

describe("groupByCoord — 흐리기가 만든 겹침을 묶는다", () => {
  // trunc(,4)는 약 11m 격자다. 가까운 두 노점이 같은 칸에 들어가면
  // 마커가 완전히 겹쳐서 뒤엣것을 클릭할 수 없다. 우리 흐리기의 부작용이다.
  it("좌표가 같으면 한 덩어리로 묶는다", () => {
    const g = groupByCoord([s("a", 37.5665, 126.9779), s("b", 37.5665, 126.9779)]);
    expect(g).toHaveLength(1);
    expect(g[0].stalls).toHaveLength(2);
  });

  it("좌표가 다르면 따로 둔다", () => {
    const g = groupByCoord([s("a", 37.5665, 126.9779), s("b", 37.5666, 126.9779)]);
    expect(g).toHaveLength(2);
  });

  it("묶인 덩어리도 좌표를 그대로 쓴다 — 평균을 내지 않는다", () => {
    // 평균을 내면 원본에 없던 좌표가 생겨서 흐리기 격자가 흐트러진다.
    const g = groupByCoord([s("a", 37.5665, 126.9779), s("b", 37.5665, 126.9779)]);
    expect(g[0].lat).toBe(37.5665);
    expect(g[0].lng).toBe(126.9779);
  });

  it("빈 입력은 빈 배열", () => {
    expect(groupByCoord([])).toEqual([]);
  });

  it("키가 안정적이다 — 같은 입력이면 같은 id", () => {
    const a = groupByCoord([s("a", 37.5665, 126.9779)]);
    const b = groupByCoord([s("a", 37.5665, 126.9779)]);
    expect(a[0].key).toBe(b[0].key);
  });
});

describe("confirmedLabel — 영업 여부를 단정하지 않는다", () => {
  const now = new Date("2026-08-31T12:00:00Z");

  it("오늘이면 '오늘 확인됨'", () => {
    expect(confirmedLabel("2026-08-31T09:00:00Z", now)).toBe("오늘 확인됨");
  });

  it("며칠 전이면 'N일 전 확인됨'", () => {
    expect(confirmedLabel("2026-08-28T12:00:00Z", now)).toBe("3일 전 확인됨");
  });

  it("한 달을 넘으면 개월로", () => {
    expect(confirmedLabel("2026-06-30T12:00:00Z", now)).toBe("2개월 전 확인됨");
  });

  it("'영업중' 같은 현재 상태를 단정하는 말을 쓰지 않는다", () => {
    // 실시간 영업 여부를 단정하면 상인의 현재 위치를 알려주는 셈이 된다.
    for (const iso of ["2026-08-31T09:00:00Z", "2026-08-28T12:00:00Z", "2026-01-01T00:00:00Z"]) {
      expect(confirmedLabel(iso, now)).not.toMatch(/영업|운영|중이/);
    }
  });

  it("미래 시각이 와도 깨지지 않는다", () => {
    expect(confirmedLabel("2026-09-05T00:00:00Z", now)).toBe("오늘 확인됨");
  });
});

describe("isTooWide — 400을 받기 전에 미리 막는다", () => {
  it("한 변이 1도를 넘으면 너무 넓다", () => {
    expect(isTooWide({ west: 124, south: 33, east: 132, north: 43 })).toBe(true);
  });

  it("1도 이내면 괜찮다", () => {
    expect(isTooWide({ west: 126.9, south: 37.5, east: 127.0, north: 37.6 })).toBe(false);
  });

  it("경계값(정확히 1도)은 허용한다 — API와 같은 기준", () => {
    expect(isTooWide({ west: 126, south: 37, east: 127, north: 38 })).toBe(false);
  });
});

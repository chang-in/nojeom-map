import { describe, it, expect } from "vitest";
import { blurCoord, parseBbox } from "./geo";

describe("blurCoord — 공개 좌표를 흐린다", () => {
  // 이 서비스의 핵심 제약. 노점상은 무허가 영업이 많아 정확한 위치 공개가
  // 단속·민원의 도구가 될 수 있다. 소수점 4자리 ≈ 11m.
  it("소수점 4자리로 자른다", () => {
    expect(blurCoord(37.5665123)).toBe(37.5665);
    expect(blurCoord(126.9779692)).toBe(126.9779); // 반올림이면 126.978 — 자르면 다르다
  });

  it("이미 4자리 이하면 그대로 둔다", () => {
    expect(blurCoord(37.5)).toBe(37.5);
    expect(blurCoord(127)).toBe(127);
  });

  it("음수도 자릿수만 자른다 (남반구·서반구)", () => {
    expect(blurCoord(-33.8688197)).toBe(-33.8688);
  });

  it("반올림이 아니라 잘라내기다 — 원래 위치를 되짚을 여지를 줄인다", () => {
    // 37.56659를 반올림하면 37.5666이 되어 실제보다 북쪽을 가리킨다.
    // 잘라내면 항상 같은 방향(남서)으로만 밀려 편향이 예측 가능하다.
    expect(blurCoord(37.56659)).toBe(37.5665);
  });
});

describe("parseBbox — 지도가 보내는 영역 문자열을 판정한다", () => {
  it("west,south,east,north 순서로 읽는다", () => {
    expect(parseBbox("126.9,37.5,127.0,37.6")).toEqual({
      west: 126.9,
      south: 37.5,
      east: 127.0,
      north: 37.6,
    });
  });

  it("동서가 뒤집히면 거부한다", () => {
    expect(() => parseBbox("127.0,37.5,126.9,37.6")).toThrow();
  });

  it("남북이 뒤집히면 거부한다", () => {
    expect(() => parseBbox("126.9,37.6,127.0,37.5")).toThrow();
  });

  it("좌표 범위를 벗어나면 거부한다", () => {
    expect(() => parseBbox("126.9,91,127.0,92")).toThrow(); // 위도 > 90
    expect(() => parseBbox("-181,37.5,127.0,37.6")).toThrow(); // 경도 < -180
  });

  it("숫자가 아니거나 개수가 안 맞으면 거부한다", () => {
    expect(() => parseBbox("126.9,37.5,127.0")).toThrow();
    expect(() => parseBbox("a,b,c,d")).toThrow();
    expect(() => parseBbox("")).toThrow();
  });

  it("너무 넓은 영역은 거부한다 — 전국 스캔을 막는다", () => {
    // 줌아웃하면 수천 개가 한 번에 내려와 타임아웃과 렉이 난다.
    expect(() => parseBbox("124,33,132,43")).toThrow();
  });
});

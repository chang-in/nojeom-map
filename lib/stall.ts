import { blurCoord } from "./geo";

/**
 * 첫 바퀴의 노점 종류. 화이트리스트로 두는 이유는 자유 입력을 받으면
 * 오타·중복·장난이 쌓여 지도를 못 믿게 되기 때문이다.
 */
export const KINDS = ["붕어빵", "떡볶이", "어묵", "호떡", "계란빵", "기타"] as const;
export type Kind = (typeof KINDS)[number];

const NAME_MAX = 100;

export type StallInput = {
  kinds: string[];
  name?: string;
  lat: number;
  lng: number;
};

/** 저장 전에 판정한다. 어긋나면 던진다 — 조용히 보정하면 쓰레기가 쌓인다. */
export function validateStallInput(input: StallInput): {
  kinds: Kind[];
  name: string | undefined;
  lat: number;
  lng: number;
} {
  const { kinds, name, lat, lng } = input;

  if (!Array.isArray(kinds) || kinds.length === 0) {
    throw new Error("종류를 하나 이상 골라야 한다");
  }
  // 복합 메뉴 노점이 대부분이라 여러 개를 받되, 같은 값은 하나로 줄인다.
  const uniq = [...new Set(kinds)];
  for (const k of uniq) {
    if (!(KINDS as readonly string[]).includes(k)) throw new Error(`모르는 종류: ${k}`);
  }

  for (const [label, v, min, max] of [
    ["위도", lat, -90, 90],
    ["경도", lng, -180, 180],
  ] as const) {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${label}가 숫자가 아니다`);
    if (v < min || v > max) throw new Error(`${label}는 ${min}~${max}여야 한다`);
  }

  const trimmed = name?.trim();
  if (trimmed && trimmed.length > NAME_MAX) {
    throw new Error(`이름은 ${NAME_MAX}자 이내여야 한다`);
  }

  return { kinds: uniq as Kind[], name: trimmed || undefined, lat, lng };
}

export type StallRow = {
  id: string;
  kinds: string[];
  name: string | null;
  lat: number;
  lng: number;
  status: string;
  lastConfirmedAt: string;
  createdAt: string;
};

export type PublicStall = {
  id: string;
  kinds: string[];
  name: string | null;
  lat: number;
  lng: number;
  lastConfirmedAt: string;
};

/**
 * 밖으로 나가는 형태로 바꾼다.
 *
 * 좌표를 흐리는 게 핵심이다 — 노점상은 무허가 영업이 많아 정확한 위치 공개가
 * 단속·민원의 도구가 될 수 있다. 정확한 값은 DB에만 남는다.
 * `status`·`createdAt` 같은 내부 필드는 내보내지 않는다.
 */
export function toPublicStall(row: StallRow): PublicStall {
  return {
    id: row.id,
    kinds: row.kinds,
    name: row.name,
    lat: blurCoord(row.lat),
    lng: blurCoord(row.lng),
    lastConfirmedAt: row.lastConfirmedAt,
  };
}

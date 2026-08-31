/** 공개 좌표의 자릿수. 4자리 ≈ 11m — 골목 어귀까지는 안내되고 건물 단위 특정은 막힌다. */
const PUBLIC_PRECISION = 4;

/** bbox 한 변의 최대 크기(도). 넘으면 거부한다 — 줌아웃 한 번에 전국이 내려오는 걸 막는다. */
const MAX_SPAN_DEG = 1;

/**
 * 공개용으로 좌표를 흐린다. 정확한 값은 저장만 하고 응답에는 이 값을 쓴다.
 *
 * 반올림이 아니라 **잘라내기**다. 반올림하면 실제보다 북쪽이나 동쪽을 가리킬 수 있는데,
 * 잘라내면 항상 같은 방향(남서)으로만 밀려 편향이 예측 가능하다.
 */
export function blurCoord(v: number): number {
  const f = 10 ** PUBLIC_PRECISION;
  return Math.trunc(v * f) / f;
}

export type Bbox = { west: number; south: number; east: number; north: number };

/**
 * `west,south,east,north` 문자열을 판정해 읽는다.
 * 순서·범위·크기 중 하나라도 어긋나면 던진다 — 조용히 보정하지 않는다.
 */
export function parseBbox(raw: string): Bbox {
  const parts = raw.split(",");
  if (parts.length !== 4) throw new Error("bbox는 west,south,east,north 네 값이어야 한다");

  const [west, south, east, north] = parts.map((p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) throw new Error(`bbox에 숫자가 아닌 값: ${p}`);
    return n;
  });

  if (west < -180 || east > 180) throw new Error("경도는 -180~180이어야 한다");
  if (south < -90 || north > 90) throw new Error("위도는 -90~90이어야 한다");
  if (west >= east) throw new Error("동서가 뒤집혔다 (west < east)");
  if (south >= north) throw new Error("남북이 뒤집혔다 (south < north)");
  if (east - west > MAX_SPAN_DEG || north - south > MAX_SPAN_DEG) {
    throw new Error(`영역이 너무 넓다 (한 변 ${MAX_SPAN_DEG}도 이내)`);
  }

  return { west, south, east, north };
}

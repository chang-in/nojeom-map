-- 노점 테이블. 설계 근거는 docs/design.md.
--
-- 이 파일의 핵심은 테이블이 아니라 **RLS**다. Supabase는 anon 키가 브라우저에 노출되는 구조라,
-- "앱 코드에서 WHERE로 거른다"는 방어가 안 된다 — 키만 있으면 테이블을 직접 조회할 수 있다.
-- 그래서 무엇이 밖으로 나가는지를 DB가 정한다.

create type stall_status as enum ('active', 'hidden', 'removed');

create table stall (
  id                uuid primary key default gen_random_uuid(),
  kinds             text[] not null,
  name              text,
  -- 정확한 좌표. **공개 응답에는 흐린 값이 나간다**(lib/geo.ts blurCoord, 소수점 4자리 ≈ 11m).
  -- 노점상은 무허가 영업이 많아 정확한 위치 공개가 단속·민원의 도구가 될 수 있다.
  lat               double precision not null,
  lng               double precision not null,
  status            stall_status not null default 'active',
  last_confirmed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint stall_kinds_not_empty check (cardinality(kinds) > 0),
  constraint stall_name_len        check (name is null or char_length(name) <= 100),
  constraint stall_lat_range       check (lat between -90 and 90),
  constraint stall_lng_range       check (lng between -180 and 180)
);

-- bbox 조회용. design.md의 GET /api/stalls?bbox=... 가 이 인덱스를 쓴다.
-- PostGIS 없이 double precision 두 컬럼으로 가는 이유: 첫 바퀴는 "사각형 안"만 물으면 되고,
-- 거리·반경 질의가 필요해지면 그때 PostGIS로 옮긴다.
create index stall_bbox_idx on stall (lng, lat) where status = 'active';
create index stall_last_confirmed_idx on stall (last_confirmed_at desc) where status = 'active';

-- ── RLS ────────────────────────────────────────────────────────────────
alter table stall enable row level security;

-- 읽기: active만. hidden(신고 접수)·removed는 anon에게 존재 자체가 안 보인다.
-- 신고 즉시 status='hidden'으로 바꾸는 조치가 실제로 먹히려면 이 정책이 있어야 한다.
create policy stall_read_active on stall
  for select to anon, authenticated
  using (status = 'active');

-- 쓰기: 익명 제보를 받는다(design.md POST /api/stalls). 단 status는 못 정한다 —
-- 기본값 'active'로만 들어가고, 'hidden'인 것을 되살리는 우회를 막는다.
create policy stall_insert_anon on stall
  for insert to anon, authenticated
  with check (status = 'active');

-- 수정·삭제 정책은 만들지 않는다. RLS는 정책이 없으면 거부이므로,
-- status 변경(신고 처리)과 삭제는 service_role로만 가능하다.

-- updated_at 자동 갱신
create function set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stall_set_updated_at
  before update on stall
  for each row execute function set_updated_at();

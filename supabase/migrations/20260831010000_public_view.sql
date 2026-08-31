-- 정확한 좌표가 anon에게 새는 구멍을 막는다.
--
-- 앞 마이그레이션의 RLS는 **행**은 걸렀지만(hidden 비공개) **열**은 못 걸렀다.
-- RLS에 열 단위 개념이 없기 때문이다. anon 키는 브라우저에 노출되므로,
-- 클라이언트가 우리 API를 거치지 않고 PostgREST를 직접 부르면
-- 소수점 7자리 좌표가 그대로 나갔다 (실측 2026-08-31: lat=37.5665123).
--
-- 앱에서만 흐리는 건 덮는 수리다 — 키가 노출되면 다시 열린다.
-- **DB가 애초에 정확한 좌표를 안 내보내게** 한다.

-- ① anon이 테이블 자체를 못 보게 한다
drop policy stall_read_active on stall;

-- ② 흐린 좌표만 담은 뷰. 이것만 공개한다.
--    trunc(,4)는 lib/geo.ts의 blurCoord와 같은 규칙이다 —
--    **반올림이 아니라 잘라내기**여서 오차가 항상 남서쪽으로만 생긴다(예측 가능).
create view stall_public
with (security_invoker = false)   -- 정의자 권한으로 읽는다. anon은 stall 권한이 없어도 된다
as
  select
    id,
    kinds,
    name,
    trunc(lat::numeric, 4)::double precision as lat,
    trunc(lng::numeric, 4)::double precision as lng,
    last_confirmed_at
  from stall
  where status = 'active';

revoke all on stall_public from anon, authenticated;
grant select on stall_public to anon, authenticated;

comment on view stall_public is
  '공개용. 좌표는 소수점 4자리(≈11m)로 잘라낸 값이고 active만 나온다. 정확한 좌표는 stall에만 있다.';

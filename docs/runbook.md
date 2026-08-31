# 런북 — 새벽 3시에 읽을 것

**지혈이 원인보다 먼저다.** 사용자 영향을 먼저 멈추고 원인은 그다음에 본다.

```
알림 → ① 지혈(롤백) → ② 원인 → ③ 수정 → ④ 아래 "겪은 장애"에 한 줄
```

🔴 **딱 하나 예외 — 이 배포에 스키마 변경이 있었나를 먼저 묻는다.**
있었다면 앱만 되돌리는 순간 구버전 코드가 새 스키마를 잘못 읽어 **데이터가 더 망가진다.**
그때는 롤백이 아니라 기능 끄기·읽기 전용 전환이 지혈 수단이다.
(첫 바퀴엔 DB가 없어 해당 없음. Supabase가 붙는 순간부터 매번 묻는다.)

## 되돌리기

```bash
# ① 지금 프로덕션이 어느 배포인지
vercel inspect https://nojeom-map.vercel.app | grep -E "^\s*(id|url|created)"

# ② 되돌아갈 배포 고르기 (Age·URL 확인)
vercel ls

# ③ 롤백 — 2초면 끝난다
vercel rollback <되돌아갈-배포-URL> --yes

# ④ 반영됐는지 확인 (①과 id가 달라져야 한다)
vercel inspect https://nojeom-map.vercel.app | grep -E "^\s*(id|url)"
curl -s -o /dev/null -w "%{http_code}\n" https://nojeom-map.vercel.app

# ⑤ 다시 앞으로 갈 때
vercel promote <최신-배포-URL> --yes
```

**실제로 해봤다** (2026-08-31): `lpeym688c → r82z1jdu7` 롤백 2초, `promote`로 복귀 2초.
양쪽 다 `vercel inspect`의 배포 id가 바뀌는 것과 HTTP 200을 확인했다.

⚠️ **`vercel ls`의 URL은 배포마다 다르다.** 고정된 "직전 버전" 값을 여기 적어두면 금방 낡는다 —
그래서 절차만 적고 대상은 그때 `vercel ls`로 고른다.

## DB 복구

(Supabase 미연결 — 붙으면 채운다)

마지막 복구 테스트: **아직 안 함.** 지금 하면 빈 DB를 빈 DB로 복구하는 거라 거짓 통과가 된다.
실데이터가 생긴 뒤 한 번 해보고 날짜를 채운다.

## 볼 곳

| 무엇 | 어디 |
|---|---|
| 프로덕션 | https://nojeom-map.vercel.app |
| 배포·빌드 로그 | `vercel logs <배포URL>` · https://vercel.com/ckddlsdl/nojeom-map |
| 런타임 로그 (실시간) | `vercel logs <배포URL> --follow` |
| CI | https://github.com/chang-in/nojeom-map/actions |
| 보안 알림 | https://github.com/chang-in/nojeom-map/security |

## 겪은 장애

(비어 있음)

겪지 않은 장애의 대응 절차는 쓸 수 없다. 터질 때마다 한 줄씩 자란다 —
*증상 · 무엇으로 확인했나 · 무엇으로 지혈했나*.

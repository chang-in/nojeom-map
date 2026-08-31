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

🔴 **지금 백업이 없다. 데이터를 잃으면 못 되돌린다.** 알고 안 하는 것이다.

- Supabase **무료 플랜은 자동 백업도 PITR도 없다.** 백업 다운로드도 안 된다
  ([공식 문서](https://supabase.com/docs/guides/platform/backups)) — `supabase db dump`로
  직접 내보내고 서버 밖에 두라고 안내한다
- 지금 안 하는 이유: **행이 0개**다. 잃을 게 없는데 장치부터 만드는 건 순서가 뒤집힌 것
- **RPO / RTO: 없음.** 백업이 없으니 되돌릴 시점도, 복구 시간도 없다

### 언제 해야 하나 — 트리거

**첫 실데이터(남이 올린 제보)가 들어오는 순간.** "나중에"가 아니라 이 조건이다.
그때 결정할 것이 하나 있다:

⚠️ **리포가 public이라 Actions artifact는 누구나 받을 수 있다.** 덤프에는
**흐리지 않은 정확한 좌표**와 `hidden`(신고 접수된) 행이 들어가서, 공개하면
`blurCoord`의 11m 흐리기와 RLS를 통째로 우회하게 된다.
→ 후보: OCI 서버로 scp · gpg 암호화 후 artifact · private 전환 · R2/S3

```bash
# 그때 쓸 명령 (지금도 수동으로는 된다)
npx supabase db dump --db-url "postgresql://postgres:<PW>@db.popbgdaqwovwfmrtzadm.supabase.co:5432/postgres" -f backup.sql
```

마지막 복구 테스트: **아직 안 함.** 빈 DB를 빈 DB로 복구하면 거짓 통과다.
성공 조건은 미리 정해둔다 — **행 수가 원본과 맞고**, **앱을 붙여 제보 조회가 되고**, **RTO 안**.

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

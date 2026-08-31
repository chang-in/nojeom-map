#!/usr/bin/env bash
# 새로 추가된 의존성이 실재하는 패키지인지 본다 (종료 코드가 판정값)
#
# ★ 왜 필요한가: 에이전트는 **실재하지 않는 패키지 이름을 그럴듯하게 지어낸다**(slopsquatting).
#   공격자가 그 이름을 레지스트리에 선점해두면 설치 시점에 악성 코드가 실행된다.
#   SCA(Dependabot·OSV)는 **이미 알려진 CVE**만 보므로 이 경로를 못 막는다.
#
# ⚠️ 이 검사는 "실측된 실패가 없으면 만들지 않는다"의 예외다 (판단 2026-08-31).
#   이 리포에서 환각 패키지가 나온 적은 없다. 그래도 만드는 이유는 둘 —
#   **되돌릴 수 없고**(설치 시점에 실행된다) **검사가 싸다**(레지스트리 조회 한 번).
#   반대로 테스트 약화·워크플로 자가 수정은 실측이 0이고 복구가 가능해 만들지 않았다.
#
# 사용: bash scripts/gate-deps.sh [base]     기본 base는 origin/main
# 전제: jq, git, npm. package.json이 없으면 조용히 통과한다.
set -uo pipefail

BASE="${1:-origin/main}"
[ -f package.json ] || { echo "package.json 없음 — 건너뜀"; exit 0; }
command -v npm >/dev/null 2>&1 || { echo "npm 없음 — 건너뜀"; exit 0; }
git rev-parse --verify -q "$BASE" >/dev/null 2>&1 || { echo "$BASE 없음 — 건너뜀"; exit 0; }

names() { jq -r '((.dependencies // {}) + (.devDependencies // {})) | keys[]' 2>/dev/null; }
OLD=$(git show "$BASE:package.json" 2>/dev/null | names | sort -u)
NEW=$(names < package.json | sort -u)
ADDED=$(comm -13 <(printf '%s\n' "$OLD") <(printf '%s\n' "$NEW"))

[ -n "${ADDED// /}" ] || { echo "✅ 새로 추가된 의존성 없음"; exit 0; }

echo "새 의존성: $(printf '%s' "$ADDED" | tr '\n' ' ')"
FAIL=0
for P in $ADDED; do
	# ⚠️ 워크스페이스·file:·link: 프로토콜은 레지스트리에 없는 게 정상이다
	SPEC=$(jq -r --arg p "$P" '((.dependencies // {}) + (.devDependencies // {}))[$p] // ""' package.json)
	case "$SPEC" in workspace:*|file:*|link:*|portal:*) echo "  · $P — 로컬 참조($SPEC), 건너뜀"; continue ;; esac

	# ⚠️ **"모른다"와 "확인했더니 없다"를 구분한다** (실측 2026-08-31).
	#    `npm view --json`은 실패해도 stdout에 에러 JSON을 낸다(E404 본문 354자).
	#    "비었나"로만 보면 지어낸 패키지가 그대로 통과한다 — 실제로 통과시켰다.
	#    종료 코드와 `.error`를 함께 봐야 하고, 네트워크 실패(통과)와 404(차단)는 다른 처리다.
	META=$(npm view "$P" --json 2>/dev/null); RC=$?
	if printf '%s' "$META" | jq -e '.error.code == "E404"' >/dev/null 2>&1; then
		echo "  ❌ $P — **레지스트리에 없다.** 지어낸 이름일 수 있다 (slopsquatting)"
		FAIL=1
		continue
	fi
	if [ "$RC" -ne 0 ] || [ -z "$META" ]; then
		echo "  ⚠️ $P — 조회 실패(네트워크·레지스트리). **판정하지 않고 통과**시킨다"
		continue
	fi

	CREATED=$(printf '%s' "$META" | jq -r '.time.created // empty' 2>/dev/null)
	if [ -n "$CREATED" ]; then
		AGE=$(( ( $(date +%s) - $(date -j -f "%Y-%m-%dT%H:%M:%S" "${CREATED%%.*}" +%s 2>/dev/null || date -d "$CREATED" +%s 2>/dev/null || date +%s) ) / 86400 ))
		[ "$AGE" -lt 30 ] && echo "  ⚠️ $P — 만들어진 지 ${AGE}일. 이름이 비슷한 유명 패키지가 있는지 확인할 것 (타이포스쿼팅)"
	fi

	DL=$(curl -sf --max-time 5 "https://api.npmjs.org/downloads/point/last-week/$P" 2>/dev/null | jq -r '.downloads // empty' 2>/dev/null)
	[ -n "$DL" ] && [ "$DL" -lt 1000 ] 2>/dev/null && echo "  ⚠️ $P — 주간 다운로드 ${DL}회. 정말 이 패키지가 맞는지 확인할 것"

	echo "  ✅ $P — 실재 (첫 배포 ${CREATED%%T*})"
done

echo
[ "$FAIL" = 0 ] && { echo "새 의존성 확인 완료"; exit 0; }
echo "⚠️ 레지스트리에 없는 패키지가 있다. 이름을 다시 확인하고, 필요하면 사용자에게 보고하고 멈춘다."
exit 1

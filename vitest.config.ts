import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 자원 상한. 없으면 워커가 코어 수만큼 떠서 다른 작업과 겹칠 때 머신이 멈춘다.
    // 실측(2026-08-06, 다른 프로젝트): 테스트 둘이 기본 병렬로 동시에 돌아
    // load average 68 · 여유 메모리 56MB까지 갔다.
    //
    // 명령줄 --maxWorkers 대신 여기 두는 이유: 명령을 고치는 훅은 "npm test"라는
    // 문자열을 포함한 모든 명령을 건드려 파일 내용까지 훼손한다(실측 2026-08-31).
    // config에 있으면 명령을 안 건드리고, 리포에 기록이 남고, 훅이 꺼져도 유지된다.
    maxWorkers: 3,
  },
});

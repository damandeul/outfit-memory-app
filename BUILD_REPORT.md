# 안겹쳐 BUILD REPORT

- 구현일: 2026-07-30 KST
- 범위: 로컬 우선 모바일 PWA MVP
- 배포·유료 API·외부 게시: 실행하지 않음

## 구현 결과

React 19 + TypeScript + Vite + IndexedDB(idb) 기반 PWA를 구현했다. 사진 필수 옷장 CRUD/보관/소프트 삭제, 스마트폰 후면 카메라 촬영과 앨범 선택, 색상·카테고리 기반 이름 제안, 착장 기록과 snapshot, 동일·핵심 동일 조합 경고, 최근 4회 판정, 계절 fallback과 사전식 결정적 추천, 3개 단위 후보 탐색, 초안 수정·확정, 착장 수정, JSON 메타데이터 내보내기, 전체 삭제, 한국어 IME 방어, 사진 취소·압축·방향 반영, 390/768px 레이아웃, service worker 앱 셸을 포함한다.

## TDD RED → GREEN 실행 근거

1. 도메인 규칙 RED
   - 명령: `npm test -- --reporter=verbose`
   - 실패: `Failed to resolve import "./domain"`
   - GREEN: `src/types.ts`, `src/domain.ts` 최소 구현 후 5/5 통과.
   - 추가 RED: 핵심 동일 판정이 `none`을 반환하는 회귀를 확인하고 category snapshot 병합을 수정해 5/5 통과.
2. IndexedDB RED
   - 명령: `npx vitest run src/db.test.ts --reporter=verbose`
   - 실패: `Failed to resolve import "./db"`
   - GREEN: v1 stores와 repository 구현 후 3/3 통과.
3. UI/IME RED
   - 명령: `npx vitest run src/App.test.tsx --reporter=verbose`
   - 실패: `Failed to resolve import "./App"`
   - GREEN: UI와 IME/파일취소 복구 구현 후 2/2 통과.
4. 브라우저 E2E
   - 최초 실패: iPhone device preset이 WebKit executable을 요구함. project browserName을 Chromium으로 명시.
   - 다음 실패: 열린 IndexedDB 연결로 deleteDatabase가 대기함. stores를 transaction clear하는 격리 방식으로 교체.
   - locator 중복과 결정적 ID 정렬에 따른 표시 순서 변동을 접근성 exact locator와 내용 기반 카드 검증으로 수정.
   - 최종: 1/1 통과.

## 최종 검증

- `npm ci`: 성공, 539 packages 설치
- `npm test`: 8 files, 45 tests PASS
- `npm run test:e2e`: mobile Chromium 15/15 PASS
- `npm run test:qa`: fresh production Chromium 7/7 PASS
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
  - 36 modules transformed
  - `dist/index.html`, JS/CSS, `manifest.webmanifest`, `sw.js`, Workbox 생성
  - precache 7 entries, 235.74 KiB
- `npm audit --omit=dev`: production dependencies 취약점 0
- 반응형: E2E에서 390px와 768px `scrollWidth <= clientWidth` 확인
- 지속성: E2E에서 옷 3개와 착장 저장 후 새로고침 조회 확인

## QA 증거

- `qa-evidence/390-recommendation.png`
- `qa-evidence/768-recommendation.png`
- `playwright-report/`

## 개인정보·보안 점검

- 사용자 사진/메타데이터 외부 전송 코드 없음.
- 로그인, 분석, 오류 추적, 광고, 외부 추천 API 없음.
- JSON export는 data URL과 snapshot 사진을 제거하고 `containsImages:false`를 기록.
- 전체 삭제는 앱 이름 입력 후에만 실행하며 IndexedDB 5 stores와 앱 캐시를 정리.
- production dependency audit 0 vulnerabilities.

## 알려진 경계와 후속 QA

- 실제 iOS/Android 카메라의 EXIF 1/3/6/8 표본 방향은 실제 기기에서 별도 수동 확인이 필요하다. 구현은 `createImageBitmap(..., {imageOrientation:'from-image'})`를 사용한다.
- 사진은 media store 분리 대신 garment/outfit record의 압축 data URL로 저장된다. 기능·외부 미전송·새로고침 지속성은 만족하지만, 대규모 옷장에서는 목록 읽기 비용이 커질 수 있어 후속 버전에서 Blob store 분리를 권장한다.
- 옷·착장 사진 처리 중에는 일반 저장, 중복 경고 override, 초안 저장을 동기 lock과 disabled 상태로 차단한다. 옷 등록 폼의 같은 이벤트 턴 이중 제출도 `useRef` 동기 lock으로 DB write 1회만 허용하며 unit·production-browser 회귀 테스트가 있다.
- 개발 의존성 audit에는 상위 도구 체인의 high 경고가 있으나 `npm audit --omit=dev`는 0이다. 강제 audit fix는 major downgrade/변경 위험 때문에 실행하지 않았다.
- 독립검수에서 CSS Google Fonts 원격 import를 발견해 회귀 테스트를 먼저 실패시킨 뒤 제거했다. 최종 production 스타일은 기기 내 시스템 글꼴만 사용하며 원격 스타일·폰트·이미지 URL을 포함하지 않는다.

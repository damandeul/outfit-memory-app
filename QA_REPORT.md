# 안겹쳐 독립 QA 보고서

- 검수 시각: 2026-07-31 KST
- 대상: `/Users/damandeul/다만들/ai-company/outfit-memory-app`
- 판정: **수정 후 통과 — 로컬 production artifact 기준**
- 금지사항 준수: 배포, 커밋, 푸시, 유료 API 호출을 실행하지 않음

## 1. 독립 검수 범위

`BRIEF.md`, `RESEARCH.md`, `PRODUCT_SPEC.md`, `UX_SPEC.md`, `DATA_RULES.md`, `BUILD_REPORT.md`를 읽고 구현자의 자기보고와 별개로 의존성 설치, 단위·통합 테스트, lint, typecheck, production build, 기존 E2E, 별도 production browser QA를 직접 실행했다.

브라우저 QA는 production `dist/`를 `vite preview`로 제공한 Chromium에서 실행했다. 390×844, 768×900, 1440×1000 뷰포트와 오프라인 service worker 재로딩을 포함한다.

## 2. 발견 결함과 수정

### F-1. 허용하지 않는 `image/*` MIME이 디코더까지 도달함 — 수정 완료

- 기존 동작: `file.type.startsWith('image/')`만 검사해 `image/svg+xml` 같은 비허용 형식도 `createImageBitmap`으로 전달됐다.
- RED: `src/image.test.ts`의 “허용하지 않는 image MIME은 디코딩 전에 거절한다”가 실패했고, 디코더 mock 반환값 접근 중 TypeError를 재현했다.
- 수정: JPEG, PNG, WebP, HEIC, HEIF 명시 allowlist를 추가했다.
- GREEN: 비허용 MIME 사전 거절, 25 MiB 초과 사전 거절, 허용 형식 디코딩 실패의 사용자 오류 변환 3개 테스트가 통과했다.

### F-2. README 개인정보 설명이 제거된 Google Fonts 요청을 계속 언급함 — 수정 완료

현재 production CSS와 privacy test는 외부 폰트를 사용하지 않는다. README의 오래된 Google Fonts 설명을 시스템 글꼴·외부 SDK 미사용 사실에 맞게 수정했다.

### F-3. 독립 QA suite가 기본 E2E 명령에도 포함됨 — 수정 완료

별도 production QA suite를 추가한 뒤 기본 `npm run test:e2e`가 QA용 origin/service worker 전제를 함께 실행해 실패하는 것을 재현했다. 기본 Playwright 설정에서 `qa.spec.ts`를 제외하고, production QA는 `playwright.qa.config.ts`로만 실행하도록 분리했다. 이후 두 명령을 각각 다시 실행해 모두 통과했다.

### F-4. IndexedDB 실패가 처리되지 않아 폼이 잠기거나 빈 화면이 될 수 있음 — 수정 완료

- 초기 조회 실패를 visible `role="alert"`와 `다시 불러오기`로 복구한다.
- 옷·착장 저장 실패는 입력을 유지하고 저장 버튼을 다시 활성화한다.
- 옷 보관/삭제, 착장 삭제, JSON 내보내기, 전체 삭제 실패도 사용자에게 오류를 표시한다.
- 회귀 테스트에서 초기 load rejection과 garment write rejection을 직접 주입해 통과했다.

### F-5. 착장 사진 디코딩 rejection과 중복 저장 경합 — 수정 완료

- 착장 사진 처리에 `try/catch/finally`와 processing 상태를 추가해 decode 실패를 폼 안의 복구 가능한 오류로 표시한다.
- `useRef` 기반 동기 save lock과 disabled 상태로 중복 경고의 `그대로 저장` 및 일반 submit 연타가 IndexedDB write를 두 번 시작하지 않게 했다.
- 두 결함 모두 실패 주입/연속 클릭 회귀 테스트가 통과했다.

### F-6. production QA가 stale `dist/`를 검사할 수 있음 — 수정 완료

`npm run test:qa`를 `npm run build && playwright test -c playwright.qa.config.ts`로 고정하고 정적 회귀 테스트를 추가했다. 최종 QA는 이 명령으로 fresh build 후 7/7 통과했다.

### F-7. stale JavaScript 설정 복사본이 TypeScript 설정과 충돌할 수 있음 — 수정 완료

`vite.config.js`와 `playwright.config.js`가 최신 `.ts` 설정과 다른 내용으로 남아 있었다. 도구별 권위 설정을 TypeScript 파일 하나로 고정하는 회귀 테스트를 먼저 실패시킨 뒤 두 stale 복사본을 제거하고 재생성 방지 ignore를 추가했다.

### F-8. 옷 사진 압축 중 저장하면 사진 없는 레코드가 생성될 수 있음 — 수정 완료

옷 사진 처리가 끝날 때까지 파일 입력과 저장 버튼을 잠그고 `사진 준비 중…` 상태를 표시한다. 처리 중 강제 submit이 IndexedDB 쓰기를 시작하지 않고, 완료 후 가공된 사진 data URL을 저장하는 회귀 테스트를 RED→GREEN으로 통과시켰다.

### F-9. 핵심 옷이 없는 보조 아이템끼리 핵심 동일 경고가 발생함 — 수정 완료

신발·액세서리만 선택한 서로 다른 조합의 빈 core key가 서로 일치하던 문제를 수정했다. 핵심 아이템 key가 비어 있으면 core 비교를 건너뛰며, 서로 다른 신발만 선택한 기록에 잘못된 경고가 나오지 않는 회귀 테스트를 추가했다.

### F-10. 기본 E2E가 이미 실행 중인 다른 서버를 재사용할 수 있음 — 수정 완료

기본 Playwright 설정의 `reuseExistingServer`를 `false`로 고정했다. 포트에 무관한 서버가 있으면 조용히 재사용하지 않고 실패하므로, 핵심 E2E가 현재 소스에서 시작한 개발 서버만 검사한다. 설정 회귀 테스트를 추가했다.

### F-11. 스마트폰 촬영 진입과 안전한 이름 제안 — 구현 완료

옷 등록에 후면 카메라 힌트 `capture="environment"`가 있는 촬영 입력과 capture를 강제하지 않는 앨범 입력을 함께 제공한다. 두 경로는 같은 MIME·크기·디코딩·EXIF 제거·압축 파이프라인을 사용한다. 사진 처리 후 이름이 비어 있으면 현재 색상과 카테고리로 이름을 제안하며, 자동 제안 중에는 태그 변경을 따라가고 사용자가 이름을 수정한 뒤에는 덮어쓰지 않는다. 카메라/앨범 DOM 계약, 자동 제안, 태그 추적, 수동 수정 보존 테스트를 RED→GREEN으로 추가했다.

### F-12. 중복 경고 상태에서 착장 사진 처리 중 override 가능 — 수정 완료

중복 경고가 열린 뒤 착장 사진 처리를 시작하면 `그대로 저장`이 활성 상태로 남아 사진 없는 착장을 확정할 수 있었다. 지연된 사진 Promise로 실패를 재현한 뒤 착장 사진용 동기 lock, `persist()` 방어 조건, 경고 override 비활성화를 함께 적용했다. 처리 중 저장 호출 0회와 처리 완료 후 가공된 `fullPhotoDataUrl` 저장을 회귀 테스트로 확인했다.

### F-13. 옷 사진 처리 중 바꾼 태그가 이름 제안에 반영되지 않음 — 수정 완료

비동기 사진 처리가 시작될 때의 카테고리·색상이 closure에 고정되어, 처리 중 태그를 바꾸면 완료 후 오래된 `검정 상의`가 제안됐다. 카테고리·색상 ref를 이벤트에서 동기 갱신하고 사진 완료 시 최신 ref를 읽도록 수정했다. 처리 중 `아우터`·`파랑`으로 바꾼 뒤 `파랑 아우터`가 제안되는 회귀 테스트를 RED→GREEN으로 확인했다.

### F-14~F-20. 제품 명세 P0 독립 적대 인수 결함 — 수정 완료

독립 감수에서 기존 표준 suite가 놓친 7개 제품 계약을 재현했다. 적대 테스트를 `src/product-contract.test.ts`와 `e2e/product-contract.spec.ts`로 영구 편입한 뒤 다음을 RED→GREEN 처리했다.

- 계절 일치 후보가 없어도 다른 계절 후보를 fallback으로 유지한다.
- 추천은 최근 핵심 등장 총횟수, 등장 핵심 수, 계절 불일치, 핵심 색상, last worn, ID 순으로 사전식 정렬한다.
- 신발 등 보조 아이템은 핵심 색상 조화 판정을 바꾸지 않는다.
- 신규 옷은 사진이 필수이며 무사진 제출은 IndexedDB write를 시작하지 않는다.
- 20개를 넘는 모든 추천 후보를 3개씩 탐색하고 소진 안내 후 처음부터 볼 수 있다.
- 계절·색상 확인 필요 안내를 실제 추천 카드에 표시하고 하단 내비게이션은 명세대로 3개로 제한한다.
- 초안을 같은 ID로 수정하고 실제 착용으로 확정하며 새로고침 후 유지한다.
- 초안 확정 시 동일 ID·`createdAt`을 보존하고 `drafts`에서 `outfits`로 이동하는 저장소 상태를 직접 검증한다.
- 추천 결과가 없으면 부족 핵심 카테고리 또는 과거 핵심 조합 제외 원인을 안내한다.
- 옷은 `deletedAt` 소프트 삭제하고 새 선택·추천에서 제외하되 과거 snapshot과 export 레코드는 보존한다.

### F-21~F-22. 최종 clean-room 저장 잠금·터치 대상 결함 — 수정 완료

- 옷 등록 폼을 같은 JavaScript 이벤트 턴에서 `requestSubmit()` 두 번 호출하면 서로 다른 UUID의 옷이 2개 저장되던 문제를 재현했다. `GarmentForm`에 `useRef` 동기 save lock을 추가해 첫 `await` 전에 선점하고 실패·완료 시 해제한다. unit 테스트와 production mobile Chromium 테스트에서 DB 레코드가 정확히 1개임을 확인했다.
- 계절 선택 연결 label이 390px에서 42px 높이로 44px 기준에 미달하던 문제를 재현했다. `.check`에 `min-height:44px`를 적용하고 5개 계절 label의 실제 bounding box가 모두 44px 이상인지 mobile E2E에서 검증한다.

## 3. 최종 품질 게이트

| 게이트 | 실제 결과 |
|---|---|
| `npm ci` | 성공, 539 packages 설치 |
| `npm test -- --reporter=verbose` | 8 files, 45 tests 통과 |
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과, 36 modules, PWA precache 7 entries / 235.74 KiB |
| `npm run test:e2e` | 핵심 + 제품 계약 모바일 E2E 15/15 통과 |
| `npm run test:qa` | fresh production build + 독립 QA 7/7 통과 |
| `npm audit --omit=dev` | production 취약점 0 |
| 전체 `npm audit` | high 11, critical 0; 모두 개발 도구 체인. 직접 의존성 `eslint`, `vite-plugin-pwa` 포함 |

전체 audit의 high 11건은 production 의존성에는 포함되지 않지만 무시하지 않았다. 해결 후보 중 ESLint는 major update가 필요하며, 강제 audit fix는 이번 bounded QA 범위에서 실행하지 않았다.

## 4. 필수 브라우저 QA 결과

| 시나리오 | 결과 |
|---|---|
| 390×844 | 수평 overflow 없음, 표시된 입력·버튼 44px 이상, 콘솔/page error 없음 |
| 768×900 | 수평 overflow 없음, 44px 이상, 콘솔/page error 없음 |
| 1440×1000 | max-width 모바일 레이아웃 정상, 수평 overflow 없음, 44px 이상, 콘솔/page error 없음 |
| 파일 선택 취소 | 빈 파일 선택 결과 뒤 기존 이름과 폼 유지, 오류 alert 없음 |
| 스마트폰 사진 입력 | 후면 카메라 촬영 힌트와 별도 앨범 선택 입력 제공 |
| 옷 이름 제안 | 색상·카테고리 기반 자동 제안, 태그 변경 추적, 직접 수정 후 값 보존 |
| 옷 사진 필수 | 무사진 제출 오류, DB 저장 0회; 정상 카메라/앨범 사진 저장 |
| 저장 잠금 | 같은 이벤트 턴 form 이중 제출 후 IndexedDB 옷 레코드 정확히 1개 |
| 계절 터치 대상 | 390px 옷 등록 폼의 5개 연결 label 실제 높이 모두 44px 이상 |
| 한국어 IME | `compositionstart → composing input → compositionend → final input` 뒤 동일 노드 연결·포커스·caret·최종값 유지, 저장 결과 1개 |
| IndexedDB 새로고침 | 옷 3개와 착장 저장 후 새로고침 조회 성공 |
| 핵심 흐름 | 옷 3개 → 착장 → 동일 조합 경고 → override 저장 → 다른 추천 성공 |
| 빈 옷장·빈 기록·추천 없음 | 각 빈 상태와 다음 행동 정상 표시 |
| 원피스만 | 원피스 단독 추천 성공 |
| 후보 탐색 | 20개 초과 후보 반환, 3개 단위 다음 후보, 소진 문구, 처음부터 보기 |
| 추천 안내·내비게이션 | 계절/색상 확인 문구 표시, 하단 탭 3개와 헤더 설정 접근 |
| 후보 없음 안내 | 부족 핵심 카테고리 또는 과거 핵심 조합 제외 원인 표시 |
| 초안·착장 수정 | 초안 수정, DRAFT→CONFIRMED 확정, 새로고침 지속 |
| 삭제된 아이템 기록 | `deletedAt` 레코드는 보존되고 옷장·새 선택·추천에서는 제외되며 과거 snapshot 이름은 유지 |
| 전체 삭제 | 확인 문구 입력 후 삭제, 새로고침 뒤 빈 상태 유지 |
| offline shell | production service worker 준비 후 네트워크 차단·새로고침에서 앱 셸 표시 |
| 외부 요청 | 핵심 production 흐름에서 same-origin 밖 요청 0건 |

390/768/1440 스크린샷을 직접 시각 검토했다. 텍스트 잘림·겹침·수평 잘림은 발견되지 않았다. 390 추천 화면의 하단 탭, 카드, CTA도 읽고 누를 수 있는 크기로 표시됐다.

## 5. 보안·개인정보 점검

- 소스와 설정에서 사용자 데이터용 `fetch`, XHR, WebSocket, beacon을 찾지 못했다.
- 외부 분석·광고·오류 추적 SDK와 하드코딩 비밀값을 찾지 못했다.
- production 핵심 흐름의 실제 network 기록에서 외부 origin 요청은 0건이었다.
- 사용자 이름·메모·만남명은 React text rendering을 사용한다. `dangerouslySetInnerHTML` 또는 직접 `innerHTML` 사용을 찾지 못했다.
- 이미지 입력은 allowlist, 25 MiB 상한, 디코딩 실패, 출력 인코딩 실패를 처리한다.
- 이미지 표시는 data URL 기반이며 이미지용 object URL은 만들지 않는다. JSON 내보내기의 Blob object URL은 다운로드 시작 후 revoke한다.
- 전체 삭제는 IndexedDB 5개 store와 앱 소유 Cache Storage prefix를 정리한다.
- JSON 내보내기는 이미지 data URL과 착장 snapshot 사진을 제외하고 `containsImages:false`를 기록한다.

## 6. 산출물

- `QA_REPORT.md` — 본 보고서
- `artifacts/qa/playwright-results.json` — Playwright 기계 판독 결과
- `artifacts/qa/playwright-report/` — HTML QA 보고서
- `artifacts/qa/390-core-flow.png`
- `artifacts/qa/390-garment-camera-form.png`
- `artifacts/qa/390-empty-closet.png`
- `artifacts/qa/768-empty-closet.png`
- `artifacts/qa/1440-empty-closet.png`
- `artifacts/qa/390-offline-shell.png`

## 7. 변경 파일

- `src/image.ts`
- `src/image.test.ts`
- `src/App.tsx`
- `src/App.failure.test.tsx`
- `src/App.errors.test.tsx`
- `src/domain.ts`
- `src/domain.test.ts`
- `src/privacy.test.ts`
- `e2e/qa.spec.ts`
- `playwright.qa.config.ts`
- `playwright.config.ts`
- `package.json`
- `README.md`
- `QA_REPORT.md`
- `artifacts/qa/*`

## 8. 남은 제한과 비차단 권고

1. 자동 QA는 macOS Chromium이다. 실제 iPhone Safari/홈 화면 앱과 Android Chrome의 카메라 권한 UI, HEIC/HEIF, EXIF 1/3/6/8 방향은 실기기에서 아직 검증하지 않았다.
2. 파일 선택 취소는 Playwright에서 빈 파일 목록으로 재현했다. 운영체제의 실제 카메라/앨범 picker 취소 UI 자체는 자동화하지 않았다.
3. 현재 HTML에 명시적 CSP가 없다. 사용자 동적 텍스트는 React escaping으로 방어되고 외부 요청도 없지만, 공개 배포 전 정적 호스트 응답 헤더로 `default-src 'self'`, `img-src 'self' data: blob:`, `object-src 'none'`, `base-uri 'self'` 등 방어 심화를 권장한다.
4. 개발 도구 audit high 11건은 production 취약점 0과 구분해 후속 의존성 업데이트에서 처리해야 한다.
5. 실제 공개 URL 검증은 배포 금지 조건 때문에 수행하지 않았다.
6. 이름 제안은 사진 픽셀을 인식하는 AI가 아니라 사용자가 선택한 색상·카테고리 기반 로컬 규칙이다. 사진 내용 기반 분류는 이번 범위에 포함하지 않았다.

## 9. 최종 판정

요구된 로컬 production artifact 범위에서는 **수정 후 통과**다. 필수 기능·브라우저 흐름·오프라인 셸·개인정보 경계·production build를 독립적으로 재현했다. 다만 실제 모바일 출시 판정에는 8절 1번의 실기기 카메라/HEIC/EXIF 검증이 추가로 필요하다.

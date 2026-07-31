# 안겹쳐 앱 최종 인수 보고

- 작성일: 2026-07-31 KST
- 대상 저장소: `/Users/damandeul/다만들/ai-company/outfit-memory-app`
- 범위: 로컬 우선 모바일 PWA MVP
- 최종 판정: **PASS — 로컬 production artifact 인수 가능**
- 외부 배포·결제·게시: **미실행**
- 정확한 release Git SHA와 ZIP SHA-256: 커밋 후 생성되는 외부 release manifest 참조

## 1. 결론

초기 제품 명세와 독립 적대 감수에서 확인된 P0 계약을 구현하고 영구 회귀 테스트로 편입했다. 표준 단위·정적·production build·모바일 E2E·fresh production QA·production dependency audit가 모두 통과했다.

앱은 스마트폰 카메라/앨범에서 옷 사진을 등록하고, 사진을 기기 안에서 재인코딩한 뒤 사용자가 선택한 색상과 카테고리로 이름을 제안한다. 사진 픽셀을 외부 AI로 보내거나 AI 이미지 판독을 하지 않는다.

## 2. 구현 범위

- 로그인 없는 React 19 + TypeScript + Vite PWA
- IndexedDB 로컬 저장과 새로고침 지속성
- 옷 사진 필수 등록, 후면 카메라 촬영 힌트, 별도 앨범 선택
- JPEG/PNG/WebP/HEIC/HEIF allowlist, 25 MiB 상한, 디코딩 오류 복구
- 방향 반영·canvas 재인코딩·원본 EXIF 바이트 제거·WebP/JPEG 압축
- 색상+카테고리 기반 로컬 이름 제안, 최신 태그 추적, 수동 수정 보존
- 옷 등록·수정·보관·검색·필터·`deletedAt` 소프트 삭제
- 착장 기록·사진·snapshot·중복 경고·명시적 override
- 추천 초안 저장, 초안 수정, 실제 착용 확정, 확정 착장 수정
- 같은 만남의 대상일 이전 확정 기록 최근 4회 계산
- 계절 fallback·계절/색상 확인 안내를 포함한 결정적 사전식 추천
- 핵심 아이템 기준 색상 조화와 과거 핵심 조합 제외
- 모든 후보의 3개 단위 탐색, 소진 안내, 처음부터 보기
- 후보가 없을 때 부족 핵심 카테고리 또는 과거 핵심 조합 제외 원인 안내
- 사진 제외 JSON 메타데이터 내보내기와 확인 문구 기반 전체 삭제
- 명세에 맞춘 하단 내비게이션 3개와 헤더 설정 접근
- 390/768/1440 반응형, 44px 터치 영역, PWA 오프라인 앱 셸

## 3. 독립 적대 감수에서 발견된 P0 7건과 조치

| 계약 | 조치 | 회귀 근거 |
|---|---|---|
| 계절 후보가 없을 때 fallback | 계절로 후보를 제거하지 않고 불일치 수를 정렬·이유에 반영 | `product-contract.test.ts` |
| 추천 정렬 계약 | 최근 핵심 등장 총횟수 → 등장 핵심 수 → 계절 불일치 → 핵심 색상 → last worn → ID 사전식 비교 | `product-contract.test.ts` |
| 핵심 색상 판정 | 신발 등 보조 아이템을 색상 조화 판정에서 제외 | `product-contract.test.ts` |
| 옷 사진 필수 | 사진 없으면 인라인 오류, IndexedDB write 0회 | `product-contract.spec.ts` |
| 추천 pagination | 3개 단위 `다른 후보 보기`, 소진 후 `처음부터 보기` | `product-contract.spec.ts` |
| 초안 확정·착장 수정 | 같은 ID로 수정, DRAFT→CONFIRMED 원자 이동, 새로고침 지속 | `product-contract.spec.ts` |
| 옷 소프트 삭제 | `deletedAt`·ARCHIVED 기록 보존, 새 옷장·선택·추천 제외, 과거 snapshot 유지 | `product-contract.test.ts`, `db.test.ts` |

## 4. 최종 실측 품질 게이트

| 게이트 | 실제 결과 |
|---|---|
| `npm test -- --reporter=verbose` | **8 files, 38/38 통과** |
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과, 36 modules |
| PWA build | precache 7 entries / **230.08 KiB** |
| `npm run test:e2e` | 모바일 Chromium **6/6 통과** |
| `npm run test:qa` | fresh production Chromium **7/7 통과** |
| `npm audit --omit=dev` | production 취약점 **0** |

기본 E2E는 다른 포트 서버를 재사용하지 않고 현재 소스에서 시작한 서버만 검사한다. production QA는 매번 fresh build 후 별도 origin에서 실행한다.

## 5. 개인정보·보안 경계

- 사용자 사진·옷 이름·만남명·메모를 외부로 전송하는 코드가 없다.
- 로그인, 분석, 광고, 오류 추적, 외부 추천 API와 외부 폰트를 사용하지 않는다.
- 이름 제안은 사진 분석 AI가 아니라 사용자가 선택한 태그를 조합하는 로컬 규칙이다.
- 사용자 문자열은 React text rendering을 사용하며 HTML 주입 sink를 사용하지 않는다.
- JSON export는 사진 data URL을 제외하고 `containsImages:false`를 기록한다.
- 전체 삭제는 IndexedDB 5개 store와 앱 소유 Cache Storage를 정리한다.

## 6. 실행과 검증

```bash
cd /Users/damandeul/다만들/ai-company/outfit-memory-app
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run test:qa
npm audit --omit=dev
```

개발 서버:

```bash
npm run dev
```

기본 주소: `http://127.0.0.1:5173`

## 7. 비차단 실기기 제한

자동 QA는 macOS Chromium에서 수행했다. 다음 항목은 실제 iPhone/Android 비공개 HTTPS 환경에서 별도 확인이 필요하다.

- 카메라 권한·운영체제 picker·취소 UI
- 실제 HEIC/HEIF 사진과 EXIF 방향 1/3/6/8 표본
- 홈 화면 설치·service worker 업데이트 UX
- 저메모리 기기의 25 MiB 입력 디코딩 순간 메모리 압력
- 장기간·대규모 옷장의 IndexedDB 용량·eviction·성능
- 공개 호스트의 HTTPS, CSP, 접속 로그 정책

브라우저 데이터 삭제·사생활 보호 모드 종료·기기 저장공간 정리 시 기록이 사라질 수 있다. JSON 내보내기는 사진 복원용 전체 백업이 아니다.

## 8. 승인 경계

이 판정은 **로컬 production artifact 인수 PASS**다. 공개 배포는 실행하지 않았으며, 실제 스마트폰 비공개 QA 결과를 확인한 뒤 대표님이 별도로 승인해야 한다. 외부 AI 사진 분석, 결제, 외부 게시도 이번 범위에서 실행하지 않았다.

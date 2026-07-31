# 안겹쳐 앱 최종 인수 보고

- 작성일: 2026-07-31 KST
- 대상: `/Users/damandeul/다만들/ai-company/outfit-memory-app`
- 현재 판정: **로컬 production MVP 인수 통과**
- 공개 배포: **미실행 — 대표님의 별도 승인 필요**

## 1. 결론

같은 사람들을 일주일에 한 번 만나는 댄스강사가 지난 착장과 겹치지 않도록 확인하고, 보유한 옷만으로 다음 코디를 고르는 모바일 우선 PWA를 구현했다.

독립 QA에서 발견한 IndexedDB 실패 처리, 착장·옷 사진 처리 중 저장 경쟁, 중복 경고 override 사진 경쟁, 중복 저장 경쟁 조건, 빈 핵심 조합 오경고, stale production QA와 무관한 서버 재사용 위험을 회귀 테스트 우선으로 수정했다. 수정 후 현재 코드에서 모든 자동·브라우저 품질 게이트가 통과했다.

## 2. 구현 기능

- 스마트폰 후면 카메라 촬영 우선 입력과 앨범 선택 대체 경로
- 옷 사진, 이름, 카테고리, 색상, 계절, 메모 등록
- 사진 처리 후 현재 색상·카테고리 기반 이름 자동 제안(직접 수정 시 자동 덮어쓰기 중단)
- 옷 수정, 활성/보관 전환, 삭제, 카테고리 필터, 한국어 이름 검색
- 옷별 마지막 착용일 표시
- 날짜, 만남/수업명, 선택 아이템, 메모, 선택 사진으로 착장 기록
- 같은 만남에서 완전히 동일한 조합과 핵심 아이템 조합 경고
- 최근 네 번의 같은 만남에서 사용한 아이템 표시
- 경고 후 사용자가 선택하면 그대로 저장 가능
- 삭제한 옷도 과거 착장 snapshot 이름으로 유지
- 활성 옷만으로 상의+하의 또는 원피스 중심 코디 추천
- 과거 핵심 동일 조합 제외, 최근 사용 여부·마지막 착용일·추천 이유 표시
- 추천 결과를 다음 착장 초안으로 연결
- 사진을 제외한 JSON 메타데이터 내보내기
- 확인 문구 입력 후 IndexedDB와 앱 캐시 전체 삭제
- PWA manifest, service worker, 오프라인 앱 셸

## 3. 개인정보·저장 원칙

- 사진과 기록은 현재 기기의 브라우저 IndexedDB에 저장한다.
- 로그인, 분석 SDK, 광고, 외부 추천 API가 없다.
- production 핵심 흐름에서 same-origin 밖 네트워크 요청은 0건이었다.
- 외부 폰트와 외부 이미지를 사용하지 않는다.
- 이미지 입력은 JPEG, PNG, WebP, HEIC, HEIF allowlist와 25 MiB 상한을 적용한다.
- 이미지는 브라우저 안에서 방향을 반영해 WebP/JPEG로 재인코딩하므로 원본 EXIF 바이트를 저장하지 않는다.
- JSON 내보내기는 사진을 포함하지 않으며 사진 복원용 백업이 아니다.
- 브라우저 데이터 삭제, 기기 저장공간 정리, 사생활 보호 모드 종료, 기기 분실 시 기록이 사라질 수 있다.

## 4. 최종 실측 품질 게이트

잠금파일 기준 `npm ci` 후 현재 코드에서 직접 실행했다.

| 게이트 | 결과 |
|---|---|
| Vitest | 7 files, **32/32 통과** |
| lint | 통과 |
| TypeScript typecheck | 통과 |
| production build | 통과, 36 modules |
| PWA build | precache 7 entries / 227.04 KiB |
| 기본 모바일 E2E | **1/1 통과** |
| fresh production 독립 QA | **7/7 통과** |
| production dependency audit | 취약점 0 |

production 독립 QA는 실행할 때마다 먼저 production build를 새로 만든다.

## 5. 브라우저 QA 범위

- 390×844, 768×900, 1440×1000
- 수평 overflow 없음
- 표시된 입력·버튼 44px 이상
- 콘솔 오류와 page error 없음
- 파일 선택 취소 후 입력 유지
- 카메라 입력 `capture="environment"`와 별도 앨범 입력 제공
- 사진 처리 후 이름 자동 제안, 태그 변경 추적, 직접 수정값 보존
- 한국어 IME 조합 중 동일 DOM 노드·포커스·caret·최종값 유지
- 옷 3개 → 착장 → 동일 조합 경고 → 다른 추천 → 새로고침 유지
- 빈 옷장, 원피스 단독 추천, 삭제된 옷의 과거 기록 유지
- 전체 삭제 후 새로고침에서도 빈 상태 유지
- production service worker 오프라인 재실행
- 외부 origin 요청 0건

기계 판독 결과와 화면 증거는 `artifacts/qa/`와 `qa-evidence/`에 있다.

## 6. 실행 방법

```bash
cd /Users/damandeul/다만들/ai-company/outfit-memory-app
npm ci
npm run dev
```

개발 서버 기본 주소는 `http://127.0.0.1:5173`이다.

production 확인:

```bash
npm run build
npm exec vite preview -- --host 127.0.0.1 --port 4174
```

production 주소는 `http://127.0.0.1:4174`다.

전체 검증:

```bash
npm test
npm run lint
npm run typecheck
npm run test:e2e
npm run test:qa
npm audit --omit=dev
```

## 7. 남은 제한

1. 자동 QA는 macOS Chromium에서 수행했다. 실제 iPhone Safari/홈 화면 앱과 Android Chrome의 카메라 권한 UI는 아직 실기기 검증 전이다.
2. HEIC/HEIF와 EXIF 회전 1/3/6/8은 코드상 복구 경로가 있지만 실제 목표 휴대전화 사진 표본으로 확인해야 한다.
3. 현재 사진은 garment/outfit 레코드의 압축 data URL로 저장한다. 옷장이 매우 커지면 별도 Blob store로 분리하는 후속 최적화가 필요할 수 있다.
4. JSON 내보내기는 사진 없는 메타데이터만 제공한다. 기기 교체용 완전 백업·복원은 아직 없다.
5. 전체 npm audit의 개발 도구 체인에는 high 경고가 남아 있지만 production 의존성 audit는 0이다. 강제 major downgrade/update는 적용하지 않았다.
6. 공개 배포 시에는 호스팅 접속 로그와 CSP 응답 헤더를 실제 서비스 환경 기준으로 검증해야 한다.
7. 현재 이름 제안은 사진 자체를 AI로 판독하는 기능이 아니라, 기기 안에서 사용자가 선택한 색상·카테고리를 조합하는 안전한 로컬 제안이다. 사진 내용 기반 자동 분류는 온디바이스 모델 또는 외부 AI API에 대한 별도 개인정보 결정을 거쳐야 한다.

## 8. 다음 단계

로컬 production MVP는 인수 가능하다. 실제 아내분 휴대전화에서 내부 테스트하려면 다음 순서가 안전하다.

1. 비공개 HTTPS 테스트 URL 배포 승인
2. iPhone 또는 Android에서 옷 사진·착장 사진 10장 내외 등록
3. 같은 수업명으로 주간 착장 기록과 중복 경고 확인
4. 카메라 취소, HEIC, 회전 사진, 오프라인 재실행 확인
5. 내부 테스트가 통과한 뒤 공개 배포 또는 사진 내용 기반 자동 분류 AI 여부 결정

공개 배포와 외부 AI API 연결은 이 인수에 포함하지 않았으며 대표님의 별도 승인이 필요하다.

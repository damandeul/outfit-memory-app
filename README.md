# 안겹쳐

같은 사람들을 다시 만날 때 이전 착장과 겹치지 않도록 돕는 로컬 우선 모바일 PWA입니다. 사진과 메타데이터는 브라우저 IndexedDB에만 저장하며 외부 API, 로그인, 분석 SDK를 사용하지 않습니다.

## 공개 앱

https://damandeul.github.io/outfit-memory-app/

`main` 브랜치에 푸시하면 `.github/workflows/deploy-pages.yml`이 검증·빌드 후 GitHub Pages에 배포합니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 엽니다.

## 품질 게이트

```bash
npm test
npm run test:e2e
npm run test:qa
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

## 핵심 기능

- 스마트폰 후면 카메라 촬영과 별도 앨범 선택
- 필수 옷 사진·이름·카테고리·색상·계절·메모 등록, 수정, 보관, `deletedAt` 소프트 삭제
- 사진 처리 후 색상·카테고리 기반 이름 제안, 직접 수정값 보존
- 날짜·만남·선택 아이템·선택 사진 기반 착장 기록
- 동일 조합/핵심 동일 조합 경고와 명시적 저장 override
- 같은 만남의 대상일 이전 최근 4회 사용 표시
- 활성 옷 기반 계절 fallback·사전식 결정적 추천, 계절·색상 확인 안내, 과거 같은 핵심 조합 제외, 추천 이유·마지막 착용 표시
- 전체 추천 후보의 3개 단위 탐색, 소진 안내와 처음부터 보기
- 후보가 없을 때 부족 핵심 카테고리 또는 과거 핵심 조합 제외 원인 안내
- 추천을 착장 초안으로 저장, 초안 수정·실제 착용 확정, 확정 착장 수정
- 기록 갤러리, 삭제된 옷 snapshot label 보존
- 사진 없는 등록 차단, 파일 선택 취소 복구, 한국어 IME 조합 중 Enter 제출 방지
- JSON 메타데이터 내보내기(사진 제외), 확인 문구 기반 전체 삭제
- 하단 내비게이션 3개와 헤더 설정 접근, 390px/768px 반응형, 44px 이상 터치 영역, PWA 오프라인 앱 셸

## 개인정보

사진은 긴 변 최대 1200px로 방향을 반영해 WebP/JPEG로 압축한 뒤 IndexedDB에 저장합니다. 앱은 사용자 데이터에 대한 네트워크 요청을 만들지 않으며, 외부 폰트·이미지·분석 SDK를 불러오지 않고 시스템 글꼴만 사용합니다.

브라우저 데이터 삭제 또는 사생활 보호 모드 종료 시 기록이 사라질 수 있습니다. 설정에서 사진이 제외된 JSON 메타데이터를 내려받을 수 있습니다.

## 산출물

- `dist/`: 정적 production build 및 service worker
- `qa-evidence/390-recommendation.png`
- `qa-evidence/768-recommendation.png`
- `BUILD_REPORT.md`: TDD 및 검증 기록

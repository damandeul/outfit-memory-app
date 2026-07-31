# 안겹쳐 — 로컬 데이터·추천 규칙·운영비 계약

확인일: 2026-07-30 KST
대상: 로그인·서버·분석 도구·외부 사진 전송이 없는 로컬 우선 PWA MVP

## 0. 결론

1. 메타데이터와 사진 Blob을 분리한 IndexedDB v1을 사용한다. 목록 조회 때 원본 Blob을 읽지 않는다.
2. 옷 사진은 긴 변 1200px, 착장 사진은 1600px로 축소하고 WebP 품질 0.80을 우선한다. 320px 썸네일을 별도로 만든다. 원본은 성공적으로 변환된 뒤 폐기한다.
3. 동일 조합은 `중복 제거 → ID 정렬 → | 연결`한 `combinationKey`의 완전 일치로 판정한다. 저장을 막지 않고 강한 경고만 표시한다.
4. 추천은 활성 옷으로 만든 유효 조합에서 과거 완전 동일 조합을 제외한 뒤, 최근 4회 미착용을 가장 크게 반영하는 정수 점수로 정렬한다. 난수를 쓰지 않는다.
5. 로컬 단독 MVP의 외부 API·서버 직접 변동비는 0원이다. 단, 개발 시간·기기·전기·수동 지원은 0이 아니다. 공개 서비스로 바꾸기 전에는 실제 사용자 수와 이미지 양을 먼저 측정한다.
6. IndexedDB는 기본적으로 best-effort 저장소다. `navigator.storage.estimate()`로 사용량을 표시하고, 사용자 동작으로 `persist()`를 요청하며, JSON 메타데이터 내보내기와 전체 삭제를 제공한다.

---

## 1. 근거·가정·권고 구분

### 1.1 확인된 사실

- 브리프의 MVP는 사진 포함 IndexedDB, 외부 전송 없음, 로그인·분석 도구 없음, 동일 조합 경고, 최근 4회 덜 입은 옷 우선 추천을 요구한다.
- IndexedDB object store는 키 순서로 레코드를 저장하며 빠른 삽입·조회·순차 조회를 지원한다. `add()`와 `put()`은 값의 structured clone을 저장한다.
- 브라우저 저장소는 origin 단위로 관리되며 IndexedDB·Cache API 등의 실제 한도는 브라우저별 저장 관리 정책에 달려 있다.
- origin 데이터는 기본적으로 best-effort다. 영구 저장 승인은 `navigator.storage.persist()`로 요청할 수 있지만 승인 여부는 브라우저가 결정한다.
- `navigator.storage.estimate()`는 현재 origin의 대략적인 `usage`와 `quota`를 제공한다. 숫자는 정확한 디스크 계측값이 아닐 수 있으므로 표시값을 보장 용량으로 해석하면 안 된다.
- `estimate()`와 `persist()`는 secure context에서 사용하는 API다. 구현은 `navigator.storage`와 각 메서드의 존재를 확인하고, 미지원 환경에서는 용량/영구 보관 상태를 `알 수 없음`으로 표시해야 한다.
- `canvas.toBlob()`은 PNG를 필수 지원하고, 여러 브라우저가 JPEG/WebP를 지원한다. 손실 형식은 0~1 사이 품질 값을 받을 수 있다. 지원되지 않는 형식을 요청하면 PNG로 돌아갈 수 있으므로 결과 Blob의 `type`을 확인해야 한다.
- 사생활 보호 모드의 저장량은 다를 수 있고, 세션 종료 시 데이터가 삭제될 수 있다.

### 1.2 이 문서의 제품 가정

- 첫 사용자는 한 명 또는 한 가구이며, 한 origin을 여러 사람이 공동 편집하지 않는다.
- 한 착장의 연결 아이템 수는 보통 1~8개이고, 옷장은 1,000개 미만이다. 이는 판매량이나 실제 사용자 수가 아니라 알고리즘 상한을 정하기 위한 설계 가정이다.
- 만남/수업명이 같으면 같은 사람들을 만나는 맥락일 가능성이 높다. 앱은 이름을 정규화한 `contextKey`로 최근 4회를 고르되, 이름이 비어 있으면 전체 기록을 사용한다.
- 사용자가 직접 고른 카테고리·주색상·계절이 추천 입력의 진실 원천이다. 사진 자동 인식은 하지 않는다.
- 사진 원본 보존보다 빠른 조회와 로컬 용량 절약을 우선한다.

### 1.3 구현 권고

아래의 스키마, 이미지 한도, 중복 규칙, 추천 공식, tie-break는 구현자가 임의로 바꾸지 않는 v1 계약으로 사용한다. 변경하려면 DB 버전과 `recommendationRuleVersion`을 올리고 회귀 테스트를 추가한다.

---

## 2. IndexedDB v1 데이터 모델

### 2.1 공통 규칙

- DB 이름: `angyeopchyeo`
- DB 버전: `1`
- ID: `crypto.randomUUID()`로 생성한 문자열
- 시각: UTC ISO 8601 문자열, 예: `2026-07-30T14:10:00.000Z`
- 사용자 달력 날짜: 로컬 날짜 `YYYY-MM-DD`; UTC 변환으로 날짜를 바꾸지 않는다.
- 배열은 저장 전에 중복 제거하고 코드/ID 오름차순으로 정렬한다.
- 알 수 없는 필드는 가져오기에서 무시하되, 필수 필드 누락·타입 오류 레코드는 거절한다.
- 모든 다중 store 변경은 변환/압축을 transaction 밖에서 끝낸 뒤 하나의 `readwrite` transaction으로 커밋한다.

### 2.2 TypeScript 계약

```ts
type GarmentCategory =
  | "TOP" | "BOTTOM" | "DRESS" | "OUTER"
  | "SHOES" | "ACCESSORY";

type ColorCode =
  | "BLACK" | "WHITE" | "GRAY" | "BEIGE" | "BROWN"
  | "NAVY" | "BLUE" | "GREEN" | "RED" | "PINK"
  | "PURPLE" | "YELLOW" | "ORANGE" | "METALLIC" | "MULTI";

type SeasonCode = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER" | "ALL";
type GarmentStatus = "ACTIVE" | "ARCHIVED";

type MediaRole = "GARMENT_MAIN" | "OUTFIT_FULL";

interface Garment {
  id: string;
  name: string;                 // trim 후 1..60자
  nameSearch: string;           // normalizeSearch(name)
  category: GarmentCategory;
  color: ColorCode;
  seasons: SeasonCode[];        // 중복 제거/정렬, 1개 이상
  note: string;                 // trim 후 0..500자
  status: GarmentStatus;
  mainMediaId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: never;            // v1은 soft-delete가 아닌 실제 삭제
}

interface MediaAsset {
  id: string;
  role: MediaRole;
  fullBlob: Blob;
  thumbBlob: Blob;
  fullMime: "image/webp" | "image/jpeg";
  thumbMime: "image/webp" | "image/jpeg";
  fullWidth: number;
  fullHeight: number;
  thumbWidth: number;
  thumbHeight: number;
  fullBytes: number;
  thumbBytes: number;
  sourceBytes: number | null;
  createdAt: string;
}

interface OutfitItemSnapshot {
  garmentId: string;            // 삭제 후에도 과거 ID 유지
  name: string;
  category: GarmentCategory;
  color: ColorCode;
}

interface Outfit {
  id: string;
  localDate: string;
  contextName: string;          // trim 후 0..80자
  contextKey: string;           // normalizeContext(contextName)
  note: string;                 // trim 후 0..500자
  fullMediaId: string | null;
  items: OutfitItemSnapshot[];  // garmentId 기준 중복 제거/정렬, 1개 이상
  garmentIds: string[];         // items에서 파생, 정렬
  combinationKey: string;       // garmentIds.join("|")
  ruleVersion: 1;
  createdAt: string;
  updatedAt: string;
}

interface OutfitDraft {
  id: "next-outfit";
  targetLocalDate: string | null;
  contextName: string;
  garmentIds: string[];
  updatedAt: string;
}

interface AppSetting {
  key: "schemaVersion" | "recommendationRuleVersion" | "lastExportAt";
  value: number | string | null;
}
```

### 2.3 object store와 index

| Store | keyPath | index | 용도 |
|---|---|---|---|
| `garments` | `id` | `byStatus`, `byCategory`, `byUpdatedAt`, `byNameSearch` | 옷장 목록·필터 |
| `media` | `id` | `byRole`, `byCreatedAt` | 사진 Blob 격리 |
| `outfits` | `id` | `byLocalDate`, `byContextKey`, `byCombinationKey` | 기록·중복 탐색 |
| `drafts` | `id` | 없음 | 다음 만남 초안 1개 |
| `settings` | `key` | 없음 | 규칙·내보내기 상태 |

`outfits.byLocalDate`는 같은 날짜가 가능하므로 unique가 아니다. `byCombinationKey`도 반복 착용을 허용하므로 unique가 아니다.

### 2.4 정규화 함수

```ts
function normalizeSearch(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function normalizeContext(s: string): string {
  return normalizeSearch(s); // 빈 이름은 ""
}

function canonicalIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function combinationKey(ids: string[]): string {
  return canonicalIds(ids).join("|");
}
```

ID에 `|`를 쓰지 않는 UUID를 사용하므로 연결 문자열은 모호하지 않다. v1 규모에서는 별도 해시가 필요 없다.

### 2.5 쓰기 계약

옷 저장:
1. 입력 검증
2. 선택 사진이 있으면 이미지 파이프라인 완료
3. `media + garments` 한 transaction으로 저장
4. 수정으로 사진이 교체되면 새 media와 garment 참조를 먼저 커밋한 후, 별도 transaction으로 이전 media를 삭제한다. 실패한 정리는 다음 시작 때 고아 media 청소로 복구한다.

착장 저장:
1. 현재 존재하는 garment를 읽어 snapshot 생성
2. 1개 이상인지 검증
3. 이미지 변환
4. `media + outfits + drafts` 한 transaction에서 착장 저장 및 사용한 초안 삭제
5. 중복이어도 저장 허용

옷 삭제:
- `garments`와 그 `mainMediaId`의 media를 삭제한다.
- 과거 `outfits.items`는 수정하지 않는다. 화면은 garment 조회가 실패하면 snapshot 이름·카테고리·색상을 표시하고 “삭제된 옷” 배지를 붙인다.
- 과거 중복 판정에는 snapshot의 `garmentId`를 계속 사용한다.
- 초안에 삭제 ID가 있으면 제거한다. 제거 후 0개면 빈 초안으로 남긴다.

고아 media 청소:
- 앱 시작 시 최대 하루 한 번, garments/outfits에서 참조하는 media ID 집합을 만든 뒤 참조되지 않은 media를 삭제한다.
- 100개 단위 transaction으로 나눠 UI 정지를 피한다.

---

## 3. 사진 용량·압축·보관 규칙

### 3.1 결정값

| 역할 | 긴 변 최대 | 우선 형식/품질 | 결과 hard cap | 썸네일 |
|---|---:|---|---:|---|
| 옷 사진 | 1200px | WebP 0.80 | 800 KiB | 320px, WebP 0.72, 120 KiB |
| 착장 전체 사진 | 1600px | WebP 0.80 | 1,200 KiB | 320px, WebP 0.72, 150 KiB |

- 입력 파일 hard cap: 25 MiB. 초과하면 읽기 전에 거절하고 다시 선택을 안내한다.
- 입력 MIME 허용: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`; 단 HEIC/HEIF 디코딩은 브라우저 의존이므로 디코딩 실패 시 JPEG/PNG로 다시 선택하도록 안내한다.
- 출력 `blob.type === "image/webp"`일 때만 WebP로 인정한다. 아니면 JPEG 0.82로 재인코딩한다.
- hard cap 초과 시 품질을 `0.72 → 0.64 → 0.56`으로 내린다. 그래도 초과하면 긴 변을 20%씩 줄여 최소 800px(옷), 1000px(착장)까지 재시도한다. 이후에도 초과하면 저장하지 않는다.
- 투명 PNG는 흰 배경에 합성 후 JPEG/WebP로 저장한다. 이 앱 사진은 투명도 보존 가치보다 용량 절약이 크다는 제품 가정이다.
- 원본 Blob은 저장하지 않는다. 변환 성공과 DB commit이 끝나면 File 참조 및 object URL을 해제한다.

### 3.2 방향 보정·실패 처리

1. `createImageBitmap(file, { imageOrientation: "from-image" })`를 우선 시도한다.
2. 실패하면 object URL을 `<img>`로 디코딩한다.
3. canvas에 비율 유지 축소 후 `toBlob()`한다.
4. 결과가 `null`, 폭/높이 0, 디코딩 오류면 DB transaction을 열지 않는다.
5. iOS/Android 실제 사진 중 EXIF 회전 1/3/6/8 표본으로 사람이 보는 방향이 맞는지 E2E/수동 검증한다. API 지원만으로 방향 보정을 성공했다고 간주하지 않는다.
6. 카메라 취소(`files.length === 0`)는 오류 toast를 띄우지 않고 기존 폼과 기존 사진을 유지한다.

### 3.3 용량 예시 — 추정값

아래는 실제 압축률 보장이 아닌 예산 시나리오다.

- 압축 이미지 평균 0.5 MB 가정: 100장 50 MB, 300장 150 MB, 1,000장 500 MB
- 압축 이미지 평균 0.8 MB 가정: 300장 240 MB, 1,000장 800 MB
- 썸네일·메타데이터·PWA Cache는 여기에 추가된다.

따라서 “몇 장까지 저장 가능”을 고정 숫자로 약속하지 않는다. 기기·브라우저·남은 디스크마다 quota가 다르다.

### 3.4 quota 운영 규칙

```ts
interface StorageHealth {
  usage: number | null;
  quota: number | null;
  ratio: number | null;
  persistent: boolean | null;
}
```

- 설정 화면 진입과 사진 저장 직전에 `navigator.storage.estimate()`를 호출한다.
- 경고 조건: `usage / quota >= 0.80` 또는 추정 잔여량이 `max(20 MiB, pendingBlobBytes * 2)` 미만.
- 경고여도 저장 시도는 허용한다. 실제 `QuotaExceededError`가 최종 진실이다.
- `QuotaExceededError` 시 transaction 전체를 abort하고 “사진을 저장하지 못했어요. 오래된 사진/기록 삭제 또는 메타데이터 백업 후 다시 시도해 주세요.”라고 표시한다.
- 첫 착장 저장 후 설정 화면에서 사용자가 누르는 “이 기기에 안전하게 보관 요청” 버튼으로만 `persist()`를 호출한다. 반환값이 false면 실패가 아니라 “브라우저가 영구 보관을 허용하지 않음” 상태로 표시한다.
- 사생활 보호 모드로 보이는 경우를 앱이 추측하지 않는다. 대신 “브라우저 데이터 삭제·사생활 보호 모드 종료 시 기록이 사라질 수 있음”을 항상 백업 안내에 적는다.

---

## 4. 동일 조합·최근 4회 경고

### 4.1 완전 동일 조합

```ts
function exactDuplicates(candidateIds: string[], outfits: Outfit[]): Outfit[] {
  const key = combinationKey(candidateIds);
  if (!key) return [];
  return outfits.filter(o => o.combinationKey === key);
}
```

판정 계약:
- 순서는 무시한다: `[상의A, 하의B]`와 `[하의B, 상의A]`는 동일하다.
- 중복 선택은 제거한다.
- 액세서리·신발을 포함해 저장된 모든 연결 아이템 집합이 같아야 완전 동일이다.
- 아이템이 하나라도 추가/삭제되면 완전 동일이 아니다.
- 삭제된 옷도 과거 snapshot ID로 비교한다.
- 날짜·메모·사진·만남명은 완전 동일 여부에 영향을 주지 않는다.
- 매치가 1개 이상이면 강한 경고. 가장 최근 동일 기록의 날짜와 만남명을 보여주되 저장 버튼은 활성 상태로 둔다.

### 4.2 최근 4회 범위

```ts
function recentFour(
  outfits: Outfit[], targetContextName: string, editingOutfitId?: string
): Outfit[] {
  const key = normalizeContext(targetContextName);
  const pool = outfits.filter(o => o.id !== editingOutfitId);
  const scoped = key ? pool.filter(o => o.contextKey === key) : pool;
  return [...scoped]
    .sort((a, b) =>
      b.localDate.localeCompare(a.localDate) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id))
    .slice(0, 4);
}
```

- target context가 있으면 같은 context의 최근 4회만 사용한다.
- context가 비어 있으면 전체 착장의 최근 4회를 사용한다.
- 같은 날짜 여러 기록은 `createdAt`, 그다음 `id` 내림차순으로 결정한다.
- 착장 수정 중에는 자기 자신을 비교 대상에서 제외한다.
- 최근 4회 중 한 번이라도 나온 선택 아이템에 “최근 N번째 만남에 착용”을 표시한다. 여러 번이면 가장 최근 위치를 표시하고 횟수도 함께 제공한다.

### 4.3 경고 예시

| 과거 | 후보 | 결과 |
|---|---|---|
| `[A,B]` | `[B,A]` | 완전 동일 강한 경고 |
| `[A,B]` | `[A,B,C]` | 완전 동일 아님; A/B 최근 사용 표시 |
| `[A,A,B]`(비정상 import) | `[A,B]` | 정규화 후 완전 동일 |
| `[삭제된A,B]` | `[A,B]` | ID가 같으면 완전 동일 |
| 빈 후보 | `[]` | 비교하지 않고 저장 검증 오류 |

---

## 5. 결정적 코디 추천

### 5.1 입력과 출력

```ts
interface RecommendInput {
  garments: Garment[];
  outfits: Outfit[];
  contextName: string;
  targetSeason: SeasonCode | null;
  limit: number; // UI는 3, 함수는 1..20만 허용
}

interface Recommendation {
  garmentIds: string[];
  combinationKey: string;
  score: number;
  reasonCodes: Array<
    | "NOT_USED_IN_RECENT_4" | "OLDER_IN_RECENT_4"
    | "COLOR_STRONG" | "COLOR_OK" | "NEVER_WORN"
  >;
  lastWornLocalDateByGarmentId: Record<string, string | null>;
  ruleVersion: 1;
}
```

### 5.2 후보 생성

대상 옷:
- `status === "ACTIVE"`
- targetSeason이 null이면 모든 계절 허용
- targetSeason이 있으면 `ALL` 또는 해당 계절을 가진 옷만 허용

핵심 조합:
1. `TOP 1 + BOTTOM 1`
2. `DRESS 1`

선택 아이템:
- 각 핵심 조합에 `OUTER 0..1`, `SHOES 0..1`을 붙인다.
- v1 자동 추천에는 `ACCESSORY`를 넣지 않는다. 액세서리는 착장 초안에서 사용자가 추가할 수 있다.
- 선택 아이템을 모두 생략한 조합도 후보로 유지한다.

폭발 제한:
- 카테고리별 옷을 먼저 `(최근 4회 freshness 내림차순, 마지막 착용일 오름차순, id 오름차순)`으로 정렬하고 상위 30개만 조합 생성에 사용한다.
- 생성 후 `combinationKey`로 중복 제거한다.
- 과거 어떤 착장과도 `combinationKey`가 같은 후보는 제외한다.
- 유효 후보가 0개면 과거 동일 조합 제외를 완화하지 않는다. “새 조합이 없어요. 옷을 추가하거나 직접 초안을 만들어 주세요.”를 표시한다.

### 5.3 색상 규칙

중립색: `BLACK, WHITE, GRAY, BEIGE, BROWN, NAVY, METALLIC`
보수적 허용 쌍(순서 무관):

- `BLUE–ORANGE`
- `BLUE–GREEN`
- `BLUE–PINK`
- `GREEN–YELLOW`
- `GREEN–PINK`
- `RED–PINK`
- `RED–BLUE`
- `PURPLE–PINK`
- `PURPLE–YELLOW`
- `ORANGE–YELLOW`

`pairCompatibility(a,b)`:
- 같은 색 또는 둘 중 하나가 중립색: 2
- 위 허용 쌍: 1
- `MULTI`가 포함되거나 목록 밖 비중립 조합: 0

후보의 호환도는 모든 서로 다른 아이템 색상 쌍의 최솟값이다. 아이템 하나뿐이면 2다. 호환도 0도 제외하지 않는다. 사용자가 가진 옷을 과도하게 막지 않고 순위만 낮춘다.

### 5.4 freshness와 점수식

최근 4회는 4.2의 동일한 함수로 구한다. 가장 최근을 index 0이라 할 때 각 아이템:

```ts
function freshness(garmentId: string, recent: Outfit[]): 0 | 1 | 2 | 3 | 4 {
  const i = recent.findIndex(o => o.garmentIds.includes(garmentId));
  return i === -1 ? 4 : i; // 최신=0, 두 번째=1, 세 번째=2, 네 번째=3, 없음=4
}
```

같은 아이템이 여러 번 나왔으면 `findIndex` 때문에 가장 최근 사용이 적용된다.

점수:

```ts
freshnessScore = round(25 * average(itemFreshness))        // 0..100
colorScore     = minPairCompatibility === 2 ? 20
               : minPairCompatibility === 1 ? 10 : 0
varietyScore   = min(12, distinctColorCount * 3)           // 3..12
optionalPenalty = 2 * (outerCount + shoesCount)            // 0..4
score = freshnessScore + colorScore + varietyScore - optionalPenalty
```

핵심 원칙:
- 최근 4회 미착용이 최대 100점으로 가장 큰 신호다.
- 색상은 최대 20점으로 보조한다.
- 선택 아이템이 많다는 이유만으로 비슷한 핵심 조합이 상위를 독점하지 않도록 작은 감점을 둔다.
- 점수는 확률이나 “잘 어울릴 확률”이 아니라 정렬값이다.

정렬 tie-break:
1. `score` 내림차순
2. 후보 아이템의 `freshness` 합 내림차순
3. 후보 중 가장 최근에 착용된 날짜(`max(lastWorn)`) 오름차순; 한 번도 안 입은 후보는 빈 문자열로 가장 먼저
4. 아이템 수 오름차순
5. `combinationKey` 코드포인트 오름차순

같은 DB 입력이면 추천 순서가 항상 같아야 하며 `Math.random()`, 현재 시각, 배열 입력 순서에 의존하면 안 된다. “추천 재생성”은 같은 입력이면 같은 결과를 다시 보여준다. 다양화를 원하면 사용자가 이전 추천을 초안/착장으로 저장해 입력 기록을 바꾸게 한다.

### 5.5 검산 예시

실행으로 재계산한 값:

- 후보 A: freshness `[4,4]`, 호환도 2, 색 2개, 선택 아이템 1개 → `100 + 20 + 6 - 2 = 124`
- 후보 B: freshness `[0,4]`, 호환도 2, 색 2개, 선택 아이템 1개 → `50 + 20 + 6 - 2 = 74`
- 후보 C: freshness `[2,3]`, 호환도 1, 색 2개, 선택 아이템 0개 → `63 + 10 + 6 = 79`

반올림 계약: TypeScript의 `Math.round(62.5) === 63`을 따른다. Python의 기본 `round(62.5)`처럼 bankers rounding을 쓰는 언어로 포팅할 때는 별도 구현해야 한다.

추천 이유:
- 모든 아이템 freshness 4: “최근 4번에 입지 않은 옷이에요”
- 하나 이상 freshness 4: 해당 옷 이름과 함께 미착용 이유
- 호환도 2: “기본 색상 조화 규칙이 강하게 맞아요”
- 과거 전체에서 한 번도 snapshot에 등장하지 않은 옷: “아직 기록에 없는 옷이에요”

---

## 6. 메타데이터 내보내기·전체 삭제

### 6.1 JSON 내보내기 v1

파일명: `angyeopchyeo-backup-YYYYMMDD-HHmm.json`

```ts
interface MetadataExportV1 {
  app: "angyeopchyeo";
  exportVersion: 1;
  exportedAt: string;
  containsImages: false;
  garments: Array<Omit<Garment, "mainMediaId"> & { hadImage: boolean }>;
  outfits: Array<Omit<Outfit, "fullMediaId"> & { hadImage: boolean }>;
  draft: OutfitDraft | null;
}
```

- Blob, object URL, 기기 경로는 포함하지 않는다.
- 내보내기 성공은 브라우저가 다운로드를 시작한 시점까지만 뜻한다. 실제 파일 보관 위치는 앱이 확인할 수 없다.
- v1 MVP에서 가져오기는 필수가 아니다. UI에 “사진 미포함, 이 파일만으로 사진을 복구할 수 없음”을 다운로드 전에 명시한다.

### 6.2 전체 삭제

1. 사용자가 `전체 삭제`를 누른다.
2. 확인 화면에 옷 수, 착장 수, 사진 수를 실제 DB count로 표시한다.
3. 사용자가 앱 이름 `안겹쳐`를 입력해야 최종 버튼이 활성화된다.
4. `garments, media, outfits, drafts, settings`를 한 version-safe 절차로 clear한다.
5. 앱의 Cache API 중 앱이 소유한 prefix(`angyeopchyeo-`)만 삭제한다.
6. transaction 실패 시 성공 메시지를 띄우지 않는다. 재조회 count가 모두 0일 때만 완료로 표시한다.
7. 서비스워커 등록 자체는 제거하지 않는다. 오프라인 앱 shell은 남고 사용자 데이터만 사라진다.

---

## 7. 테스트 가능한 계약

### 7.1 데이터·중복 단위 테스트

1. ID 순서가 달라도 `combinationKey`가 같다.
2. 중복 ID와 빈 ID는 제거된다.
3. UUID가 같은 삭제 snapshot은 중복 비교에 남는다.
4. 옷 삭제 후 과거 착장 렌더링은 snapshot label을 사용한다.
5. 같은 날짜 기록은 createdAt/id tie-break로 최근 4회 순서가 고정된다.
6. 착장 수정 중 자기 자신은 duplicate/recent 계산에서 제외된다.
7. 빈 착장은 저장 거절된다.
8. 같은 combinationKey 착장을 두 번 저장할 수 있다.
9. context가 있으면 다른 context 기록은 최근 4회에서 제외된다.
10. context가 비면 전체 기록을 사용한다.

### 7.2 추천 순수 함수 테스트

1. 빈 옷장 → `[]`.
2. TOP만 있음 → `[]`.
3. BOTTOM만 있음 → `[]`.
4. DRESS 하나만 있음 → 후보 1개.
5. ARCHIVED는 후보에서 제외.
6. 계절 불일치 옷은 제외, ALL은 포함.
7. 과거 완전 동일 후보는 제외.
8. 최근 4회 미착용 후보가 최신 착용 후보보다 높은 freshnessScore.
9. 배열 입력 순서를 섞어도 결과와 순서가 같다.
10. 같은 점수는 마지막 착용일 → 아이템 수 → combinationKey 순으로 고정.
11. 호환도 0도 후보로 남지만 색상 점수는 0.
12. 후보가 모두 과거 조합이면 빈 결과와 지정된 안내 코드 반환.
13. `Math.round(62.5) === 63`을 고정해 Python 등 타 언어 검산 차이를 방지.
14. limit 0, 21, NaN은 입력 오류; 1..20만 허용.

### 7.3 이미지·저장 통합 테스트

1. 카메라 취소는 기존 폼/사진 유지.
2. 사진 없이 옷과 착장 저장 가능.
3. 세로 EXIF 사진의 최종 width/height와 시각 방향 확인.
4. WebP 미지원 mock에서 JPEG fallback과 실제 MIME 확인.
5. `toBlob(null)`은 DB 레코드를 만들지 않음.
6. 25 MiB 초과 입력은 decode 전에 거절.
7. QuotaExceededError에서 media와 metadata가 모두 rollback.
8. 사진 교체 중 이전 media 삭제 실패 후 다음 시작의 고아 청소로 제거.
9. 목록 조회는 `media.fullBlob`을 읽지 않고 thumb만 필요할 때 가져옴.
10. object URL은 component 해제/사진 교체 때 revoke.
11. 새로고침 후 옷·착장·썸네일 유지.
12. 전체 삭제 후 다섯 store count와 앱 Cache prefix가 0.

### 7.4 import/비정상 데이터 방어 엣지케이스

- 존재하지 않는 garmentId가 Outfit에 있고 snapshot도 없음: `알 수 없는 옷`으로 표시, 추천 입력에는 사용하지 않음.
- 같은 ID의 garment snapshot이 한 Outfit에 여러 개: 첫 유효 snapshot만 보존하고 정렬.
- 잘못된 날짜: 저장/import 거절. JS Date의 자동 보정에 의존하지 않음.
- 미래 날짜: 허용. 기록 정렬에는 포함하되 target보다 미래인 기록은 추천의 “과거 착용”에서 제외한다.
- `localDate === targetLocalDate`이고 createdAt이 현재 추천보다 이른 기록: 이미 저장된 기록이므로 과거로 포함한다.
- 색상/카테고리 미지원 코드: 해당 레코드 import 거절, 전체 import는 원자적으로 실패.
- 1,000개 이상 옷: 기능은 유지하되 카테고리별 사전정렬 상위 30개 후보 제한을 UI에 설명한다.
- 브라우저 탭 2개 동시 수정: 마지막 커밋 우선. v1에는 충돌 해결이 없으므로 `updatedAt`이 화면 로드 시점과 다르면 덮어쓰기 확인을 띄운다.

---

## 8. 비용과 운영 모델

### 8.1 로컬 MVP — 확인 사실과 비용 경계

확인 사실:
- 현재 설계에는 서버, DB SaaS, 인증, 외부 이미지 저장, Vision API, 분석 SDK, 결제 처리가 없다.
- 따라서 한 기기에서 정적 파일을 직접 실행하는 범위의 **외부 API·서버 직접 변동비는 0원**이다.

0원이 아닌 항목:
- 개발·QA·수정 시간
- 테스트 기기, 전기, 인터넷 등 이미 보유한 자원의 기회비용
- 사용자에게 백업/복구를 안내하는 수동 지원 시간
- 대표 승인 후 정적 호스팅·도메인을 쓰면 발생할 수 있는 비용

운영 시간 추정(실측 전 가정):
- 한 가구 내부 사용: 월 0~1시간의 확인/지원 예산
- 브라우저 업데이트나 데이터 소실 문의가 생긴 달은 초과할 수 있음
- 출시 2주 뒤부터 실제 `지원 건수`, `지원 분`, `데이터 소실 건수`, `평균 압축 이미지 bytes`를 기록해 추정값을 대체한다.

### 8.2 공개 서비스 전환 시 비용 항목

가격을 임의로 넣지 않고 아래 실제 청구 단위를 수집한다.

| 비용 항목 | 측정 변수 | 월 비용식 |
|---|---|---|
| 정적 호스팅/CDN | 요청 수, 전송 GB | 기본료 + 요청단가×요청 + 전송단가×GB |
| 도메인 | 연간 실결제액 | 연간액 / 12 |
| 인증 | MAU, SMS/이메일 수 | 구간 기본료 + 초과 사용자/메시지 |
| 메타데이터 DB | 읽기/쓰기, 저장 GB | 작업 단가 + 저장 단가 |
| 이미지 object storage | 원본/썸네일 GB | 저장 GB×단가 |
| 이미지 egress/CDN | 다운로드 GB | 전송 GB×단가 |
| 이미지 변환 | 변환 건수/CPU | 건수 또는 실행시간×단가 |
| 백업 | 백업 GB, 보관 세대 | 저장·복원 단가 |
| 모니터링 | 이벤트/로그 GB | 수집·보관 단가 |
| 고객지원 | 건수, 처리 분 | 총 처리시간×내부 시간원가 |
| 결제 | 실결제액, 건수, 환불 | PG 고정/비율 수수료 + 환불 비용 |
| 앱스토어(선택) | 계정/수수료 | 실제 약관·청구액 |
| Vision API(선택) | 이미지·토큰 수 | 호출량×공식 단가 |

월 공헌이익 계약:

```text
월매출 = 유료 고객 수 × 실제 객단가
결제비 = 실제 PG 청구액
인프라비 = 호스팅 + DB + 저장 + 전송 + 변환 + 인증 + 모니터링 + 백업
지원비 = 실제 지원시간 × 대표가 승인한 시간원가
월 공헌이익 = 월매출 - 결제비 - 인프라비 - 지원비
고객당 변동비 = (결제비 + 사용량 연동 인프라비 + 지원비) / 실제 유료 고객 수
```

유료 고객 수가 0이면 고객당 변동비를 계산하지 않고 `N/A`로 둔다.

### 8.3 공개 전환 전 최소 계측

외부 분석 SDK 없이 앱 내부에 집계하고 사용자가 직접 내보낼 수 있는 값:

- garmentCount, outfitCount, mediaCount
- fullBytes 합, thumbBytes 합, 평균/95백분위 이미지 크기
- 이미지 변환 실패 수와 QuotaExceededError 수
- JSON 내보내기 마지막 날짜
- 추천 생성 수, 추천을 초안으로 채택한 수(기기 로컬 카운터)

개인 사진·옷 이름·만남명은 계측 내보내기에서 제외한다. 공개 서비스 설계 전 실제 2주 사용값으로 월 저장량·전송량을 계산한다.

### 8.4 의사결정 기준

- 유지: 핵심 흐름이 반복 사용되고 데이터 소실 0건, 저장 실패가 사용을 막지 않음.
- 수정: 추천은 쓰지만 수동 수정이 잦거나, 평균 이미지가 목표 hard cap에 근접하거나, 백업 이해가 낮음.
- 확대: 로컬 반복 사용과 추천 채택이 확인된 뒤에만 동기화/공유 수요를 직접 질문하고 작은 대기명단으로 검증.
- 중단/보류: 데이터 소실이 재현되거나, 사진 저장 실패 복구가 불가능하거나, 사용자가 수동 기록 부담 때문에 반복 사용하지 않음.

가격 공개, 결제 링크, 유료 API 호출, 호스팅 배포는 이 문서의 실행 범위가 아니며 대표 승인 전 금지한다.

---

## 9. 구현 체크리스트

- [ ] IndexedDB v1 store/index를 그대로 생성
- [ ] media 분리 및 목록에서 fullBlob 지연 로드
- [ ] snapshot label과 삭제 fallback
- [ ] 이미지 긴 변/품질/hard cap/fallback 테스트
- [ ] `estimate()`, `persist()`, QuotaExceededError UI
- [ ] canonical combinationKey와 최근 4회 context 범위
- [ ] 후보 생성·과거 조합 제외·점수·tie-break 순수 함수
- [ ] JSON은 사진 미포함임을 다운로드 전 명시
- [ ] 전체 삭제 후 DB/Cache 재조회 검증
- [ ] 390px 실제 브라우저에서 사진 선택 취소·새로고침 유지 확인
- [ ] 외부 요청이 0인지 브라우저 Network에서 확인

---

## 10. 출처

모두 2026-07-30 확인.

1. MDN, Storage quotas and eviction criteria
   https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
2. MDN, IDBObjectStore
   https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore
3. MDN, StorageManager.estimate()
   https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
4. MDN, StorageManager.persist()
   https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
5. MDN, HTMLCanvasElement.toBlob()
   https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
6. 내부 제품 브리프
   `/Users/damandeul/다만들/ai-company/outfit-memory-app/BRIEF.md`

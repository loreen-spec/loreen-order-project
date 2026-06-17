# 입고 대시보드 세팅 가이드

## 1. 노션 API 키 발급

1. https://www.notion.so/my-integrations 접속
2. "새 통합 만들기" 클릭
3. 이름: `입고대시보드` 등 자유롭게 입력
4. 생성 후 **Internal Integration Token** 복사

## 2. 노션 데이터베이스 연결

1. 노션에서 제품 데이터베이스 페이지 열기
2. 우상단 `...` → "연결 추가" → 방금 만든 통합 선택
3. 데이터베이스 URL에서 ID 복사  
   예: `https://notion.so/workspace/**32자리ID**?v=...`

## 3. 환경변수 설정 (.env.local)

```
NOTION_API_KEY=secret_xxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 4. 노션 데이터베이스 컬럼명

아래 컬럼명을 사용하면 자동 매핑됩니다:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| 제품명 | Title | 제품 이름 |
| 카테고리 | Select | 상의/하의 등 |
| 업체 | Select/Text | 거래처명 |
| 입고예정일 | Date | YYYY-MM-DD |
| 발주수량 | Number | 수량(장) |
| 상태 | Select | 예정/운송중/입고완료/지연 |
| 시즌 | Select | 2025SS 등 (선택) |
| 메모 | Text | 비고 (선택) |

## 5. 실행

```bash
npm run dev   # 개발 서버 (http://localhost:3000)
npm run build # 빌드
npm start     # 프로덕션 실행
```

## 6. 팀장님 대시보드와 합치기

각 컴포넌트는 독립적으로 import 가능합니다:

```tsx
import { WeekBanner, ArrivalCalendar, VendorList, DelayAlert } from '@/components'
// API 라우트도 그대로 복사: src/app/api/products, src/app/api/comments
// 라이브러리도 복사: src/lib/notion.ts, src/lib/utils.ts
```

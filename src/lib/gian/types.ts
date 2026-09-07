// ── 기안메이트 공용 타입 ─────────────────────────────────────

/** 거래명세서에서 추출한 품목 한 줄 */
export interface StatementItem {
  name: string;        // 항목/품목
  spec?: string;       // 규격 (선택)
  unitPrice: number;   // 단가
  qty: number;         // 수량
  supply: number;      // 공급가액
  vat: number;         // 세액(부가세)
  total: number;       // 총 금액
}

/** 거래명세서 1건 (인식 결과) */
export interface Statement {
  vendor: string;          // 거래처(업체명)
  bizNo?: string;          // 사업자번호
  date: string;            // 거래일자 YYYY-MM-DD
  items: StatementItem[];  // 품목 목록
  supplyTotal: number;     // 공급가액 합계
  vatTotal: number;        // 세액 합계
  grandTotal: number;      // 합계금액(총액)
  note?: string;           // 비고
  /** 인식 신뢰도 힌트 (칸별 0~1). 낮은 칸은 화면에서 주황 표시 */
  confidence?: Partial<Record<keyof Statement | "vat", number>>;
}

/** 업체 DB 항목 */
export interface Vendor {
  id: string;
  name: string;
  bizNo?: string;
  account?: string;   // 계정과목 (예: 원부자재비)
  payment?: string;   // 결제조건 (예: 계좌이체(말일))
  type?: "건별" | "정기";
  titleTemplate?: string; // 제목 템플릿 (선택)
  lastUsed?: string;  // 최근 기안 YYYY-MM-DD
}

/** 결재선 사람 */
export interface Person {
  name: string;   // 표시명 (예: Hans최철용)
  role?: string;  // 직위/역할
}

/** 계산된 결재선 */
export interface ApprovalLine {
  approvers: Person[];   // 결재자 (신청 → 사원 → 임원 → ...)
  references: Person[];  // 참조
}

/** 생성된 기안서 */
export interface GianDoc {
  id: string;
  createdAt: string;      // ISO
  title: string;          // 제목
  bodyIntro: string;      // 본문 상단 문구
  statement: Statement;   // 원본 인식 데이터
  approval: ApprovalLine; // 결재선
  status: "초안" | "확인필요" | "상신완료" | "결재진행중" | "결재완료";
  hiworksDocNo?: string;  // 공식 API 연동 시 문서번호
}

/** 정기결제 등록 */
export interface Recurring {
  id: string;
  name: string;        // 결제명
  vendorId: string;
  vendorName: string;
  dayOfMonth: number;  // 결제일 (1~31)
  amount: number;      // 월 금액(직전 금액)
  account?: string;
  payment?: string;
  active: boolean;
}

// ─── Work Order Types ─────────────────────────────────────
export interface WorkOrderMeasurement {
  item: string;       // 기장, 가슴둘레, etc.
  values: Record<string, string>; // { "100": "42", "110": "45.6", ... }
  diff: string;       // 편차
  isHeader?: boolean; // 구분 헤더 행 (상의/하의/모자 등 분리용)
}

export interface WorkOrderMaterial {
  id: string;
  category: string;   // 주원단A, 웰론, 안감B, 지퍼, 슬라이더, 와펜 etc.
  name: string;       // 자재명
  color: string;
  spec: string;       // 규격 (60", 5호 etc.)
  yield: string;      // 요척 숫자
  yieldUnit: string;  // YD | M | EA | 직접입력
  unitPrice: string;
  orderUnit: string;  // 단발주 (1EA, 0.3YD etc.)
  notes: string;
  fixed?: boolean;    // 고정 기본 행 (메인라벨 등) — 항상 목록 하단 유지
}

export interface WorkOrderColorSize {
  color: string;
  colorCode?: string; // hex for display
  sizes: Record<string, number>;
  total: number;
}

export interface WorkOrder {
  id: string;
  // Header
  styleNo: string;
  productName: string;
  vendor: string;     // 작업처
  season: string;     // 여름, 겨울 etc.
  year: string;       // 2026
  sampleNo: string;   // SAMPLE NO.
  category: string;   // 아우터, 니트 etc.

  // Staff
  manager: string;    // 담당
  director: string;   // 실장

  // Dates
  issueDate: string;
  productionDate: string;
  deliveryDate: string;

  // Order info
  orderCount: number; // 차수
  totalQuantity: number;
  sizes: string[];    // ["100","110","120","130","140"]

  // Measurements
  measurements: WorkOrderMeasurement[];

  // Materials
  materials: WorkOrderMaterial[];

  // Color × Size table
  colorSizeTable: WorkOrderColorSize[];

  // Labels
  labels: {
    main: boolean;
    care: boolean;
    reorderInfo: boolean;
    priceTag: boolean;
    qualityTag: boolean;
    polybag: boolean;
    wappen: boolean;
    pointLabel: boolean;
    artworkLabel: boolean;
  };
  customLabels: string[]; // 직접 추가 라벨 목록

  // Images (base64 data URL)
  sketchImage: string;    // 도식화 (기본/한국어)
  sketchImageEn?: string; // 도식화 (영문 버전)
  sketchImageZh?: string; // 도식화 (중문 버전)
  productImage: string;   // 제품 사진
  labelImage: string;     // 라벨 위치 다이어그램 (기존 단일 이미지)

  // 라벨 위치 다이어그램 프리셋 선택
  labelDiagramSelected?: string[]; // 선택된 프리셋 ID 배열

  // Notes
  productionNotes: string; // 비고/기타 작성란
  fixedNotes: string;      // 고정값 문구 (순수사항)
  vendorNotes: string;     // 원부자재 업체 정보 (레거시 — 텍스트)
  vendorInfoTable?: {      // 원부자재 업체 정보 테이블
    id: string;
    materialType: string;  // 원부자재 종류
    vendorName: string;    // 업체명
    manager: string;       // 담당자
    contact: string;       // 연락처
    notes: string;         // 비고
  }[];
  specialNotes: string;

  // Cost
  totalCost: string;
  salePrice: string;
  laborCost: string;    // 공임비 (국내생산)
  packagingCost: string; // 포장비 (국내생산)

  // 첨부파일 (PDF 미포함) — materialId로 원부자재 항목에 연결
  attachments?: {
    id: string;
    materialId: string; // WorkOrderMaterial.id 와 연결
    type: "image" | "link";
    name: string;       // 파일명 또는 링크 제목
    value: string;      // base64 data URL (image) 또는 URL string (link)
    memo?: string;
  }[];

  status: "draft" | "pending_confirm" | "completed" | "custom";
  customStatus?: string; // status === "custom" 일 때 직접 입력 텍스트
  directorApproved?: boolean;   // 실장 승인 여부
  notionProductId?: string;

  // 차수별 원가 (발주 DB 차수 선택 팝업에서 입력) — 키: 차수번호 문자열
  batchCosts?: Record<string, string>;

  // 작업지시서 폼 종류
  formType?: WorkOrderFormType;

  // 미리보기 언어별 수동 수정본 (예: i18n.en["pnote"], i18n.zh["m:id:name"]) — 자동번역보다 우선
  i18n?: Record<string, Record<string, string>>;

  // 도식화 위 텍스트 라벨 (x,y는 % 위치) — 미리보기에서 언어별 자동 번역
  sketchLabels?: { id: string; x: number; y: number; text: string }[];

  createdAt: string;
  updatedAt: string;
}

// 작업지시서 폼 종류
export type WorkOrderFormType =
  | "완사입"   // 기본
  | "국내의류"
  | "오중"
  | "영문"
  | "중문";

export const WORK_ORDER_FORM_OPTIONS: { value: WorkOrderFormType; label: string }[] = [
  { value: "완사입",   label: "완사입(기본)" },
  { value: "국내의류", label: "국내의류" },
  { value: "오중",     label: "오중" },
  { value: "영문",     label: "영문작지" },
  { value: "중문",     label: "중문작지" },
];

// ─── Shoe Work Order Types ─────────────────────────────────
export interface ShoeColorSizeRow {
  color: string;
  colorCode?: string;
  sizes: Record<string, number>;
  total: number;
}

export interface ShoeSpec {
  id: string;
  item: string;
  value: string;
}

export interface ShoeWorkOrder {
  id: string;
  board: "슈즈";
  category: "슈즈";

  styleNo: string;
  productName: string;
  vendor: string;
  season: string;      // 시즌 (여름·겨울·사계절 등)
  year: string;        // 년도 (개발년도)
  orderCount: number;
  manager: string;
  director: string;
  orderDate: string;
  deliveryDate: string;
  vendorUnitPrice: string;

  notionProductId?: string;
  productImage: string;
  detailImage: string;

  sizes: string[];
  colorSizeTable: ShoeColorSizeRow[];
  totalQuantity: number;

  suppliedMaterials: string;
  cautions: string;
  specs: ShoeSpec[];

  status: "draft" | "pending_confirm" | "completed" | "custom";
  customStatus?: string;
  directorApproved?: boolean;

  // 차수별 원가 (발주 DB 차수 선택 팝업에서 입력) — 키: 차수번호 문자열
  batchCosts?: Record<string, string>;

  createdAt: string;
  updatedAt: string;
}

// ─── Product Types ─────────────────────────────────────────
export interface Product {
  id: string;
  notionPageId: string;
  name: string;
  category: string;       // 복종 (상의/하의/슬립온 등)
  board: string;          // 의류/슈즈/잡화
  vendor: string;         // 생산공장
  arrivalDate: string;
  orderQuantity: number;  // 입고수량
  status: "scheduled" | "in_transit" | "arrived" | "delayed";
  statusLabel: string;
  imageUrl?: string;
  season?: string;
  brand?: string;
  team?: string;
  manager?: string;
  notes?: string;
}

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface WeekSummary {
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalItems: number;
  totalQuantity: number;
  products: Product[];
}

export interface VendorSummary {
  vendor: string;
  totalItems: number;
  totalQuantity: number;
  products: Product[];
}

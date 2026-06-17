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
  yield: string;      // 요척
  unitPrice: string;
  orderUnit: string;  // 단발주 (1EA, 0.3YD etc.)
  notes: string;
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
  sketchImage: string;    // 도식화
  productImage: string;   // 제품 사진
  labelImage: string;     // 라벨 위치 다이어그램 (기존 단일 이미지)

  // 라벨 위치 다이어그램 프리셋 선택
  labelDiagramSelected?: string[]; // 선택된 프리셋 ID 배열

  // Notes
  productionNotes: string; // 비고/기타 작성란
  fixedNotes: string;      // 고정값 문구 (순수사항)
  vendorNotes: string;     // 원부자재 업체 정보
  specialNotes: string;

  // Cost
  totalCost: string;
  salePrice: string;

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

// ✏️ 관리자 설정 — 팀원에게 나눠주기 전에 server, clientId만 채우면 됩니다.
// 작업지시서 칸 위치가 바뀌면 sheet 부분을 고치세요. 고친 뒤 chrome://extensions 에서 🔄 새로고침.
// (노션 속성 이름은 대시보드 서버 src/app/api/sheet-autofill/route.ts 에 있습니다)

const CONFIG = {
  // 회사 대시보드 서버 주소 (노션 키는 서버에만 있음)
  // 🧪 시험 중: 이 PC에서 돌리는 대시보드 서버 사용. 배포 후 아래 줄로 바꾸기
  // server: 'https://loreen-order-project.vercel.app',
  server: 'http://localhost:3000',

  google: {
    // Google Cloud(gianmate 프로젝트) > 클라이언트 > 작업지시서 확장프로그램 의 클라이언트 ID
    clientId: '',
    domain: 'openhan.kr', // 이 회사 계정만 사용 가능
  },

  sheet: {
    productName: 'C5',   // 상품명 칸 (시트에 있으면 자동으로 읽어옴)
    manager: 'M4',       // 결재란 '담당' 아래 칸
    factory: 'D5',       // '작업처' 아래 칸
    sizeHeader: 'F22:J22', // COLOR 표의 사이즈 머리글 (100 110 120 130 140)
    colorTable: {
      firstRow: 23,      // 첫 번째 컬러 줄
      rows: 4,           // 컬러 최대 개수 (23~26행)
      colorCol: 'E',     // 컬러 이름 칸
    },
    // 사이즈 스펙 표 (엑셀 업로드로 채움)
    spec: {
      sizeHeader: 'F5:J5', // 사이즈 머리글 (100 110 120 130 140)
      labelCol: 'E',       // 항목 이름 칸 (기장, 가슴둘레 …)
      gradeCol: 'K',       // 편차 칸
      firstRow: 6,         // 첫 번째 항목 줄
      rows: 16,            // 항목 최대 개수 (6~21행)
    },
  },
};

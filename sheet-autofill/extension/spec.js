// 사이즈 스펙 엑셀 자동 인식
// 어떤 양식이든: 사이즈(100 110 … / S M L)가 가장 많이 나열된 줄을 머리글로 보고,
// 그 아래에서 "항목 이름 + 숫자"가 있는 줄을 스펙으로 읽습니다.

const Spec = {
  async parseFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    let best = null;
    for (const name of wb.SheetNames) {
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
      const found = this.parseGrid(grid);
      if (found && (!best || found.score > best.score)) best = { ...found, sheet: name };
    }
    if (!best) throw new Error('사이즈 스펙을 찾지 못했어요. 사이즈(100, 110… 또는 S, M, L) 머리글이 있는지 확인해주세요');
    return best;
  },

  parseGrid(grid) {
    // ① 머리글 줄: 사이즈처럼 생긴 칸이 가장 많은 줄
    let header = null;
    grid.forEach((row, r) => {
      const cols = [];
      row.forEach((v, c) => isSize(v) && cols.push(c));
      if (cols.length >= 2 && (!header || cols.length > header.cols.length)) header = { row: r, cols };
    });
    if (!header) return null;
    const { row: h, cols } = header;
    const sizes = cols.map((c) => sizeText(grid[h][c]));

    // 편차 칸: 머리글 줄에서 '편차/grade'라고 적힌 칸
    const gradeCol = grid[h].findIndex((v, c) => !cols.includes(c) && /편차|grade|그레이딩|차이/i.test(String(v)));

    // ② 항목 이름 칸: 사이즈 칸보다 왼쪽에서 글자가 가장 많은 칸
    const below = grid.slice(h + 1, h + 41);
    let labelCol = -1;
    let most = 0;
    for (let c = 0; c < cols[0]; c++) {
      const n = below.filter((row) => isLabel(row[c])).length;
      if (n > most) { most = n; labelCol = c; }
    }
    if (labelCol < 0) return null;

    // ③ 스펙 줄 읽기
    const rows = [];
    let blank = 0;
    for (let r = h + 1; r < grid.length; r++) {
      const row = grid[r] || [];
      const label = String(row[labelCol] ?? '').trim();
      // 다른 표의 머리글(항목 이름 없이 사이즈만 나열)이 나오면 끝
      if ((!label || /size|사이즈/i.test(label)) && row.filter(isSize).length >= 2) break;
      const values = cols.map((c) => cellValue(row[c]));
      const hasValue = values.some((v) => v !== '');
      if (label && hasValue) {
        rows.push({ label, values, grade: gradeCol >= 0 ? cellValue(row[gradeCol]) : '' });
        blank = 0;
      } else if (!label && !hasValue) {
        if (rows.length && ++blank >= 3) break;
      }
    }
    if (!rows.length) return null;
    return { sizes, rows, hasGrade: gradeCol >= 0, score: rows.length * 10 + cols.length };
  },
};

// 사이즈로 보이는 값: 80~200 숫자(호/cm 붙어도 됨), XS~3XL, FREE, 5(110)
function isSize(v) {
  const s = String(v).trim().replace(/\s/g, '');
  if (/^\d{2,3}(호|cm)?$/i.test(s)) {
    const n = parseInt(s);
    return n >= 70 && n <= 200 && n % 5 === 0;
  }
  return /^(XXS|XS|S|M|L|XL|XXL|XXXL|[2-4]XL|F|FREE|ONE)$/i.test(s) || /^\d{1,2}\(\d{2,3}\)$/.test(s);
}

function sizeText(v) {
  return String(v).trim().replace(/\s/g, '').replace(/(호|cm)$/i, '').toUpperCase();
}

function isLabel(v) {
  const s = String(v ?? '').trim();
  return s !== '' && !/^-?[\d.,/\s±+]+$/.test(s);
}

// 숫자는 숫자로 (소수 둘째 자리까지), 나머지는 글자 그대로
function cellValue(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  const s = String(v).trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
}

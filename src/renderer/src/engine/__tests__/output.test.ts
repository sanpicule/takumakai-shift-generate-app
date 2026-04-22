// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { generateShift, generateMarkdownTable, generateCSV } from '../generator'
import { defaultStaffList, makeInput } from '../../__tests__/fixtures'

// テスト用に一度だけ生成結果を作成
const result = generateShift(makeInput({ year: 2026, month: 4 }))

// ============================================================
// generateMarkdownTable
// ============================================================
describe('generateMarkdownTable', () => {
  let table: string
  let lines: string[]

  beforeEach(() => {
    table = generateMarkdownTable(result, defaultStaffList)
    lines = table.split('\n')
  })

  describe('ヘッダー行', () => {
    it('先頭列が「スタッフ」', () => {
      expect(lines[0]).toMatch(/^\| スタッフ/)
    })

    it('日付列が N(曜) 形式で存在する', () => {
      expect(lines[0]).toContain('1(水)')
      expect(lines[0]).toContain('30(木)')
    })

    it('日付列の数が月の日数（30）と一致する', () => {
      // ヘッダーのセル数 = スタッフ列1 + 日付列30 + 集計列7
      const cells = lines[0].split('|').filter(c => c.trim() !== '')
      expect(cells.length).toBeGreaterThanOrEqual(38)
    })

    it('集計列「公休数」「代休数」「日勤数」「当直数」「日曜休み数」「最大連勤数」「連休数」が存在する', () => {
      expect(lines[0]).toContain('公休数')
      expect(lines[0]).toContain('代休数')
      expect(lines[0]).toContain('日勤数')
      expect(lines[0]).toContain('当直数')
      expect(lines[0]).toContain('日曜休み数')
      expect(lines[0]).toContain('最大連勤数')
      expect(lines[0]).toContain('連休数')
    })
  })

  describe('セパレーター行', () => {
    it('ヘッダーの直後にセパレーター行（|---|）がある', () => {
      expect(lines[1]).toMatch(/\|[\s-]+\|/)
    })
  })

  describe('データ行', () => {
    it('スタッフ行数が staffList の件数と一致する', () => {
      // ヘッダー1行 + セパレーター1行 + データ行 + フッター2行
      const dataRowCount = lines.length - 2 - 2
      expect(dataRowCount).toBe(defaultStaffList.length)
    })

    it('各行が | で始まり | で終わる', () => {
      for (const line of lines) {
        expect(line).toMatch(/^\|.*\|$/)
      }
    })
  })

  describe('フッター行', () => {
    it('「日勤人数」行が存在する', () => {
      expect(table).toContain('| 日勤人数 |')
    })

    it('「当直担当」行が存在する', () => {
      expect(table).toContain('| 当直担当 |')
    })
  })

  describe('出力形式の制約', () => {
    it('コードブロック（```）が含まれない', () => {
      expect(table).not.toContain('```')
    })

    it('| 区切りのテーブル形式になっている', () => {
      for (const line of lines) {
        expect(line.startsWith('|')).toBe(true)
      }
    })
  })
})

// ============================================================
// generateCSV
// ============================================================
describe('generateCSV', () => {
  let csv: string
  let rows: string[][]

  beforeEach(() => {
    csv = generateCSV(result, defaultStaffList)
    rows = csv.split('\n').map(line => line.split(','))
  })

  describe('エンコード・構造', () => {
    it('BOM 付き UTF-8 で始まる', () => {
      expect(csv.startsWith('\uFEFF')).toBe(true)
    })

    it('ヘッダー行の先頭列が「スタッフ」（BOM除去後）', () => {
      // BOMが先頭に付くため、最初の列から\uFEFFを除去して比較
      expect(rows[0][0].replace('\uFEFF', '')).toBe('スタッフ')
    })

    it('日付列が N(曜) 形式', () => {
      expect(rows[0][1]).toBe('1(水)')
      expect(rows[0][30]).toBe('30(木)')
    })

    it('集計列「公休数」「代休数」「日勤数」「当直数」「日曜休み数」「最大連勤数」「連休数」が存在する', () => {
      const header = rows[0].join(',')
      expect(header).toContain('公休数')
      expect(header).toContain('代休数')
      expect(header).toContain('日勤数')
      expect(header).toContain('当直数')
      expect(header).toContain('日曜休み数')
      expect(header).toContain('最大連勤数')
      expect(header).toContain('連休数')
    })
  })

  describe('データの正確性', () => {
    it('行数がスタッフ数 + ヘッダー1行 + フッター2行', () => {
      // BOMのない状態で行数チェック（split('\n')はBOMを含む1行目も含む）
      const lineCount = csv.split('\n').length
      expect(lineCount).toBe(defaultStaffList.length + 1 + 2)
    })

    it('空欄セルが空文字になっている', () => {
      // スタッフ行の各日付セルは '' か シフト記号
      const dataRow = rows[1] // A の行
      const dayColumns = dataRow.slice(1, 31)
      for (const cell of dayColumns) {
        const validSymbols = ['日', '当', '明', '休', '代', '希', '']
        expect(validSymbols).toContain(cell)
      }
    })

    it('フッター行「日勤人数」が含まれる', () => {
      const lastTwoRows = rows.slice(-2).map(r => r[0])
      expect(lastTwoRows).toContain('日勤人数')
    })

    it('フッター行「当直担当」が含まれる', () => {
      const lastTwoRows = rows.slice(-2).map(r => r[0])
      expect(lastTwoRows).toContain('当直担当')
    })
  })
})

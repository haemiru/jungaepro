import { describe, it, expect } from 'vitest'
import {
  sqmToPyeong,
  pyeongToSqm,
  formatPrice,
  formatPropertyPrice,
  formatNumber,
  parseCommaNumber,
  formatDate,
  formatDDay,
  formatPhone,
  parsePhone,
  formatBusinessNumber,
  validateBusinessNumber,
  formatIdNumber,
  validateIdNumber,
} from './format'

const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

describe('면적 변환', () => {
  it('㎡ → 평 (반올림 소수 2자리)', () => {
    expect(sqmToPyeong(84.97)).toBeCloseTo(25.7, 1)
    expect(sqmToPyeong(0)).toBe(0)
  })
  it('평 → ㎡ 왕복', () => {
    expect(pyeongToSqm(25.7)).toBeCloseTo(84.96, 1)
  })
})

describe('formatPrice (만원 단위)', () => {
  it('억+만 혼합', () => {
    expect(formatPrice(95000)).toBe('9억 5,000만')
  })
  it('만원만', () => {
    expect(formatPrice(350)).toBe('350만')
  })
  it('억 단위 딱 떨어짐', () => {
    expect(formatPrice(120000)).toBe('12억')
  })
  it('0 / null → 대시', () => {
    expect(formatPrice(0)).toBe('-')
    expect(formatPrice(null)).toBe('-')
    expect(formatPrice(undefined)).toBe('-')
  })
})

describe('formatPropertyPrice (거래유형별)', () => {
  it('매매', () => {
    expect(formatPropertyPrice('sale', 95000)).toBe('9억 5,000만')
  })
  it('전세는 보증금 사용', () => {
    expect(formatPropertyPrice('jeonse', null, 50000)).toBe('5억')
  })
  it('월세는 보증금/월', () => {
    expect(formatPropertyPrice('monthly', null, 1000, 50)).toBe('1,000만 / 월 50만')
  })
  it('알 수 없는 유형 → 대시', () => {
    expect(formatPropertyPrice('unknown')).toBe('-')
  })
})

describe('숫자 포맷/파싱', () => {
  it('천단위 콤마', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
    expect(formatNumber('1234567')).toBe('1,234,567')
    expect(formatNumber('')).toBe('')
    expect(formatNumber(null)).toBe('')
  })
  it('콤마 문자열 → 숫자', () => {
    expect(parseCommaNumber('1,234,567')).toBe(1234567)
    expect(parseCommaNumber('abc')).toBeNull()
  })
})

describe('날짜/D-Day', () => {
  it('formatDate 하이픈 → 점', () => {
    expect(formatDate('2026-02-18T09:30:00Z')).toBe('2026.02.18')
    expect(formatDate(null)).toBe('-')
  })
  it('오늘 → D-Day', () => {
    expect(formatDDay(isoOf(new Date()))).toBe('D-Day')
  })
  it('미래 5일 → D-5', () => {
    const d = new Date()
    d.setDate(d.getDate() + 5)
    expect(formatDDay(isoOf(d))).toBe('D-5')
  })
  it('과거 3일 → D+3', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    expect(formatDDay(isoOf(d))).toBe('D+3')
  })
})

describe('전화번호', () => {
  it('휴대폰 하이픈', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
  })
  it('서울 02 국번', () => {
    expect(formatPhone('0212345678')).toBe('02-1234-5678')
  })
  it('입력 중 부분 포맷', () => {
    expect(formatPhone('0101234')).toBe('010-1234')
  })
  it('숫자만 추출', () => {
    expect(parsePhone('010-1234-5678')).toBe('01012345678')
  })
})

describe('사업자등록번호', () => {
  it('하이픈 포맷 XXX-XX-XXXXX', () => {
    expect(formatBusinessNumber('1234567891')).toBe('123-45-67891')
  })
  it('유효한 체크섬 → null', () => {
    expect(validateBusinessNumber('1234567891')).toBeNull()
  })
  it('잘못된 체크섬 → 오류', () => {
    expect(validateBusinessNumber('1234567890')).toBe('유효하지 않은 사업자등록번호입니다')
  })
  it('10자리 미만(미완성) → null', () => {
    expect(validateBusinessNumber('12345')).toBeNull()
  })
})

describe('주민등록번호 (구조 검증)', () => {
  it('13자리 미만(미완성) → null', () => {
    expect(validateIdNumber('123456')).toBeNull()
  })
  it('성별자리 0 → 오류', () => {
    expect(validateIdNumber('9001010000000')).toBe('유효하지 않은 주민등록번호입니다')
  })
  it('포맷: 6자리 뒤 하이픈', () => {
    expect(formatIdNumber('9001011234567')).toBe('900101-1234567')
  })
})

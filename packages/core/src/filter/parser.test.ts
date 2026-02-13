import { describe, it, expect } from 'vitest'
import { parseFilter, FilterParseError } from './parser.js'

describe('parseFilter', () => {
  it('parses simple equality', () => {
    const ast = parseFilter("uf eq 'SP'")
    expect(ast).toEqual({
      type: 'comparison',
      field: 'uf',
      operator: 'eq',
      value: 'SP',
    })
  })

  it('parses numeric comparison', () => {
    const ast = parseFilter('askingPrice gt 100000')
    expect(ast).toEqual({
      type: 'comparison',
      field: 'askingPrice',
      operator: 'gt',
      value: 100000,
    })
  })

  it('parses and expression', () => {
    const ast = parseFilter("uf eq 'SP' and city eq 'Campinas'")
    expect(ast.type).toBe('and')
    if (ast.type === 'and') {
      expect(ast.left).toEqual({
        type: 'comparison',
        field: 'uf',
        operator: 'eq',
        value: 'SP',
      })
      expect(ast.right).toEqual({
        type: 'comparison',
        field: 'city',
        operator: 'eq',
        value: 'Campinas',
      })
    }
  })

  it('parses or expression', () => {
    const ast = parseFilter("uf eq 'SP' or uf eq 'RJ'")
    expect(ast.type).toBe('or')
  })

  it('and binds tighter than or', () => {
    const ast = parseFilter("uf eq 'SP' or city eq 'Rio' and neighborhood eq 'Centro'")
    expect(ast.type).toBe('or')
    if (ast.type === 'or') {
      expect(ast.right.type).toBe('and')
    }
  })

  it('parses not expression', () => {
    const ast = parseFilter("not uf eq 'SP'")
    expect(ast.type).toBe('not')
    if (ast.type === 'not') {
      expect(ast.operand).toEqual({
        type: 'comparison',
        field: 'uf',
        operator: 'eq',
        value: 'SP',
      })
    }
  })

  it('parses parenthesized expressions', () => {
    const ast = parseFilter("(uf eq 'SP' or uf eq 'RJ') and city eq 'Campinas'")
    expect(ast.type).toBe('and')
    if (ast.type === 'and') {
      expect(ast.left.type).toBe('or')
    }
  })

  it('parses in expression', () => {
    const ast = parseFilter("uf in ('SP','RJ','MG')")
    expect(ast).toEqual({
      type: 'in',
      field: 'uf',
      values: ['SP', 'RJ', 'MG'],
    })
  })

  it('parses contains operator', () => {
    const ast = parseFilter("address contains 'rua'")
    expect(ast).toEqual({
      type: 'comparison',
      field: 'address',
      operator: 'contains',
      value: 'rua',
    })
  })

  it('rejects string-only operators on numeric fields', () => {
    expect(() => parseFilter("askingPrice contains '100'")).toThrow(FilterParseError)
  })

  it('rejects string values on numeric fields', () => {
    expect(() => parseFilter("askingPrice eq 'foo'")).toThrow(FilterParseError)
  })

  it('rejects numeric values on text fields', () => {
    expect(() => parseFilter('uf eq 42')).toThrow(FilterParseError)
  })

  it('rejects deeply nested expressions', () => {
    let expr = "uf eq 'SP'"
    for (let i = 0; i < 25; i++) {
      expr = `(${expr})`
    }
    expect(() => parseFilter(expr)).toThrow(FilterParseError)
  })

  it('rejects trailing tokens', () => {
    expect(() => parseFilter("uf eq 'SP' 'extra'")).toThrow(FilterParseError)
  })

  it('rejects empty input', () => {
    expect(() => parseFilter('')).toThrow()
  })
})

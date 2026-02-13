import { describe, it, expect } from 'vitest'
import { tokenize, TokenizeError } from './tokenizer.js'

describe('tokenize', () => {
  it('tokenizes a simple field eq value', () => {
    const tokens = tokenize("uf eq 'SP'")
    expect(tokens).toEqual([
      { type: 'FIELD', value: 'uf', position: 0 },
      { type: 'OPERATOR', value: 'eq', position: 3 },
      { type: 'STRING', value: 'SP', position: 6 },
      { type: 'EOF', value: '', position: 10 },
    ])
  })

  it('tokenizes numeric values', () => {
    const tokens = tokenize('askingPrice gt 100000')
    expect(tokens).toEqual([
      { type: 'FIELD', value: 'askingPrice', position: 0 },
      { type: 'OPERATOR', value: 'gt', position: 12 },
      { type: 'NUMBER', value: '100000', position: 15 },
      { type: 'EOF', value: '', position: 21 },
    ])
  })

  it('tokenizes negative numbers', () => {
    const tokens = tokenize('discountPercent ge -5.5')
    expect(tokens[2]).toEqual({ type: 'NUMBER', value: '-5.5', position: 19 })
  })

  it('tokenizes logical operators', () => {
    const tokens = tokenize("uf eq 'SP' and city eq 'Campinas'")
    const types = tokens.map((t) => t.type)
    expect(types).toEqual([
      'FIELD', 'OPERATOR', 'STRING',
      'AND',
      'FIELD', 'OPERATOR', 'STRING',
      'EOF',
    ])
  })

  it('tokenizes parentheses', () => {
    const tokens = tokenize("(uf eq 'SP')")
    expect(tokens[0]).toEqual({ type: 'LPAREN', value: '(', position: 0 })
    expect(tokens[4]).toEqual({ type: 'RPAREN', value: ')', position: 11 })
  })

  it('tokenizes not operator', () => {
    const tokens = tokenize("not uf eq 'SP'")
    expect(tokens[0]).toEqual({ type: 'NOT', value: 'not', position: 0 })
  })

  it('tokenizes in operator with comma-separated values', () => {
    const tokens = tokenize("uf in ('SP','RJ')")
    const types = tokens.map((t) => t.type)
    expect(types).toEqual([
      'FIELD', 'IN', 'LPAREN', 'STRING', 'COMMA', 'STRING', 'RPAREN', 'EOF',
    ])
  })

  it('handles escaped single quotes', () => {
    const tokens = tokenize("address contains 'it\\'s'")
    expect(tokens[2]!.value).toBe("it's")
  })

  it('throws on unterminated string', () => {
    expect(() => tokenize("uf eq 'SP")).toThrow(TokenizeError)
  })

  it('throws on unknown identifier', () => {
    expect(() => tokenize("foo eq 'bar'")).toThrow(TokenizeError)
  })

  it('throws on unexpected character', () => {
    expect(() => tokenize('uf @ SP')).toThrow(TokenizeError)
  })

  it('skips whitespace', () => {
    const tokens = tokenize("  uf   eq   'SP'  ")
    expect(tokens.length).toBe(4) // FIELD, OPERATOR, STRING, EOF
  })
})

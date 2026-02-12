import {
  FILTER_FIELDS,
  COMPARISON_OPERATORS,
  type FilterField,
  type ComparisonOperator,
} from './types.js'

export type TokenType =
  | 'FIELD'
  | 'OPERATOR'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'IN'
  | 'STRING'
  | 'NUMBER'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  position: number
}

const FIELD_SET = new Set<string>(FILTER_FIELDS)
const OPERATOR_SET = new Set<string>(COMPARISON_OPERATORS)

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos]!)) {
      pos++
      continue
    }

    // Single-character tokens
    if (input[pos] === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: pos })
      pos++
      continue
    }
    if (input[pos] === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: pos })
      pos++
      continue
    }
    if (input[pos] === ',') {
      tokens.push({ type: 'COMMA', value: ',', position: pos })
      pos++
      continue
    }

    // String literal (single-quoted)
    if (input[pos] === "'") {
      const start = pos
      pos++ // skip opening quote
      let value = ''
      while (pos < input.length && input[pos] !== "'") {
        if (input[pos] === '\\' && pos + 1 < input.length && input[pos + 1] === "'") {
          value += "'"
          pos += 2
        } else {
          value += input[pos]
          pos++
        }
      }
      if (pos >= input.length) {
        throw new TokenizeError(`Unterminated string literal`, start)
      }
      pos++ // skip closing quote
      tokens.push({ type: 'STRING', value, position: start })
      continue
    }

    // Number literal (optional negative sign, digits, optional decimal)
    if (/[\d]/.test(input[pos]!) || (input[pos] === '-' && pos + 1 < input.length && /\d/.test(input[pos + 1]!))) {
      const start = pos
      if (input[pos] === '-') pos++
      while (pos < input.length && /\d/.test(input[pos]!)) pos++
      if (pos < input.length && input[pos] === '.' && pos + 1 < input.length && /\d/.test(input[pos + 1]!)) {
        pos++ // skip dot
        while (pos < input.length && /\d/.test(input[pos]!)) pos++
      }
      tokens.push({ type: 'NUMBER', value: input.slice(start, pos), position: start })
      continue
    }

    // Identifiers (field names, operators, logical keywords)
    if (/[a-zA-Z_]/.test(input[pos]!)) {
      const start = pos
      while (pos < input.length && /[a-zA-Z_]/.test(input[pos]!)) pos++
      const word = input.slice(start, pos)

      if (word === 'and') {
        tokens.push({ type: 'AND', value: word, position: start })
      } else if (word === 'or') {
        tokens.push({ type: 'OR', value: word, position: start })
      } else if (word === 'not') {
        tokens.push({ type: 'NOT', value: word, position: start })
      } else if (word === 'in') {
        tokens.push({ type: 'IN', value: word, position: start })
      } else if (OPERATOR_SET.has(word)) {
        tokens.push({ type: 'OPERATOR', value: word, position: start })
      } else if (FIELD_SET.has(word)) {
        tokens.push({ type: 'FIELD', value: word, position: start })
      } else {
        throw new TokenizeError(
          `Unknown identifier '${word}'. Expected a field name (${FILTER_FIELDS.join(', ')}) or operator`,
          start,
        )
      }
      continue
    }

    throw new TokenizeError(`Unexpected character '${input[pos]}'`, pos)
  }

  tokens.push({ type: 'EOF', value: '', position: pos })
  return tokens
}

export class TokenizeError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(`${message} at position ${String(position)}`)
    this.name = 'TokenizeError'
  }
}

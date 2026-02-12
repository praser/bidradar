import type { Token } from './tokenizer.js'
import {
  TEXT_FIELDS,
  NUMERIC_FIELDS,
  STRING_ONLY_OPERATORS,
  type FilterField,
  type ComparisonOperator,
  type FilterNode,
  type FilterValue,
} from './types.js'
import { tokenize, TokenizeError } from './tokenizer.js'

const TEXT_FIELD_SET = new Set<string>(TEXT_FIELDS)
const NUMERIC_FIELD_SET = new Set<string>(NUMERIC_FIELDS)
const STRING_ONLY_SET = new Set<string>(STRING_ONLY_OPERATORS)

const MAX_DEPTH = 20

export class FilterParseError extends Error {
  constructor(
    message: string,
    public readonly position?: number,
  ) {
    const suffix = position !== undefined ? ` at position ${String(position)}` : ''
    super(`${message}${suffix}`)
    this.name = 'FilterParseError'
  }
}

export function parseFilter(input: string): FilterNode {
  let tokens: Token[]
  try {
    tokens = tokenize(input)
  } catch (err) {
    if (err instanceof TokenizeError) {
      throw new FilterParseError(err.message)
    }
    throw err
  }

  let pos = 0
  let depth = 0

  function current(): Token {
    return tokens[pos]!
  }

  function expect(type: Token['type']): Token {
    const tok = current()
    if (tok.type !== type) {
      throw new FilterParseError(
        `Expected ${type} but got ${tok.type} '${tok.value}'`,
        tok.position,
      )
    }
    pos++
    return tok
  }

  function parseExpression(): FilterNode {
    return parseOr()
  }

  function parseOr(): FilterNode {
    let left = parseAnd()
    while (current().type === 'OR') {
      pos++ // consume 'or'
      const right = parseAnd()
      left = { type: 'or', left, right }
    }
    return left
  }

  function parseAnd(): FilterNode {
    let left = parseNot()
    while (current().type === 'AND') {
      pos++ // consume 'and'
      const right = parseNot()
      left = { type: 'and', left, right }
    }
    return left
  }

  function parseNot(): FilterNode {
    if (current().type === 'NOT') {
      pos++ // consume 'not'
      const operand = parseNot()
      return { type: 'not', operand }
    }
    return parsePrimary()
  }

  function parsePrimary(): FilterNode {
    if (current().type === 'LPAREN') {
      pos++ // consume '('
      depth++
      if (depth > MAX_DEPTH) {
        throw new FilterParseError(
          'Expression too deeply nested (max 20 levels)',
          current().position,
        )
      }
      const node = parseExpression()
      expect('RPAREN')
      depth--
      return node
    }
    return parseComparison()
  }

  function parseComparison(): FilterNode {
    const fieldToken = expect('FIELD')
    const field = fieldToken.value as FilterField

    // Handle 'in' operator
    if (current().type === 'IN') {
      pos++ // consume 'in'
      expect('LPAREN')
      const values = parseValueList(field)
      expect('RPAREN')
      return { type: 'in', field, values }
    }

    const opToken = expect('OPERATOR')
    const operator = opToken.value as ComparisonOperator

    // Validate string-only operators on numeric fields
    if (STRING_ONLY_SET.has(operator) && NUMERIC_FIELD_SET.has(field)) {
      throw new FilterParseError(
        `Operator '${operator}' cannot be used with numeric field '${field}'`,
        opToken.position,
      )
    }

    const value = parseValue(field, opToken.position)
    return { type: 'comparison', field, operator, value }
  }

  function parseValueList(field: FilterField): FilterValue[] {
    const values: FilterValue[] = []
    values.push(parseValue(field, current().position))
    while (current().type === 'COMMA') {
      pos++ // consume ','
      values.push(parseValue(field, current().position))
    }
    return values
  }

  function parseValue(field: FilterField, errorPos: number): FilterValue {
    const tok = current()
    if (tok.type === 'STRING') {
      if (NUMERIC_FIELD_SET.has(field)) {
        throw new FilterParseError(
          `Field '${field}' is numeric but got string value '${tok.value}'`,
          tok.position,
        )
      }
      pos++
      return tok.value
    }
    if (tok.type === 'NUMBER') {
      if (TEXT_FIELD_SET.has(field)) {
        throw new FilterParseError(
          `Field '${field}' is a text field but got numeric value ${tok.value}`,
          tok.position,
        )
      }
      pos++
      return Number(tok.value)
    }
    throw new FilterParseError(
      `Expected a value (string or number) but got ${tok.type} '${tok.value}'`,
      errorPos,
    )
  }

  const ast = parseExpression()

  if (current().type !== 'EOF') {
    throw new FilterParseError(
      `Unexpected token '${current().value}' after expression`,
      current().position,
    )
  }

  return ast
}

export interface PropertyDetails {
  totalArea: number | null
  privateArea: number | null
  landArea: number | null
  bedrooms: number | null
  bathrooms: number | null
  livingRooms: number | null
  kitchens: number | null
  garageSpaces: number | null
  hasServiceArea: boolean
}

function parseArea(description: string, label: string): number | null {
  const match = description.match(
    new RegExp(`([\\d.]+) de ${label}`),
  )
  if (match?.[1] === undefined) return null
  return Number(match[1])
}

function parseCount(description: string, pattern: RegExp): number | null {
  const match = description.match(pattern)
  if (match === null) return null
  return match[1] !== undefined ? Number(match[1]) : 1
}

export function parseDescription(description: string): PropertyDetails {
  return {
    totalArea: parseArea(description, 'área total'),
    privateArea: parseArea(description, 'área privativa'),
    landArea: parseArea(description, 'área do terreno'),
    bedrooms: parseCount(description, /(\d+) qto\(s\)/),
    bathrooms: parseCount(description, /(\d+)?\s*WC/),
    livingRooms: parseCount(description, /(\d+) sala\(s\)/),
    kitchens: description.includes('cozinha') ? 1 : null,
    garageSpaces: parseCount(description, /(\d+) vaga\(s\) de garagem/),
    hasServiceArea: /a\.serv/.test(description),
  }
}

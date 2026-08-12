export function isEmbeddedMode(search: URLSearchParams | Readonly<Record<string, unknown>>): boolean {
  try {
    if (search instanceof URLSearchParams) {
      const values = search.getAll('embed')
      return values.length === 1 && values[0] === 'true'
    }

    return search.embed === true
  } catch {
    return false
  }
}

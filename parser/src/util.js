const regexpCache = Object.create(null)

export function wordsRegexp(words) {
  return regexpCache[words] || (regexpCache[words] = new RegExp("^(?:" + words.replace(/ /g, "|") + ")$"))
}

export const hasOwn = Object.hasOwn || ((obj, propName) => (
  hasOwnProperty.call(obj, propName)
))

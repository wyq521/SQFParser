// all keywords in sqf
export const SQFKeyWords = "if then else elseif switch do case default while for from to step foreach waituntil";

export function isIdentifierStart(ch) {
  return ch === 95 || // `_`
  ch >= 65 && ch <= 90 || // A...Z
  ch >= 97 && ch <= 122; // a...z
}

export function isIdentifierChar(ch) {
  return ch === 95 || // `_`
  ch >= 65 && ch <= 90 || // A...Z
  ch >= 97 && ch <= 122 || // a...z
  ch >= 48 && ch <= 57; // 0...9
}

// 判断给定的变量名是否是全局变量
export function isGlobalVariable(value) {
  return value.startsWith("_");
}

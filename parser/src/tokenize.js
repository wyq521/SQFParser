import { isIdentifierChar, isIdentifierStart } from './identifier';
import { Parser } from './state.js';
import { types as tt,keywords as keywordTypes } from './tokentype.js';
import { SourceLocation } from './locutil.js'

export class Token {
  constructor(p){
    this.type = p.type
    this.value = p.value
    this.start = p.start
    this.end = p.end
    if (p.options.locations)
      this.loc = new SourceLocation(p, p.startLoc, p.endLoc)
    if (p.options.ranges)
      this.range = [p.start, p.end]
  }
}

const pp = Parser.prototype;

pp.finishToken = function (type, val) {
  this.end = this.pos
  if (this.options.locations) this.endLoc = this.curPosition()
  let prevType = this.type
  this.type = type
  this.value = val

  this.updateContext(prevType)
}

pp.fullCharCodeAtPos = function () {
  return this.input.charCodeAt(this.pos);
}

pp.readWord1 = function () {
  let word = "", chunkStart = this.pos;
  while(this.pos<this.input.length){
    const ch = this.fullCharCodeAtPos();
    if(isIdentifierChar(ch)){
      this.pos++;
    }else {
      break;
    }
  }
  return word+this.input.slice(chunkStart,this.pos);
}

pp.readWord = function () {
  const word = this.readWord1();
  // 为word分配一个tokenType
  let type = tt.name;
  if(this.keywords.test(word)){
    type = tt.keywordTypes[word];
  }
  return this.finishToken(type,word);
}

pp.readInt = function(radix,len){
  let start = this.pos, total = 0, lastCode = 0;
  for (let i = 0, e = len == null ? Infinity : len; i < e; ++i, ++this.pos) {
    let code = this.input.charCodeAt(this.pos), val

    if (code >= 97) val = code - 97 + 10 // a
    else if (code >= 65) val = code - 65 + 10 // A
    else if (code >= 48 && code <= 57) val = code - 48 // 0-9
    else val = Infinity
    if (val >= radix) break
    lastCode = code
    total = total * radix + val
  }
  if (this.pos === start || len != null && this.pos - start !== len) return null
  return total;
}

pp.readRadixNumber = function(radix){
  // let start = this.pos
  this.pos += 2 // 0x
  let val = this.readInt(radix)
  if (val == null) this.raise(this.start + 2, "Expected number in radix " + radix)
  if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number")
  return this.finishToken(tt.num, val)
}

pp.readNumber = function(startsWithDot){
  let start = this.pos
  if (!startsWithDot && this.readInt(10, undefined, true) === null) this.raise(start, "Invalid number")
  let octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48
  if (octal && this.strict) this.raise(start, "Invalid number")
  let next = this.input.charCodeAt(this.pos)
  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
    let val = stringToBigInt(this.input.slice(start, this.pos))
    ++this.pos
    if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number")
    return this.finishToken(tt.num, val)
  }
  if (octal && /[89]/.test(this.input.slice(start, this.pos))) octal = false
  if (next === 46 && !octal) { // '.'
    ++this.pos
    this.readInt(10)
    next = this.input.charCodeAt(this.pos)
  }
  if ((next === 69 || next === 101) && !octal) { // 'eE'
    next = this.input.charCodeAt(++this.pos)
    if (next === 43 || next === 45) ++this.pos // '+-'
    if (this.readInt(10) === null) this.raise(start, "Invalid number")
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number")

  let val = stringToNumber(this.input.slice(start, this.pos), octal)
  return this.finishToken(tt.num, val)
}

//
pp.readEscapedChar = function(inTemplate) {
  let ch = this.input.charCodeAt(++this.pos)
  ++this.pos
  switch (ch) {
  case 110: return "\n" // 'n' -> '\n'
  case 114: return "\r" // 'r' -> '\r'
  case 116: return "\t" // 't' -> '\t'
  case 98: return "\b" // 'b' -> '\b'
  case 102: return "\f" // 'f' -> '\f'
  case 13: if (this.input.charCodeAt(this.pos) === 10) ++this.pos // '\r\n'
  case 10: // ' \n'
    if (this.options.locations) { this.lineStart = this.pos; ++this.curLine }
    return ""

  default:
    if (ch >= 48 && ch <= 55) { // 
      let octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0]
      let octal = parseInt(octalStr, 8)
      if (octal > 255) {
        octalStr = octalStr.slice(0, -1)
        octal = parseInt(octalStr, 8)
      }
      this.pos += octalStr.length - 1
      ch = this.input.charCodeAt(this.pos)
      if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
        this.invalidStringToken(
          this.pos - 1 - octalStr.length,
          inTemplate
            ? "Octal literal in template string"
            : "Octal literal in strict mode"
        )
      }
      return String.fromCharCode(octal)
    }
    if (isNewLine(ch)) {
      // Unicode new line characters after \ get removed from output in both
      // template literals and strings
      if (this.options.locations) { this.lineStart = this.pos; ++this.curLine }
      return ""
    }
    return String.fromCharCode(ch)
  }
}

pp.readHexChar = function(len) {
  let codePos = this.pos
  let n = this.readInt(16, len)
  if (n === null) this.invalidStringToken(codePos, "Bad character escape sequence")
  return n
}

pp.readString = function(quote) {
  let out = "", chunkStart = ++this.pos
  for (;;) {
    if (this.pos >= this.input.length) this.raise(this.start, "Unterminated string constant")
    let ch = this.input.charCodeAt(this.pos)
    if (ch === quote) break
    if (ch === 92) { // '\'
      out += this.input.slice(chunkStart, this.pos)
      out += this.readEscapedChar(false)
      chunkStart = this.pos
    } else if (ch === 0x2028 || ch === 0x2029) {
      if (this.options.ecmaVersion < 10) this.raise(this.start, "Unterminated string constant")
      ++this.pos
      if (this.options.locations) {
        this.curLine++
        this.lineStart = this.pos
      }
    } else {
      // if (isNewLine(ch)) this.raise(this.start, "Unterminated string constant")
      ++this.pos
    }
  }
  out += this.input.slice(chunkStart, this.pos++)
  console.log("readString:",out)
  return this.finishToken(tt.string, out)
}

pp.readToken_slash = function() {
  let next = this.input.charCodeAt(this.pos + 1)
  // sqf not has RegExp
  //if (this.exprAllowed) { ++this.pos; return this.readRegexp() }
  // sqf not has /= operator   
  //if (next === 61) return this.finishOp(tt.assign, 2)
  return this.finishOp(tt.slash, 1)
}

pp.readToken_mult_modulo_exp = function(code) {
  let size = 1
  let tokentype = code === 42 ? tt.star : tt.modulo

  return this.finishOp(tokentype, size)
}

// in ts ^ means: xor
// in sqf ^ means: raise to the power of
pp.readToken_caret = function(){
  let next = this.input.charCodeAt(this.pos + 1)
  // ^= 
  // if (next === 61) return this.finishOp(tt.assign, 2)
  // todo: fix ^ means
  return this.finishOp(tt.bitwiseXOR, 1)
}

pp.readToken_plus_min = function(code) { // '+-'
  // let next = this.input.charCodeAt(this.pos + 1)
  // if (next === code) {
  //   if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 &&
  //       (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
  //     // A `-->` line comment
  //     this.skipLineComment(3)
  //     this.skipSpace()
  //     return this.nextToken()
  //   }
  //   return this.finishOp(tt.incDec, 2)
  // }
  // if (next === 61) return this.finishOp(tt.assign, 2)
  return this.finishOp(tt.plusMin, 1)
}

pp.readToken_lt_gt = function(code) { // '<>'
  let next = this.input.charCodeAt(this.pos + 1)
  let size = 1
  // >= or <=
  if (next === 61) size = 2
  return this.finishOp(tt.relational, size)
}

pp.readToken_eq_excl = function(code) { // '=!'
  let next = this.input.charCodeAt(this.pos + 1)
  if (next === 61) return this.finishOp(tt.equality, 2)
  return this.finishOp(code === 61 ? tt.eq : tt.prefix, 1)
}

pp.finishOp = function(type, size) {
  let str = this.input.slice(this.pos, this.pos + size)
  this.pos += size
  return this.finishToken(type, str)
}

pp.getTokenFromCode = function(code){
  switch (code) {

    // deal with punctuation
    case 40: ++this.pos; return this.finishToken(tt.parenL)
    case 41: ++this.pos; return this.finishToken(tt.parenR)
    case 59: ++this.pos; return this.finishToken(tt.semi)
    case 44: ++this.pos; return this.finishToken(tt.comma)
    case 91: ++this.pos; return this.finishToken(tt.bracketL)
    case 93: ++this.pos; return this.finishToken(tt.bracketR)
    case 123: ++this.pos; return this.finishToken(tt.braceL)
    case 125: ++this.pos; return this.finishToken(tt.braceR)
    case 58: ++this.pos; return this.finishToken(tt.colon)

    case 48: // 0
      let next = this.input.charCodeAt(this.pos + 1)
      if (next === 120 || next === 88) return this.readRadixNumber(16) // '0x', '0X' - hex number
      // sqf 不支持定义二进制和八进制字面量
      // if (this.options.ecmaVersion >= 6) {
      //   if (next === 111 || next === 79) return this.readRadixNumber(8) // '0o', '0O' - octal number
      //   if (next === 98 || next === 66) return this.readRadixNumber(2) // '0b', '0B' - binary number
      // }

    case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
      return this.readNumber(false)
    case 34: case 39: // '"', "'"
      return this.readString(code)

    // operator
    case 47: // '/'
      return this.readToken_slash()
  
    case 37: case 42: // '%*'
      return this.readToken_mult_modulo_exp(code)
  
    case 94: // '^'
      return this.readToken_caret()
  
    case 43: case 45: // '+-'
      return this.readToken_plus_min(code)
  
    case 60: case 62: // '<>'
      return this.readToken_lt_gt(code)
  
    case 61: case 33: // '=!'
      return this.readToken_eq_excl(code)
  
    case 126: // '~'
      return this.finishOp(tt.prefix, 1)
  
  }
}

pp.skipBlockComment = function() {
  let startLoc = this.options.onComment && this.curPosition()
  let start = this.pos, end = this.input.indexOf("*/", this.pos += 2)
  if (end === -1) this.raise(this.pos - 2, "Unterminated comment")
  this.pos = end + 2
  if (this.options.locations) {
    for (let nextBreak, pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1;) {
      ++this.curLine
      pos = this.lineStart = nextBreak
    }
  }
  if (this.options.onComment)
    this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos,
                           startLoc, this.curPosition())
}

pp.skipLineComment = function(startSkip) {
  let start = this.pos
  let startLoc = this.options.onComment && this.curPosition()
  let ch = this.input.charCodeAt(this.pos += startSkip)
  while (this.pos < this.input.length && !isNewLine(ch)) {
    ch = this.input.charCodeAt(++this.pos)
  }
  if (this.options.onComment)
    this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos,
                           startLoc, this.curPosition())
}

// Called at the start of the parse and after every token. Skips
// whitespace and comments, and.
pp.skipSpace = function() {
  loop: while (this.pos < this.input.length) {
    let ch = this.input.charCodeAt(this.pos)
    switch (ch) {
    case 32: case 160: // ' '
      ++this.pos
      break
    case 13:           // '\r'
      if (this.input.charCodeAt(this.pos + 1) === 10) {
        ++this.pos
      }
    case 10: case 8232: case 8233: // '\n'
      ++this.pos
      if (this.options.locations) {
        ++this.curLine
        this.lineStart = this.pos
      }
      break
    case 47: // '/'
      switch (this.input.charCodeAt(this.pos + 1)) {
      case 42: // '*' - block comment
        this.skipBlockComment()
        break
      case 47: // '/' - line comment
        this.skipLineComment(2)
        break
      default:
        break loop
      }
      break
    default:
      if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
        ++this.pos
      } else {
        break loop
      }
    }
  }
}

pp.readToekn = function (code) {
  if(isIdentifierStart(code))
    return this.readWord();
  return this.getTokenFromCode(code); 
}

pp.nextToken = function(){
  let curContext = this.curContext()
  if(!curContext||!curContext.preserveSpace) this.skipSpace()

  // todo: what about context?
  this.start = this.pos;
  if (this.options.locations) this.startLoc = this.curPosition()
  if(this.pos>=this.input.length) return this.finishToken(tt.eof);

  if (curContext.override) return curContext.override(this)
  else this.readToken(this.fullCharCodeAtPos())
}

pp.next = function(){
  // if (!ignoreEscapeSequenceInKeyword && this.type.keyword && this.containsEsc)
  //   this.raiseRecoverable(this.start, "Escape sequence in keyword " + this.type.keyword) 
  if(this.options.onToken) 
    this.options.onToken(new Token(this))
  
  this.lastTokEnd = this.end
  this.lastTokStart = this.start
  this.lastTokEndLoc = this.endLoc
  this.lastTokStartLoc = this.startLoc
  this.nextToken()
}

pp.getToken = function(){
  this.next();
  return new Token(this);
}

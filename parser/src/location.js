import {Parser} from "./state.js"
import {Position, getLineInfo} from "./locutil.js"

const pp = Parser.prototype

pp.raise = function(pos, message) {
  let loc = getLineInfo(this.input, pos)
  message += " (" + loc.line + ":" + loc.column + ")"
  let err = new SyntaxError(message)
  err.pos = pos; err.loc = loc; err.raisedAt = this.pos
  throw err
}

pp.raiseRecoverable = pp.raise

pp.curPosition = function() {
  if (this.options.locations) {
    return new Position(this.curLine, this.pos - this.lineStart)
  }
}

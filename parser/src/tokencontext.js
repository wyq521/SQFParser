import { Parser } from "./parser";
import { types as tt } from "./tokentype";
import { lineBreak } from "./whitespace";

export class TokContext {
  constructor(token, isExpr, preserveSpace, override, generator) {
    this.token = token
    this.isExpr = !!isExpr
    this.preserveSpace = !!preserveSpace
    this.override = override
    this.generator = !!generator
  }
}

export const types = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  f_stat: new TokContext("function", false),
  f_expr: new TokContext("function", true),
}

const pp = Parser.prototype

pp.initialContext = function(){
  return [types.b_stat];
}

pp.curContext = function(){
  return this.context[this.context.length-1];
}

pp.updateContext = function() {
  let update, type = this.type
  if (type.keyword && prevType === tt.dot)
    this.exprAllowed = false
  else if (update = type.updateContext)
    update.call(this, prevType)
  else
    this.exprAllowed = type.beforeExpr
}

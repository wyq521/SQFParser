import { Parser } from "./state"; 

const pp = Parser.prototype;

pp.eat = function(type){
  if(this.type === type){
    this.next();
    return true;
  }else {
    return false;
  }
}

// Expect a token of a given type. If found, consume it, otherwise,
// raise an unexpected token error.

pp.expect = function(type) {
  this.eat(type) || this.unexpected()
}

// Raise an unexpected token error.
pp.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token")
}

// Consume a semicolon, or, failing that, see if we are allowed to
// pretend that there is a semicolon at this position.
pp.semicolon = function() {
  if (!this.eat(tt.semi)) this.unexpected()
}

pp.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
  if (!refDestructuringErrors) return false
  let {shorthandAssign, doubleProto} = refDestructuringErrors
  if (!andThrow) return shorthandAssign >= 0 || doubleProto >= 0
  if (shorthandAssign >= 0)
    this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns")
  if (doubleProto >= 0)
    this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property")
}

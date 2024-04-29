import {Parser} from "./state.js"

const pp = Parser.prototype;

class Scope {
  constructor(flags){
    this.flags = flags;
    // A list of var-declared names in the current lexical scope
    this.var = [];
    // A list of lexically-declared names in the current lexical scope
    this.lexical = []
    // A list of lexically-declared FunctionDeclaration names in the current lexical scope
    this.functions = []
    // A switch to disallow the identifier reference 'arguments'
    this.inClassFieldInit = false
  }
}

pp.enterScope = function(flags){
  this.scopeStack.push(new Scope(flags))
}

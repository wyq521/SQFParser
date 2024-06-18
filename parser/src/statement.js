import { types as tt } from "./tokentype";
import { Parser } from "./state";

const pp = Parser.prototype
const loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"}

// Statement parsing
// Types of statements in sqf
// 1. Value assignment
// 2. Control structure
// 3. Command
pp.parseTopLevel = function(node) {
  
  if(!node.body) node.body = [];
  while(this.type !== tt.eof){
    let stmt = this.parseStatement();
    node.body.push(stmt);
  }
}

// parse a single statement
pp.parseStatement = function(context,topLevel,exports){
  let starttype = this.type;
  let node = this.startNode();
  let kind;
  // 刚开始的token如果是个变量名
  switch(starttype) {
    case tt._breakOut: case tt._breakTo: return this.parseBreakStatement(node,starttype.keyword) 
    case tt._for: return 
  }
}

// breakTo and breakOut sntax in sqf is
// 1. breakTo name
// 2. breakOut name
// name is a string
pp.parseBreakStatement = function(node, keyword) {
  let isBreak = true;
  this.next();
  if(this.type !== tt.string) this.unexpected();
  else {
    // parse the name as an identifier, also need parse then scopename as an identifier
    // 检查是否有匹配的scopename
    node.label = this.parseIdent();
    this.semicolon()
  }
  // Verify that there is an actual destination to break or
  // continue to.
  //判断是否在循环语境内
  let i=0;
  for(;i<this.labels.length;i++){
    let lab = this.labels[i];
    if (lab.kind != null && (isBreak || lab.kind === "loop")) break
    if (node.label && isBreak) break    
  }
  if (i === this.labels.length) this.raise(node.start, "Unsyntactic " + keyword)
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement")
}

// for 循环有两种形式
// 1. for [{BEGIN},{CONDITION},{STEP}] do {};
// 形式1: 
// BEGIN里必须有变量的初始化，同时变量必须是局部变量，而不能是全局变量
// CONDITION 和 STEP 都必须是表达式
// 2. for "VARNAME" from STARTVALUE to ENDVALUE step STEP do {};
// VARNAME 必须是局部变量
// 使用step自定义步长
pp.parseForStatement = function(node) {
  this.next();
  this.labels.push(loopLabel);
  this.enterScope(0)
  // 区分两种形式
  // 1. [
  // 2. "VARNAME"
  if(this.type==tt.bracketL){
    this.parseFor(); 
  }else if(this.type==tt.string){
    // parse {BEGIN}
    this.next();
    if(this.type !== tt.braceL) return this.unexpected();
    let init = this.startNode(),kind = "let"; 
    this.next();
    this.parseVar(init, true, kind, false);
    this.eat(tt.braceR);
    this.finishNode(init, "VariableDeclaration")
  }else {
    return this.unexpected();
  }
}

// sqf for中是否支持空下，test和update语句
pp.parseFor = function(node,init) {
  node.init = init;
  this.expect(tt.comma);
  // parse {CONDITION}
  // 先把花括号吃掉，还是开个新节点，花括号包进来
  node.test = this.type === tt.semi ? null : this.parseExpression()
  this.expect(tt.semi)
  node.update = this.type === tt.parenR ? null : this.parseExpression()
  this.expect(tt.parenR)
  node.body = this.parseStatement("for")
  this.exitScope()
  this.labels.pop()
  return this.finishNode(node, "ForStatement")
}

pp.parseFromTo = function() {

}

pp.parseVar = function(node, isFor, kind, allowMissingInitializer) {
  node.declarations = []
  node.kind = kind
  for (;;) {
    let decl = this.startNode()
    this.parseVarId(decl, kind)
    if (this.eat(tt.eq)) {
      decl.init = this.parseMaybeAssign(isFor)
    } else if (!allowMissingInitializer){
      this.unexpected()
    } else {
      decl.init = null
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"))
    if (!this.eat(tt.comma)) break
  }
  return node
}

// sqf 
pp.parseVarId = function(decl,kind){
  // parseIdent 内含一个next()调用
  decl.id = this.parseIdent();
  this.checkLValSimple(decl.id,kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
}


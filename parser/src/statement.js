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
// 2. for "VARNAME" from STARTVALUE to ENDVALUE step STEP do {};
pp.parseForStatement = function(node) {
  this.next();
  this.labels.push(loopLabel);
  this.enterScope(0)
  // 区分两种形式
  // 1. [
  // 2. "VARNAME"
  if(this.type==tt.bracketL){

  }else if(this.type==tt.string){

  }else {
    return this.unexpected();
  }
}

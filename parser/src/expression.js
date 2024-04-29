import { types as tt } from "./tokentype";
import { Parser } from "./state";

const pp = Parser.prototype;

// Parse the next token as an identifier.
pp.parseIdent = function(liberal) {
  let node = this.parseIdentNode();
  this.next();
  this.finishNode(node, "Identifier")
  // if (!liberal) {
  //   this.checkUnreserved(node)
  //   if (node.name === "await" && !this.awaitIdentPos)
  //     this.awaitIdentPos = node.start
  // }
  return node;
}

pp.parseIdentNode = function() {
  let node = this.startNode();
  if(this.type === tt.name||this.type===tt.string){
    node.name = this.value;
  }
  /* 下面的情况在breakOut and breakTo 里不存在，其他地方还不清楚
  else if(this.type.keyword) {
    node.name = this.type.keyword

    // To fix https://github.com/acornjs/acorn/issues/575
    // `class` and `function` keywords push new context into this.context.
    // But there is no chance to pop the context if the keyword is consumed as an identifier such as a property name.
    // If the previous token is a dot, this does not apply because the context-managing code already ignored the keyword
    if ((node.name === "class" || node.name === "function") &&
      (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
      this.context.pop()
    }
    this.type = tt.name
  }*/
  else{
    this.unexpected();
  }
  return node;
}

import { Parser } from "./state";
import { SourceLocation } from "./locutil";
export class Node {
  constructor(parser, pos, loc) {
    this.type = "";
    this.start = pos;
    this.end = 0;
    if (parser.options.locations) this.loc = new SourceLocation(parser, loc);
    if (parser.options.directSourceFile)
      this.sourceFile = parser.options.directSourceFile;
    if (parser.options.ranges) this.range = [pos, 0];
  }
}

const pp = Parser.prototype

// start an AST node
pp.startNode = function(){
  return new Node(this,this.start,this.startLoc)
}

// Finish an AST node
function finishNodeAt(node, type, pos, loc) {
  node.type = type
  node.end = pos
  if (this.options.locations)
    node.loc.end = loc
  if (this.options.ranges)
    node.range[1] = pos
  return node
}

pp.finishNode = function(node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)
}

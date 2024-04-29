import { SQFKeyWords } from './identifier';
import { wordsRegexp } from './util';
export class Parser {
  constructor(options, input, startPos) {
    this.input = String(input);
    this.options = options;
    this.keywords = wordsRegexp(SQFKeyWords);
    // The current position of the tokenizer in the input.
    if (startPos) {
      this.pos = startPos
      this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1
      this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length
    } else {
      this.pos = this.lineStart = 0
      this.curLine = 1
    }

    // Properties of the current token:
    // Its type
    this.type = tt.eof
    // For tokens that include more information than their type, the value
    this.value = null
    // Its start and end offset
    this.start = this.end = this.pos
    // And, if locations are used, the {line, column} object
    // corresponding to those offsets
    this.startLoc = this.endLoc = this.curPosition()

    // Position information for the previous token
    this.lastTokEndLoc = this.lastTokStartLoc = null
    this.lastTokStart = this.lastTokEnd = this.pos

    // labels in scope.
    this.labels = [];
    // The context stack is used to superficially track syntactic
    // context to predict whether a regular expression is allowed in a
    // given position.
    // how to use it in sqf? 
    this.context = this.initialContext()

  }

  parse(){
    let node = this.options.program||this.startNode();
    this.nextToken();
    return this.parseTopLevel(node)
  }
}

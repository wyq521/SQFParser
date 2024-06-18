import { types as tt } from "./tokentype";
import { Parser } from "./state";

const pp = Parser.prototype;

// Parse the next token as an identifier.
pp.parseIdent = function (liberal) {
  let node = this.parseIdentNode();
  this.next();
  this.finishNode(node, "Identifier");
  // if (!liberal) {
  //   this.checkUnreserved(node)
  //   if (node.name === "await" && !this.awaitIdentPos)
  //     this.awaitIdentPos = node.start
  // }
  return node;
};

pp.parseIdentNode = function () {
  let node = this.startNode();
  if (this.type === tt.name || this.type === tt.string) {
    node.name = this.value;
  } else {
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
    this.unexpected();
  }
  return node;
};

pp.parseMaybeAssign = function (
  forInit,
  refDestructuringErrors,
  afterLeftParse
) {
  let ownDestructuringErrors = false,
    oldParenAssign = -1,
    oldTrailingComma = -1,
    oldDoubleProto = -1;
  if (refDestructuringErrors) {
    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
    oldTrailingComma = refDestructuringErrors.trailingComma;
    oldDoubleProto = refDestructuringErrors.doubleProto;
    refDestructuringErrors.parenthesizedAssign =
      refDestructuringErrors.trailingComma = -1;
  } else {
    refDestructuringErrors = new DestructuringErrors();
    ownDestructuringErrors = true;
  }

  let startPos = this.start,
    startLoc = this.startLoc;
  if (this.type === tt.parenL || this.type === tt.name) {
    this.potentialArrowAt = this.start;
    this.potentialArrowInForAwait = forInit === "await";
  }
  // parse 条件表达式,sqf中没有这个语法
  // let left = this.parseMaybeConditional(forInit, refDestructuringErrors)
  let left = ;
  if (afterLeftParse)
    left = afterLeftParse.call(this, left, startPos, startLoc);
  if (this.type.isAssign) {
    let node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    if (this.type === tt.eq)
      left = this.toAssignable(left, false, refDestructuringErrors);
    if (!ownDestructuringErrors) {
      refDestructuringErrors.parenthesizedAssign =
        refDestructuringErrors.trailingComma =
        refDestructuringErrors.doubleProto =
          -1;
    }
    if (refDestructuringErrors.shorthandAssign >= left.start)
      refDestructuringErrors.shorthandAssign = -1; // reset because shorthand default was used correctly
    // sqf中直接check LValSimple 即可
    // if (this.type === tt.eq)
    //   this.checkLValPattern(left)
    // else
    //   this.checkLValSimple(left)
    this.checkLValSimple(left);
    node.left = left;
    this.next();
    node.right = this.parseMaybeAssign(forInit);
    if (oldDoubleProto > -1)
      refDestructuringErrors.doubleProto = oldDoubleProto;
    return this.finishNode(node, "AssignmentExpression");
  } else {
    if (ownDestructuringErrors)
      this.checkExpressionErrors(refDestructuringErrors, true);
  }
  if (oldParenAssign > -1)
    refDestructuringErrors.parenthesizedAssign = oldParenAssign;
  if (oldTrailingComma > -1)
    refDestructuringErrors.trailingComma = oldTrailingComma;
  return left;
};

pp.parseExprOps = function(forInit, refDestructuringErrors) {
  let startPos = this.start, startLoc = this.startLoc
  let expr = this.parseMaybeUnary(refDestructuringErrors, false, false, forInit)
  if (this.checkExpressionErrors(refDestructuringErrors)) return expr
  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, forInit)
}

pp.parseMaybeUnary = function (
  refDestructuringErrors,
  sawUnary,
  incDec,
  forInit
) {
  if (this.type.prefix) {
    let node = this.startNode(),
    update = this.type === tt.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(null, true, update, forInit);
    this.checkExpressionErrors(refDestructuringErrors, true);
    if (update) this.checkLValSimple(node.argument);
    else if (
      this.strict &&
      node.operator === "delete" &&
      isLocalVariableAccess(node.argument)
    )
      this.raiseRecoverable(
        node.start,
        "Deleting local variable in strict mode"
      );
    else if (node.operator === "delete" && isPrivateFieldAccess(node.argument))
      this.raiseRecoverable(node.start, "Private fields can not be deleted");
    else sawUnary = true;
    expr = this.finishNode(
      node,
      update ? "UpdateExpression" : "UnaryExpression"
    );
  } else {
    expr = this.parseExprSubscripts(refDestructuringErrors, forInit);
    if (this.checkExpressionErrors(refDestructuringErrors)) return expr;
    while (this.type.postfix && !this.canInsertSemicolon()) {
      let node = this.startNodeAt(startPos, startLoc);
      node.operator = this.value;
      node.prefix = false;
      node.argument = expr;
      this.checkLValSimple(expr);
      this.next();
      expr = this.finishNode(node, "UpdateExpression");
    }
  }
};

// Parse call, dot, and `[]`-subscript expressions.
pp.parseExprSubscripts = function(refDestructuringErrors, forInit) {
  let startPos = this.start, startLoc = this.startLoc
  let expr = this.parseExprAtom(refDestructuringErrors, forInit)
  if (expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")")
    return expr
  let result = this.parseSubscripts(expr, startPos, startLoc, false, forInit)
  if (refDestructuringErrors && result.type === "MemberExpression") {
    if (refDestructuringErrors.parenthesizedAssign >= result.start) refDestructuringErrors.parenthesizedAssign = -1
    if (refDestructuringErrors.parenthesizedBind >= result.start) refDestructuringErrors.parenthesizedBind = -1
    if (refDestructuringErrors.trailingComma >= result.start) refDestructuringErrors.trailingComma = -1
  }
  return result
}

pp.parseSubscripts = function() {
  let maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" &&
      this.lastTokEnd === base.end && !this.canInsertSemicolon() && base.end - base.start === 5 &&
      this.potentialArrowAt === base.start
  let optionalChained = false

  while (true) {
    let element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit)

    if (element.optional) optionalChained = true
    if (element === base || element.type === "ArrowFunctionExpression") {
      if (optionalChained) {
        const chainNode = this.startNodeAt(startPos, startLoc)
        chainNode.expression = element
        element = this.finishNode(chainNode, "ChainExpression")
      }
      return element
    }

    base = element
  }
}

pp.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow, optionalChained, forInit) {
  let computed = this.eat(tt.bracketL)
  if (computed || (optional && this.type !== tt.parenL && this.type !== tt.backQuote) || this.eat(tt.dot)) {
    let node = this.startNodeAt(startPos, startLoc)
    node.object = base
    if (computed) {
      node.property = this.parseExpression()
      this.expect(tt.bracketR)
    } else if (this.type === tt.privateId && base.type !== "Super") {
      node.property = this.parsePrivateIdent()
    } else {
      node.property = this.parseIdent(this.options.allowReserved !== "never")
    }
    node.computed = !!computed
    if (optionalSupported) {
      node.optional = optional
    }
    base = this.finishNode(node, "MemberExpression")
  } else if (!noCalls && this.eat(tt.parenL)) {
    let refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos
    this.yieldPos = 0
    this.awaitPos = 0
    this.awaitIdentPos = 0
    let exprList = this.parseExprList(tt.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors)
    if (maybeAsyncArrow && !optional && this.shouldParseAsyncArrow()) {
      this.checkPatternErrors(refDestructuringErrors, false)
      this.checkYieldAwaitInDefaultParams()
      if (this.awaitIdentPos > 0)
        this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function")
      this.yieldPos = oldYieldPos
      this.awaitPos = oldAwaitPos
      this.awaitIdentPos = oldAwaitIdentPos
      return this.parseSubscriptAsyncArrow(startPos, startLoc, exprList, forInit)
    }
    this.checkExpressionErrors(refDestructuringErrors, true)
    this.yieldPos = oldYieldPos || this.yieldPos
    this.awaitPos = oldAwaitPos || this.awaitPos
    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos
    let node = this.startNodeAt(startPos, startLoc)
    node.callee = base
    node.arguments = exprList
    if (optionalSupported) {
      node.optional = optional
    }
    base = this.finishNode(node, "CallExpression")
  } else if (this.type === tt.backQuote) {
    if (optional || optionalChained) {
      this.raise(this.start, "Optional chaining cannot appear in the tag of tagged template expressions")
    }
    let node = this.startNodeAt(startPos, startLoc)
    node.tag = base
    node.quasi = this.parseTemplate({isTagged: true})
    base = this.finishNode(node, "TaggedTemplateExpression")
  }
  return base
}

// Parse an atomic expression — either a single token that is an
// expression, an expression started by a keyword like `function` or
// `new`, or an expression wrapped in punctuation like `()`, `[]`,
// or `{}`.

pp.parseExprAtom = function(refDestructuringErrors, forInit, forNew) {
  // If a division operator appears in an expression position, the
  // tokenizer got confused, and we force it to read a regexp instead.
  // sqf 中没有正则表达式，没有这个困扰
  // if (this.type === tt.slash) this.readRegexp()

  let node, canBeArrow = this.potentialArrowAt === this.start
  switch (this.type) {
  case tt._super:
    if (!this.allowSuper)
      this.raise(this.start, "'super' keyword outside a method")
    node = this.startNode()
    this.next()
    if (this.type === tt.parenL && !this.allowDirectSuper)
      this.raise(node.start, "super() call outside constructor of a subclass")
    // The `super` keyword can appear at below:
    // SuperProperty:
    //     super [ Expression ]
    //     super . IdentifierName
    // SuperCall:
    //     super ( Arguments )
    if (this.type !== tt.dot && this.type !== tt.bracketL && this.type !== tt.parenL)
      this.unexpected()
    return this.finishNode(node, "Super")

  case tt._this:
    node = this.startNode()
    this.next()
    return this.finishNode(node, "ThisExpression")

  case tt.name:
    let startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc
    let id = this.parseIdent(false)
    if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(tt._function)) {
      this.overrideContext(tokenCtxTypes.f_expr)
      return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true, forInit)
    }
    if (canBeArrow && !this.canInsertSemicolon()) {
      if (this.eat(tt.arrow))
        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false, forInit)
      if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === tt.name && !containsEsc &&
          (!this.potentialArrowInForAwait || this.value !== "of" || this.containsEsc)) {
        id = this.parseIdent(false)
        if (this.canInsertSemicolon() || !this.eat(tt.arrow))
          this.unexpected()
        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true, forInit)
      }
    }
    return id

  case tt.regexp:
    let value = this.value
    node = this.parseLiteral(value.value)
    node.regex = {pattern: value.pattern, flags: value.flags}
    return node

  case tt.num: case tt.string:
    return this.parseLiteral(this.value)

  case tt._null: case tt._true: case tt._false:
    node = this.startNode()
    node.value = this.type === tt._null ? null : this.type === tt._true
    node.raw = this.type.keyword
    this.next()
    return this.finishNode(node, "Literal")

  case tt.parenL:
    let start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow, forInit)
    if (refDestructuringErrors) {
      if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr))
        refDestructuringErrors.parenthesizedAssign = start
      if (refDestructuringErrors.parenthesizedBind < 0)
        refDestructuringErrors.parenthesizedBind = start
    }
    return expr

  case tt.bracketL:
    node = this.startNode()
    this.next()
    node.elements = this.parseExprList(tt.bracketR, true, true, refDestructuringErrors)
    return this.finishNode(node, "ArrayExpression")

  case tt.braceL:
    this.overrideContext(tokenCtxTypes.b_expr)
    return this.parseObj(false, refDestructuringErrors)

  case tt._function:
    node = this.startNode()
    this.next()
    return this.parseFunction(node, 0)

  case tt._class:
    return this.parseClass(this.startNode(), false)

  case tt._new:
    return this.parseNew()

  case tt.backQuote:
    return this.parseTemplate()

  case tt._import:
    if (this.options.ecmaVersion >= 11) {
      return this.parseExprImport(forNew)
    } else {
      return this.unexpected()
    }

  default:
    return this.parseExprAtomDefault()
  }
}

pp.parseLiteral = function(value) {
  let node = this.startNode()
  node.value = value
  node.raw = this.input.slice(this.start, this.end)
  if (node.raw.charCodeAt(node.raw.length - 1) === 110) node.bigint = node.raw.slice(0, -1).replace(/_/g, "")
  this.next()
  return this.finishNode(node, "Literal")
}

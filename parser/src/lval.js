import { types as tt } from "./tokentype.js";
import { Parser } from "./state.js";
import { hasOwn } from "./util.js";
import { BIND_NONE, BIND_OUTSIDE, BIND_LEXICAL } from "./scopeflags.js";

const pp = Parser.prototype;

// 检查node节点是否可以被赋值
pp.toAssignable = function (node, isBinding, refDestructuringErrors) {
  switch (node.type){
    case "Identifier":
      // 留个js的例子在这里，后续补充为sqf的命名规则
      if (this.inAsync && node.name === "await")
        this.raise(node.start, "Cannot use 'await' as identifier inside an async function")
      break
  }
  return node;
}

pp.checkLValSimple = function (expr, bindingType = BIND_NONE, checkClashes) {
  const isBind = bindingType !== BIND_NONE;

  switch (expr.type) {
    case "Identifier":
      if (this.strict && this.reservedWordsStrictBind.test(expr.name))
        this.raiseRecoverable(
          expr.start,
          (isBind ? "Binding " : "Assigning to ") +
            expr.name +
            " in strict mode"
        );
      if (isBind) {
        if (bindingType === BIND_LEXICAL && expr.name === "let")
          this.raiseRecoverable(
            expr.start,
            "let is disallowed as a lexically bound name"
          );
        if (checkClashes) {
          if (hasOwn(checkClashes, expr.name))
            this.raiseRecoverable(expr.start, "Argument name clash");
          checkClashes[expr.name] = true;
        }
        if (bindingType !== BIND_OUTSIDE)
          this.declareName(expr.name, bindingType, expr.start);
      }
      break;

    case "ChainExpression":
      this.raiseRecoverable(
        expr.start,
        "Optional chaining cannot appear in left-hand side"
      );
      break;

    case "MemberExpression":
      if (isBind)
        this.raiseRecoverable(expr.start, "Binding member expression");
      break;

    case "ParenthesizedExpression":
      if (isBind)
        this.raiseRecoverable(expr.start, "Binding parenthesized expression");
      return this.checkLValSimple(expr.expression, bindingType, checkClashes);

    default:
      this.raise(expr.start, (isBind ? "Binding" : "Assigning to") + " rvalue");
  }
};

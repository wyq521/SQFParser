var Parser = require('../parser');
var P = Parser.Parser;
const p1 = new P({}, '"\babc"');
console.log(p1.pos)
console.log(p1.getTokenFromCode(34));
console.log(p1.pos)

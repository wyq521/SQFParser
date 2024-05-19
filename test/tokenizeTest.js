var Parser = require('../parser');
var P = Parser.Parser;
const p1 = new P({}, 'for (let i=0;i<10;i++){}');
p1.parse();

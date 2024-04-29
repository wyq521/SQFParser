import { Parser } from "./state"; 

const pp = Parser.prototype;

pp.eat = function(type){
  if(this.type === type){
    this.next();
    return true;
  }else {
    return false;
  }
}

// Raise an unexpected token error.
pp.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token")
}

// Consume a semicolon, or, failing that, see if we are allowed to
// pretend that there is a semicolon at this position.
pp.semicolon = function() {
  if (!this.eat(tt.semi)) this.unexpected()
}

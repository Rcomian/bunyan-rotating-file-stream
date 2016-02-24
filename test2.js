var path = require('path');

function x(p) {
    console.log('parse', p, path.parse(path.resolve(p)));
}

x('/hello/world');
x('/this/that.txt');
x('/this/that/');
x('/far/away%n.log');
x('/boo/%n.yah');
x('hello/world');
x('this/that.txt');
x('this/that/');
x('far/away%n.log');
x('boo/%n.yah');
x('world');
x('that.txt');
x('that/');
x('away%n.log');
x('%n.yah');

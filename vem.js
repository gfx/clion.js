#!/usr/bin/env node
"use strict";
var p = console.log;

var fs = require('fs');

var name  = process.argv[2] || '/dev/stdin';
var buffer = fs.readFileSync(name).toString().split(/\n+/);
var i;
for(i = 0; i < buffer.length; i++) {
    if(buffer[i].match(/\.entrypoint$/)) {
        break;
    }
}
var ops = [];
for(; i < buffer.length; i++) {
    var matched = buffer[i].match(/IL_(....):\s+(\w+)\s*(.*)$/);
    if(matched) {
        var label = matched[1];
        var name  = matched[2];
        var args  = matched[3];
        ops.push({ label: label, name: name, args: args });
    }
    else if(buffer[i].match(/^\s*\}/)) {
        break;
    }
}

// execute
(function() {
    var stack = [];
    var registory = [];
    var method = {
        'System.Console::WriteLine': function(arg) {
            console.log("%s", arg);
        },
        'string::Concat': function(a, b) {
            return String(a) + String(b);
        },
    };
    var i, op;
    for(i = 0; i < ops.length; i++) {
        op = ops[i];
        switch(op.name) {
        case "ldstr":
            stack.push( eval(op.args) );
            break;
        case "call":
            var m      = op.args.match(/(\w+(?:\.\w+)*::\w+)\((.*)\)/);
            var name   = m[1];
            var argc   = m[2].split(/,/).length;
            var args   = stack.splice( stack.length - argc );
            stack.push( method[name].apply(this, args) );
            break;

        case "stloc":
            var idx = op.args.match(/\d+/)[0];
            registory[idx] = stack.pop();
            break;
        case "ldloc":
            var idx = op.args.match(/\d+/)[0];
            stack.push(registory[idx]);
            break;
        case "ret":
            return;
        default: throw Error("Not yet implemented: " + op.name);
        }
    }
})();

#!/usr/bin/env node
"use strict";
var util  = require('util');
var Clion = require("..");
var dir   = __dirname + "/r";

var logs = '';

Clion.console.write_line = function(str) {
    logs += str;
};

describe("hello.exe", function() {
    var img = Clion.load_from_file(dir + "/hello.exe");

    describe("load_from_file", function() {
        img.guid.should.exist;
    });

    describe("run #0", function() {
        it("print to console", function() {
            logs = '';
            img.run();
            logs.should.equal("Hello, world!");
        });
    });
    describe("run #1", function() {
        it("print to console", function() {
            logs = '';
            img.run();
            logs.should.equal("Hello, world!");
        });
    });
});

describe("addnum.exe", function() {
    var img = Clion.load_from_file(dir + "/addnum.exe");

    describe("load_from_file", function() {
        img.guid.should.exist;
    });

    describe("run #0", function() {
        it("print to console", function() {
            logs = '';
            img.run();
            logs.should.equal("42");
        });
    });
    describe("run #1", function() {
        it("print to console", function() {
            logs = '';
            img.run();
            logs.should.equal("42");
        });
    });
});

describe("subnum.exe", function() {
    var img = Clion.load_from_file(dir + "/subnum.exe");

    describe("run #0", function() {
        it("print to console", function() {
            logs = '';
            img.run();
            logs.should.equal("38");
        });
    });
    describe("run #1", function() {
        it("print to console", function() {
            logs = '';
            img.run();
            logs.should.equal("38");
        });
    });
});

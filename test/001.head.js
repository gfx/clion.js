#!/usr/bin/env node
"use strict";

var Clion = require("..");
var exe = __dirname + "/r/hello.exe";

// guid from test/r/hello.exe by monodis(1)
var HELLO_EXE_GUID = "258E984D-F652-4AA4-8833-43BDF34A1CDE";

describe("Clion.Image", function() {
    it("exists", function() {
        Clion.Image.should.exist;
    });

    describe("guid", function() {
        it("exists", function() {
            var img = new Clion.Image(exe);
            img.guid.should.exist;
        });

        it("is valid", function() {
            var img = new Clion.Image(exe);
            img.guid.should.equal(HELLO_EXE_GUID);
        });
    });
});

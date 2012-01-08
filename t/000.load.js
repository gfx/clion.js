#!/usr/bin/env node
"use strict";

var Clion = fs("clion").Clion;

describe("Clion.Image", function() {
    describe("new", function() {
        it("should be success", function() {
            var img = new Clion( __dirname + "/r/hello.exe" );
        });
    });
});

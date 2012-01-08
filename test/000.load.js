#!/usr/bin/env node
"use strict";

describe("Clion", function() {
    describe("load", function() {
        it("should be success", function() {
            var Clion = require("clion").Clion;
            should.exist( Clion );
            should.exist( Clion.version );
        });
    });
});

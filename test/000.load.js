#!/usr/bin/env node
"use strict";

describe("require Clion", function() {
    it("should be success", function() {
        var Clion = require("..");
        Clion.version.should.exist;
    });
});

#!/usr/bin/env node
"use strict";
var util  = require('util');
var U64 = require("../lib/uint64");

describe("U64", function() {
    describe("from_be32", function() {
        it('toString', function() {
            var u = U64.from_be32(0xFFFFFFFF, 0x00000000);
            u.toString().should.be.equal('0xFFFFFFFF00000000');
        });
    });
    describe("from_le32", function() {
        it('toString', function() {
            var u = U64.from_le32(0xFFFFFFFF, 0x00000000);
            u.toString().should.be.equal('0x00000000FFFFFFFF');
        });
    });
    describe("at()", function() {
        var u = U64.from_be32(0xFFFFFFFF, 0x00000000);
        var i;
        for(i = 0; i < 32; i++) {
            (function(i) {
                it('low bits #' + i, function() {
                    u.at(i).should.be.false;
                });
            })(i);
        }
        for(i = 32; i < 64; i++) {
            (function(i) {
                it('high bits #' + i, function() {
                    u.at(i).should.be.true;
                });
            })(i);
        }
    });
});

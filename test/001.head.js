#!/usr/bin/env node
"use strict";

var Clion = require("..");
var exe = __dirname + "/r/hello.exe";

// meta data from test/r/hello.exe by monodis(1) and pedump(1)
var HELLO_EXE_GUID = "258E984D-F652-4AA4-8833-43BDF34A1CDE";
var ASSEMBLY_NAME  = "hello";
var MODULE_NAME    = "hello.exe";
var VERSION_STR    = "v2.0.50727";
var VERSION_MAJOR  = 1;
var VERSION_MINOR  = 1;

var TABLES = {
    Module: {
        rows: 1,
        size: 10,
        base: 0x308
    },
    TypeRef: {
        rows: 3,
        size: 6,
        base: 0x312,
    },
    TypeDef: {
        rows: 2,
        size: 14,
        base: 0x324,
    },
    Method: {
        rows: 2,
        size: 14,
        base: 0x340,
    },
    MemberRef: {
        rows: 3,
        size: 6,
        base: 0x35c,
    },
    CustomAttribute: {
        rows: 1,
        size: 6,
        base: 0x36e,
    },
    Assembly: {
        rows: 1,
        size: 22,
        base: 0x374,
    },
    AssemblyRef: {
        rows: 1,
        size: 20,
        base: 0x38a,
    },
};
describe("Clion.Image", function() {
    var img = Clion.Image.create_from_file(exe);

    describe("guid", function() {
        it("exists", function() {
            img.guid.should.exist;
        });

        it("is valid", function() {
            img.guid().should.equal(HELLO_EXE_GUID);
        });
    });
    describe("version", function() {
        it("string exists", function() {
            img.version.should.exist;
        });
        it("major exists", function() {
            img.version_major.should.exist;
        });
        it("minor exists", function() {
            img.version_minor.should.exist;
        });

        it("string is valid", function() {
            img.version.should.equal(VERSION_STR);
        });
        it("major is valid", function() {
            img.version_major.should.equal(VERSION_MAJOR);
        });
        it("minor is valid", function() {
            img.version_minor.should.equal(VERSION_MINOR);
        });
    });
    describe("assembly_name", function() {
        it("exists", function() {
            img.assembly_name.should.exist;
        });

        it("is valid", function() {
            img.assembly_name.should.equal(ASSEMBLY_NAME);
        });
    });
    describe("module_name", function() {
        it("exists", function() {
            img.module_name.should.exist;
        });

        it("is valid", function() {
            img.module_name.should.equal(MODULE_NAME);
        });
    });

    describe("tables", function() {
        it("exists", function() {
            img.tables.should.exist;
        });

        img.tables.forEach(function(got, idx)  {
            var expect = TABLES[got.name];
            if(!expect) {
                expect = { rows: 0 };
            }

            if(got.name) {
                describe(got.name, function() {
                    it("rows", function() {
                        got.rows.should.equal( expect.rows );
                    });
                    it("row_size", function() {
                        got.row_size.should.equal( expect.size );
                    });
                    it("base", function() {
                        got.base.should.equal( expect.base );
                    });
                });
            }
            else {
                describe( 'table#' + idx, function() {
                    it("rows is zero", function() {
                        got.rows.should.equal(0);
                    });
                });
            }
        });
    });
});

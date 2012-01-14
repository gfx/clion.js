#!/usr/bin/env node
"use strict";
var util  = require('util');
var Clion = require("..");
var exe = __dirname + "/r/hello.exe";

// meta data from test/r/hello.exe by monodis(1) and pedump(1)
var HELLO_EXE_GUID = "258E984D-F652-4AA4-8833-43BDF34A1CDE";
var ASSEMBLY_NAME  = "hello";
var MODULE_NAME    = "hello.exe";
var VERSION_STR    = "v2.0.50727";
var VERSION_MAJOR  = 1;
var VERSION_MINOR  = 1;
var ENTRY_POINT    = 0x02058;

var TABLES = {
    Module: {
        rows: 1,
        size: 10,
        base: 0x308,
        entries: [
            {
                'Name': 'hello.exe',
                'Generation': 0,
            },
        ]
    },
    TypeRef: {
        rows: 3,
        size: 6,
        base: 0x312,
        entries: [
            {
                'Name': 'Object',
                'Namespace': 'System',
            },
            {
                'Name': 'Console',
                'Namespace': 'System',
            },
            {
                'Name': 'RuntimeCompatibilityAttribute',
                'Namespace': 'System.Runtime.CompilerServices',
            },
        ]
    },
    TypeDef: {
        rows: 2,
        size: 14,
        base: 0x324,
        entries: [
            {
                'Name': '<Module>',
                'Namespace': '',
            },
            {
                'Name': 'HelloWorld',
                'Namespace': '',
            },
        ]
    },
    Method: {
        rows: 2,
        size: 14,
        base: 0x340,
        entries: [
            {
                'Name': '.ctor',
            },
            {
                'Name': 'Main',
            },
        ]
    },
    MemberRef: {
        rows: 3,
        size: 6,
        base: 0x35c,
        entries: [
            {
                'Name': '.ctor',
            },
            {
                'Name': 'WriteLine',
            },
            {
                'Name': '.ctor',
            },
        ]
    },
    CustomAttribute: {
        rows: 1,
        size: 6,
        base: 0x36e,
        entries: [ {} ],
    },
    Assembly: {
        rows: 1,
        size: 22,
        base: 0x374,
        entries: [
            {
                'Name': 'hello',
                'Major': 0,
                'Minor': 0,
                'BuildNumber': 0,
                'RevisionNumber': 0,
                'HashId': 0x08004,
                'Flags': 0x00,
                'Culture': '',
            },
        ]
    },
    AssemblyRef: {
        rows: 1,
        size: 20,
        base: 0x38a,
        entries: [
            {
                'Name': 'mscorlib',
                'Major': 2,
                'Minor': 0,
                'BuildNumber': 0,
                'RevisionNumber': 0,
                'Flags': 0x00,
                'Culture': '',
            },
        ]
    },
};
describe("Clion.Image", function() {
    var img = Clion.Image.create_from_file(exe);
    //console.log(util.inspect(img, false, 10));

    describe('image_info', function() {
        it("header.coff", function() {
            var coff = img.image_info.header.coff;
            coff.machine.should.equal(0x014c);
            coff.sections.should.equal(3);
            coff.time.should.equal(0x4f0a6102);
            coff.symptr.should.equal(0x0);
            coff.symcount.should.equal(0x0);
            coff.opt_header_size.should.equal(0x00e0);
            coff.oattributes.should.equal(0x0102);
        });
        it("header.pe", function() {
            var pe = img.image_info.header.pe;
            pe.magic.should.equal(0x010b);
            pe.major.should.equal(0x08);
            pe.minor.should.equal(0x00);
            pe.code_size.should.equal(0x0400);
            pe.data_size.should.equal(0x0600);
            pe.uninit_data_size.should.equal(0x0);
            pe.rva_entry_point.should.equal(0x022ee);
            pe.rva_code_base.should.equal(0x02000);
            pe.rva_data_base.should.equal(0x04000);
        });
        it("header.nt", function() {
            var nt = img.image_info.header.nt;
            nt.image_base.should.equal(    0x400000);
            nt.section_align.should.equal( 0x002000);
            nt.file_alignment.should.equal(0x000200);
            nt.os_major.should.equal(0x04);
            nt.os_minor.should.equal(0x00);
            nt.user_major.should.equal(0x00);
            nt.user_minor.should.equal(0x00);
            nt.subsys_major.should.equal(0x04);
            nt.subsys_minor.should.equal(0x00);
            nt.image_size.should.equal(0x08000);
            nt.header_size.should.equal(0x0200);
            nt.checksum.should.equal(0x0);
            nt.subsys_required.should.equal(0x03);
            nt.stack_reserve.should.equal(0x00100000);
            nt.stack_commit.should.equal( 0x00001000);
            nt.heap_reserve.should.equal( 0x00100000);
            nt.heap_commit.should.equal(  0x00001000);
            nt.loader_flags.should.equal(0x0);
            nt.data_dir_count.should.equal(0x10);
        });
        it("cli_header", function() {
            var h = img.image_info.cli_header;
            h.size.should.equal(72);
            h.runtime_major.should.equal(2);
            h.runtime_minor.should.equal(5);
            h.entry_point.should.equal(0x06000002);
        });
    });

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
                describe('entries of ' + got.name, function() {
                    var i, entries, x, g, key;
                    entries = img.get_table_entries(got);
                    for(i = 0; i < expect.entries.length; i++) {
                        g = entries[i];
                        x = expect.entries[i];
                        for(key in  x) {
                            it('.' + key, function() {
                                g[key].should.equal( x[key] );
                            });
                        }
                    }
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

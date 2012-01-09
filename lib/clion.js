// Clion.JS - ECMA-335 implementation in JavaScript
// http://github.com/gfx/clion.js

/** @define {boolean} */
var CLION_DEBUG = true;

(function(exporter) {
    "use strict";
    /** @const */
    var VERSION = "0.0.1";

    var __c = -1; // enum counter
    // data types in the metadata tables
    /** @enum {int} */
    var MT_END = ++__c,

        // sized elements
        MT_UINT32 = ++__c,
        MT_UINT16 = ++__c,
        MT_UINT8 = ++__c,

        // index into heaps, tables, properties
        MT_BLOB_IDX = ++__c,
        MT_STRING_IDX = ++__c,
        MT_GUID_IDX = ++__c,
        MT_TABLE_IDX = ++__c,
        MT_CONST_IDX = ++__c,   // HashConstant:Parent
        MT_HASCAT_IDX = ++__c,  // HasCustomAttribute
        MT_CAT_IDX = ++__c,     // CustomAttributeType
        MT_HASDEC_IDX = ++__c,  // HasDeclSecurity
        MT_IMPL_IDX = ++__c,    // Implementation
        MT_HFM_IDX = ++__c,     // HasFieldMarshal
        MT_MF_IDX = ++__c,      // MemberFormat
        MT_TDOR_IDX = ++__c,    // TypeDefOrRef
        MT_MRP_IDX = ++__c,     // MemberRefParent
        MT_MDOR_IDX = ++__c,    // MethodDefOrRef
        MT_HS_IDX = ++__c,      // HasSemantic
        MT_RS_IDX = ++__c       // ResolutionScope
    ;

    /** @const */
    var TableSchema = [
        {
            name: "Module",
            fields: [
                ["Generation", MT_UINT16],
                ["Name", MT_STRING_IDX],
                ["MVID", MT_GUID_IDX],
                ["EncID", MT_GUID_IDX],
                ["EncBaseID", MT_GUID_IDX],
            ],
        },
        {
            name: "TypeRef",
            fields: [
                ["Name", MT_STRING_IDX],
                ["Namespace", MT_STRING_IDX],
            ],
        },
        {
            name: "TypeDef",
            fields: [
                ["Flags", MT_UINT32],
                ["Name", MT_STRING_IDX],
                ["Namespace", MT_STRING_IDX],
                ["Extends", MT_TDOR_IDX],
            ],
        },
        {
            name: "FieldPtr",
            fields: [
                ["Field", MT_TABLE_IDX],
            ],
        },
        {
            name: "Field",
            fields: [
                ["Flags", MT_UINT16],
                ["Name", MT_STRING_IDX],
                ["Signature", MT_BLOB_IDX],
            ],
        },
        {
            name: "MethodPtr",
            fields: [
                ["Method", MT_TABLE_IDX],
            ],
        },
        {
            name: "Method",
            fields: [
                ["RVA", MT_UINT32],
                ["Name", MT_STRING_IDX],
                ["Signature", MT_BLOB_IDX],
            ],
        },
        {
            name: "ParamPtr",
            fields: [
                ["Param", MT_TABLE_IDX],
            ],
        },
        {
            name: "Param",
            fields: [
                ["Flags", MT_UINT16],
                ["Sequence", MT_UINT16],
                ["Name", MT_STRING_IDX],
            ],
        },
        {
            name: "InterfaceImpl",
            fields: [
            ],
        },
        {
            name: "MemberRef",
            fields: [
                ["Class", MT_MRP_IDX],
                ["Name", MT_STRING_IDX],
                ["Signature", MT_BLOB_IDX],
            ],
        },
        {
            name: "Constant",
            fields: [
                ["Type", MT_UINT8],
                ["PaddingZero", MT_UINT8],
                ["Parent", MT_CONST_IDX],
                ["Value", MT_BLOB_IDX],
            ],
        },
        {
            name: "CustomAttribute",
            fields: [
                ["Parent", MT_HASCAT_IDX],
                ["Type", MT_CAT_IDX],
                ["Value", MT_BLOB_IDX],
            ],
        },
        {
            name: "FieldMarshal",
            fields: [
                ["Parent", MT_HFM_IDX],
                ["NativeType", MT_BLOB_IDX],
            ],
        },
        {
            name: "DeclSecurity",
            fields: [
                ["Action", MT_UINT16],
                ["Parent", MT_HASDEC_IDX],
                ["PermissionSet", MT_BLOB_IDX],
            ],
        },
        {
            name: "ClassLayout",
            fields: [
                ["PackingSize", MT_UINT16],
                ["ClassSize", MT_UINT32],
            ],
        },
        {
            name: "FieldLayoutt",
            fields: [
                ["Offset", MT_UINT32],
            ],
        },
        {
            name: "StandaloneSig",
            fields: [
                ["Signature", MT_BLOB_IDX],
            ],
        },
        {
            name: "EventMap",
            fields: [
            ],
        },
        {
            name: "EventPtr",
            fields: [
                ["Event", MT_TABLE_IDX],
            ],
        },
        {
            name: "Event",
            fields: [
                ["Name", MT_STRING_IDX],
                ["EventType", MT_TDOR_IDX],
            ],
        },
        {
            name: "PropertyMap",
            fields: [
            ],
        },
        {
            name: "PropertyPtr",
            fields: [
                ["Property", MT_TABLE_IDX],
            ],
        },
        {
            name: "Property",
            fields: [
                ["Flags", MT_UINT16],
                ["Name", MT_STRING_IDX],
                ["Type", MT_BLOB_IDX],
            ],
        },
        {
            name: "MethodSemantics",
            fields: [
                ["MethodSemantic", MT_UINT16],
                ["Association", MT_HS_IDX],
            ],
        },
        {
            name: "MethodImpl",
            fields: [
                ["MethodBody", MT_MDOR_IDX],
                ["MethodDeclaration", MT_MDOR_IDX],
            ],
        },
        {
            name: "Moduleref",
            fields: [
                ["Name", MT_STRING_IDX],
            ],
        },
        {
            name: "TypeSpec",
            fields: [
                ["Signature", MT_BLOB_IDX],
            ],
        },
        {
            name: "ImplMap",
            fields: [
                ["MappingFlag", MT_UINT16],
                ["MemberForwarded", MT_MF_IDX],
                ["ImportName", MT_STRING_IDX],
            ],
        },
        {
            name: "FieldRVA",
            fields: [
                ["RVA", MT_UINT32],
            ],
        },
        {
            name: "",
            fields: [
            ],
        },
        {
            name: "",
            fields: [
            ],
        },
        {
            name: "Assembly",
            fields: [
                ["HashId", MT_UINT32],
                ["Major", MT_UINT16],
                ["Minor", MT_UINT16],
                ["BuildNumber", MT_UINT16],
                ["RevisionNumber", MT_UINT16],
                ["Flags", MT_UINT32],
                ["PublicKey", MT_BLOB_IDX],
                ["Name", MT_STRING_IDX],
                ["Culture", MT_STRING_IDX],
            ],
        },
        {
            name: "AssemblyProcessor",
            fields: [
                ["Processor", MT_UINT32],
            ],
        },
        {
            name: "AssemblyOS",
            fields: [
                ["OSPlatformID", MT_UINT32],
                ["OSMajor", MT_UINT32],
                ["OSMinor", MT_UINT32],
            ],
        },
        {
            name: "AssemblyRef",
            fields: [
                ["Major", MT_UINT16],
                ["Minor", MT_UINT16],
                ["Build", MT_UINT16],
                ["Revision", MT_UINT16],
                ["Flags", MT_UINT32],
                ["PublicKeyOrToken", MT_BLOB_IDX],
                ["Name", MT_STRING_IDX],
                ["Culture", MT_STRING_IDX],
                ["HashValue", MT_BLOB_IDX],
            ],
        },
        {
            name: "AssemblyRefProcessor",
            fields: [
                ["Processor", MT_UINT32],
            ],
        },
        {
            name: "AssemblyRefOS",
            fields: [
                ["OSPlatformID", MT_UINT32],
                ["OSMajorVersion", MT_UINT32],
                ["OSMinorVersion", MT_UINT32],
            ],
        },
        {
            name: "File",
            fields: [
                ["Flags", MT_UINT32],
                ["Name", MT_STRING_IDX],
                ["Value", MT_BLOB_IDX],
            ],
        },
        {
            name: "ExportedType",
            fields: [
                ["Flags", MT_UINT32],
                ["TypeDefId", MT_TABLE_IDX],
                ["TypeName", MT_STRING_IDX],
                ["TypeNameSpace", MT_STRING_IDX],
                ["Implementation", MT_IMPL_IDX],
            ],
        },
        {
            name: "ManifestResource",
            fields: [
                ["Offset", MT_UINT32],
                ["Flags", MT_UINT32],
                ["Name", MT_STRING_IDX],
                ["Implementation", MT_IMPL_IDX],
            ],
        },
        {
            name: "NestedClass",
            fields: [
            ],
        },
        {
            name: "GenericParam",
            fields: [
                ["Number", MT_UINT16],
                ["Flags", MT_UINT16],
                ["Owner", MT_TABLE_IDX],
                ["Name", MT_STRING_IDX],
            ],
        },
        {
            name: "MethodSpec",
            fields: [
                ["Method", MT_MDOR_IDX],
                ["Signature", MT_BLOB_IDX],
            ],
        },
        {
            name: "GenericParamConstraint",
            fields: [
                ["GenericParam", MT_TABLE_IDX],
                ["Constraint", MT_TDOR_IDX],
            ],
        },
    ]; // end of TableSchema

    var rtsize = function(s, b) {
        return s < (1 << b) ? 2 : 4;
    };

    var InvalidImage = function(offset) {
        var msg        = offset ? "(offset=" + offset + ")" : "";
        this.__proto__ = new Error("Invalid CLI executable " + msg);
    };

    // logger
    var noop = function() { };
    var i = CLION_DEBUG ? console.log : noop;
    var d = CLION_DEBUG ? console.log : noop;
    var w = console.log;

    // see:
    // mono_image_load_pe_data()@mono/metadata/image.c
    // MonoMSDOSHeader@mono/metadata/cil-conff.h
    //
    // mono_image_open()
    //  do_mono_image_open()
    //      new image
    //      new imageinfo
    //      do_mono_image_load()
    //          mono_image_load_pe_data()
    //          mono_image_load_cli_data()
    //              load_cli_header()
    //              load_metadata()
    //          mono_image_load_names()
    //          load_modules()
    var I = function Clion_Image(name) {
       this.image_name = name;
       this.image_info = {};
       this.typespec   = {};
       this.memberref  = {};
       this.helper     = {};
       this.method     = {};
       this.property   = {};

       if(name) {
           this.load_file(name);
       }
    };

    I.prototype.load_file = function(file) {
        var bin  = require('fs').readFileSync(file);
        this.load_pe_data(bin);
    };
    // load & verify the executable binary
    I.prototype.load_pe_data = function(bin) {
        var msdos, h, offset;

        this.raw_data = bin;

        msdos  = this.load_msdos_header();
        h      = {}; // .NET header
        offset = msdos.pe_offset;

        this.image_info.header = h;

        offset = this.load_header(h, offset);
        if(offset < 0) {
            throw new InvalidImage(offset);
        };

        offset = this.load_section_tables(offset);

        this.load_cli_data();

        this.load_names();
        this.load_modules();
    };
    I.prototype.load_msdos_header = function() {
        var bin   = this.raw_data;
        var msdos = {},
            offset = 0;
        if(bin.slice(0, 2).toString() !== "MZ") {
            throw new InvalidImage(offset);
        }
        // aliases
        bin.readUInt16 = bin.readUInt16LE;
        bin.readInt16  = bin.readInt16LE;
        bin.readUInt32 = bin.readUInt32LE;
        bin.readInt32  = bin.readInt32LE;

        msdos.msdos_sig     = bin.slice(offset, offset+2);
        offset += 2;
        msdos.nlast_page    = bin.readUInt16(offset);
        offset += 2;
        msdos.npages        = bin.readUInt16(offset);
        offset += 2;
        msdos.msdos_header  = bin.slice(offset, offset+54);
        offset += 54;
        msdos.pe_offset     = bin.readUInt32(offset);
        offset += 4;
        msdos.msdos_header2 = bin.slice(offset, offset+64);
        return msdos;
    };
    I.prototype.load_header = function(h, offset) {
        var bin = this.raw_data;
        var coff, pe, nt, datadir;

        h.pesig              = bin.slice(offset, offset+4);
        offset += 4;

        h.coff = coff = {}; // CoffHeader
        coff.machine         = bin.readUInt16(offset);
        offset += 2;
        coff.sections        = bin.readUInt16(offset)
        offset += 2;
        coff.time            = bin.readUInt32(offset)
        offset += 4;
        coff.symptr          = bin.readUInt32(offset)
        offset += 4;
        coff.symcount        = bin.readUInt32(offset)
        offset += 4;
        coff.opt_header_size = bin.readUInt16(offset)
        offset += 2;
        coff.oattributes     = bin.readUInt16(offset)
        offset += 2;

        h.pe = pe = {}; // PEHeader
        pe.magic             = bin.readUInt16(offset);
        offset += 2;
        pe.major             = bin.readUInt8(offset);
        offset += 1;
        pe.minor             = bin.readUInt8(offset);
        offset += 1;
        pe.code_size         = bin.readUInt32(offset);
        offset += 4;
        pe.data_size         = bin.readUInt32(offset);
        offset += 4;
        pe.uninit_data_size  = bin.readUInt32(offset);
        offset += 4;
        pe.rva_entry_point   = bin.readUInt32(offset);
        offset += 4;
        pe.rva_code_base     = bin.readUInt32(offset);
        offset += 4;
        pe.rva_data_base     = bin.readUInt32(offset);
        offset += 4;

        h.nt = nt = {}; // PEHeaderNT
        nt.image_base        = bin.readUInt32(offset);
        offset += 4;
        nt.section_align     = bin.readUInt32(offset);
        offset += 4;
        nt.file_alignment    = bin.readUInt32(offset);
        offset += 4;
        nt.os_major          = bin.readUInt16(offset);
        offset += 2;
        nt.os_minor          = bin.readUInt16(offset);
        offset += 2;
        nt.user_major        = bin.readUInt16(offset);
        offset += 2;
        nt.user_minor        = bin.readUInt16(offset);
        offset += 2;
        nt.subsys_major      = bin.readUInt16(offset);
        offset += 2;
        nt.subsys_minor      = bin.readUInt16(offset);
        offset += 2;
        nt.reserved_1        = bin.readUInt32(offset);
        offset += 4;
        nt.image_size        = bin.readUInt32(offset);
        offset += 4;
        nt.header_size       = bin.readUInt32(offset);
        offset += 4;
        nt.checksum          = bin.readUInt32(offset);
        offset += 4;
        nt.subsys_required   = bin.readUInt16(offset);
        offset += 2;
        nt.dll_flags         = bin.readUInt16(offset);
        offset += 2;
        nt.stack_reserve     = bin.readUInt32(offset);
        offset += 4;
        nt.stack_commit      = bin.readUInt32(offset);
        offset += 4;
        nt.heap_reserve     = bin.readUInt32(offset);
        offset += 4;
        nt.heap_commit      = bin.readUInt32(offset);
        offset += 4;
        nt.loader_flags     = bin.readUInt32(offset);
        offset += 4;
        nt.data_dir_count   = bin.readUInt32(offset);
        offset += 4;

        h.datadir = datadir = {};
        var readDirEntry = function() {
            var de = {};
            de.rva  = bin.readUInt32(offset);
            offset += 4;
            de.size = bin.readUInt32(offset);
            offset += 4;
            return de;
        };
        datadir.export_table      = readDirEntry();
        datadir.import_table      = readDirEntry();
        datadir.resource_table    = readDirEntry();
        datadir.exception_table   = readDirEntry();
        datadir.certificate_table = readDirEntry();
        datadir.reloc_table       = readDirEntry();
        datadir.debug             = readDirEntry();
        datadir.copyright         = readDirEntry();
        datadir.global_ptr        = readDirEntry();
        datadir.tls_table         = readDirEntry();
        datadir.load_config_table = readDirEntry();
        datadir.bound_import      = readDirEntry();
        datadir.iat               = readDirEntry();
        datadir.delay_import_desc = readDirEntry();
        datadir.cli_header        = readDirEntry();
        datadir.reserved          = readDirEntry();

        // verify
        if( pe.magic === 0x10B ) {
            d("PE32");
            // TODO
        }
        else if( pe.magic === 0x20B ) { // PE32+ format
            d("PE32+");
            // TODO
        }
        else {
            throw new InvalidImage(offset);
        }

        if( nt.image_base !== 0x400000 ) {
            throw new InvalidImage(offset);
        }
        if( nt.section_align !== 0x2000 ) {
            throw new InvalidImage(offset);
        }
        if(!(nt.file_alignment === 0x200 || nt.file_alignment == 0x1000)) {
            throw new InvalidImage(offset);
        }
        if( nt.os_major !== 4 ) {
            throw new InvalidImage(offset);
        }
        if( nt.os_minor !== 0 ) {
            throw new InvalidImage(offset);
        }

        return offset;
    };
    I.prototype.load_section_tables = function(offset) {
        var bin   = this.raw_data;
        var iinfo = this.image_info;
        var top   = iinfo.header.coff.sections,
            i, t, namelen;

        iinfo.section_count  = top;
        iinfo.section_tables = [];
        iinfo.sections       = {};

        for(i = 0; i < top; i++) {
            t = iinfo.section_tables[i] = {};

            // chop NUL
            namelen = 8;
            while( bin[ offset + namelen - 1 ] == 0 ) {
                namelen--;
            }
            t.name = bin.slice(offset, offset+namelen).toString();
            offset += 8;
            t.virtual_size    = bin.readUInt32(offset);
            offset += 4;
            t.virtual_address = bin.readUInt32(offset);
            offset += 4;
            t.raw_data_size   = bin.readUInt32(offset);
            offset += 4;
            t.raw_data_ptr    = bin.readUInt32(offset);
            offset += 4;
            t.reloc_ptr       = bin.readUInt32(offset);
            offset += 4;
            t.lineno_ptr      = bin.readUInt32(offset);
            offset += 4;
            t.reloc_count     = bin.readUInt32(offset);
            offset += 4;
            t.line_count      = bin.readUInt32(offset);
            offset += 4;
        }
    };
    I.prototype.load_cli_data = function() {
        this.load_cli_header();
        this.load_metadata();
    };
    I.prototype.load_cli_header = function() {
        var bin   = this.raw_data;
        var iinfo = this.image_info;
        var h     = iinfo.header,
            offset, cli_header;

        offset = this.cli_rva_image_map(h.datadir.cli_header.rva);
        if(offset == 0) {
            throw new InvalidImage();
        }
        var readDirEntry = function() {
            var de = {};
            de.rva  = bin.readUInt32(offset);
            offset += 4;
            de.size = bin.readUInt32(offset);
            offset += 4;
            return de;
        };

        cli_header = iinfo.cli_header = {}; // CLIHeader
        cli_header.size          = bin.readUInt32(offset);
        offset += 4;
        cli_header.runtime_major = bin.readUInt16(offset);
        offset += 2;
        cli_header.runtime_minor = bin.readUInt16(offset);
        offset += 2;
        cli_header.metadata      = readDirEntry();
        cli_header.flags         = bin.readUInt32(offset);
        offset += 4;

        cli_header.entry_point                = bin.readUInt32(offset);
        offset += 4;
        cli_header.resources                  = readDirEntry();
        cli_header.strong_name                = readDirEntry();
        cli_header.code_manager_table         = readDirEntry();
        cli_header.vtable_fixups              = readDirEntry();
        cli_header.export_address_table_jumps = readDirEntry();

        cli_header.eeinfo_table    = readDirEntry();
        cli_header.helper_table    = readDirEntry();
        cli_header.dynamic_info    = readDirEntry();
        cli_header.delay_load_info = readDirEntry();
        cli_header.module_image    = readDirEntry();
        cli_header.external_fixups = readDirEntry();
        cli_header.ridmap          = readDirEntry();
        cli_header.debug_map       = readDirEntry();
        cli_header.ip_map          = readDirEntry();
    };
    I.prototype.load_metadata = function() {
        var bin   = this.raw_data;
        var iinfo = this.image_info;
        var cli_header = iinfo.cli_header,
            offset, size, metadata_offset, str_len,
            streams, i, pad, type, o;

        // metadata ptr
        offset = this.cli_rva_image_map(cli_header.metadata.rva);
        if(offset == 0) {
            throw new InvalidImage();
        }
        size = cli_header.metadata.size;
        if(offset + size > bin.length) {
            throw new InvalidImage(offset);
        }
        this.raw_metadata = { data: offset, size: offset + size };
        metadata_offset = offset;

        if( bin.slice(offset, offset+4).toString() !== "BSJB" ) {
            throw new InvalidImage(offset);
        }
        offset += 4;

        this.version_major = bin.readUInt16(offset);
        offset += 2;
        this.version_minor = bin.readUInt16(offset);
        offset += 6;

        str_len = bin.readUInt32(offset);
        offset += 4;
        this.version = bin.slice(offset, offset + str_len).toString();
        offset += str_len;
        pad = offset - metadata_offset;
        if( pad  % 4 ) {
            offset += 4 - (pad  % 4);
        }
        offset += 2; // skip over flags

        streams = bin.readUInt16(offset);
        offset += 2;

        for(i = 0; i < streams; i++) {
            o = {};
            o.data = metadata_offset + bin.readUInt32(offset);
            offset += 4;
            o.size = bin.readUInt32(offset); // size of heap
            offset += 4;

            str_len = 0; // length of nul terminated str
            while( bin[ offset + str_len ] !== 0 ) {
                if(++str_len > 8) { // max len
                    throw new InvalidImage();
                }
            }
            type = bin.slice(offset, offset +  str_len).toString();
            offset += str_len + 1 /* trailing NUL */;

            switch(type) {
            case "#~":
                this.heap_tables = o;
                break;
            case "#Strings":
                this.heap_strings = o;
                break;
            case "#US":
                this.heap_us = o;
                break;
            case "#Blob":
                this.heap_blob = o;
                break;
            case "#GUID":
                this.heap_guid = o;
                break;
            case "#-":
                this.heap_tables = o;
                this.uncompressed_metadata = true;
                d("Assembly has the non standard metadata heap #-.");
                break;
            default:
                throw new Error("Unknown heap type: "
                                + JSON.stringify(type));
                break;
            }

            pad = offset - this.raw_metadata.data;
            if(pad % 4) {
                offset += 4 - (pad % 4);
            }
        }
        this.guid = (function(bin, heap) {
            var guid = [],
                i, x;
            for(i = 0; i < heap.size; i++) {
                x = bin[ heap.data + i ].toString(16).toUpperCase();
                guid.push( x.length === 1 ? '0' + x : x);
            }
            return guid[3] + guid[2] + guid[1] + guid[0] +
                    '-' + guid[5] + guid[4] +
                    '-' + guid[7] + guid[6] +
                    '-' + guid[8] + guid[9] +
                    '-' + guid[10] + guid[11] + guid[12] +
                          guid[13] + guid[14] + guid[15];
        })(bin, this.heap_guid);

        this.load_tables();
    };
    I.prototype.load_tables = function() { // from the "#~" stream
        var bin         = this.raw_data;
        var heap_tables = this.heap_tables.data;
        var offset, heap_sizes,
            valid_mask_hi,  valid_mask_lo,  // 64 bits
            sorted_mask_hi, sorted_mask_lo, // 64 bits
            rows, table, o, use_lo, flag,
            valid = 0;

        heap_sizes = bin[heap_tables + 6];
        this.idx_string_wide = !!( heap_sizes & 0x01 );
        this.idx_guid_wide   = !!( heap_sizes & 0x02 );
        this.idx_blob_wide   = !!( heap_sizes & 0x04 );

        offset = heap_tables + 8;
        valid_mask_hi  = bin.readUInt32(offset);
        offset += 4;
        valid_mask_lo  = bin.readUInt32(offset);
        offset += 4;
        sorted_mask_hi = bin.readUInt32(offset);
        offset += 4;
        sorted_mask_lo = bin.readUInt32(offset);
        offset += 4;

        rows = offset;
        var TABLE_LAST = 0x2c;
        this.tables = new Array(TABLE_LAST + 1);

        for(table = 0; table < 64; table++) {
            o = {};
            if(TableSchema[table]) {
                o.name = TableSchema[table].name;
            }

            // flags64 : [ hi 32bits ][ lo 32bits ]
            use_lo = ( table <= 32 );
            if(use_lo) {
                flag = ( (valid_mask_lo & (1 << table)) === 0 );
            }
            else {
                flag = ( (valid_mask_hi & (1 << (table >> 1))) == 0 );
            }
            if(flag) {
                if( table > TABLE_LAST ) {
                    continue;
                }
                o.rows = 0;
                this.tables[table] = o;
                continue;
            }
            if( table > TABLE_LAST ) {
                w("bits in valid must be zero above 0x2d");
            }
            else {
                o.rows = bin.readUInt32(rows);
                rows += 4;
            }
            this.tables[table] = o;

            valid++;
        }
        this.tables_base = (heap_tables + 24) + (4 * valid);
        if(this.tables_base !== rows) {
            throw new InvalidImage(rows);
        }
        this.metadata_compute_table_bases();
    };
    I.prototype.cli_rva_image_map = function(addr) {
        var iinfo  = this.image_info;
        var top    = iinfo.section_count,
            tables = iinfo.section_tables,
            i, t, beg, end;
        for(i = 0; i < top; i++) {
            t = tables[i];
            beg = t.virtual_address;
            end = t.virtual_address + t.raw_data_size;
            if( addr >= beg && addr < end ) {
                return addr - beg + t.raw_data_ptr;
            }
        }
        return 0;
    };
    I.prototype.load_names = function() {
        // TODO
    };
    I.prototype.load_modules = function() {
        // TODO
    };
    // see mono_metadata_compute_table_bases()@mono/metadata/metadata.c
    I.prototype.metadata_compute_table_bases = function() {
        var i, table, base;
        base = this.tables_base;
        for(i = 0; i < this.tables.length; i++) {
            table = this.tables[i];
            if(table.rows === 0) {
                continue;
            }

            table.row_size = this.metadata_compute_size(i, table);
            table.base     = base;

            base += table.rows * table.row_size;
        }
    };
    I.prototype.metadata_compute_size = function(table_index, table) {
        var bin  = this.raw_data;
        var d    = TableSchema[table_index],
            i, code, field_size, n;
        //
        p(d);
        for(i = 0; i < d.fields.length; i++) {
            code = d.fields[i];
            switch(code) {
            case MT_UINT32: field_size = 4; break;
            case MT_UINT16: field_size = 2; break;
            case MT_UINT8:  field_size = 1; break;

            case MT_BLOB_IDX:
                field_size = htis.idx_blob_wide ? 4 : 2;
                break;
            case MT_STRING_IDX:
                field_size = htis.idx_string_wide ? 4 : 2;
                break;
            case MT_GUID_IDX:
                field_size = htis.idx_guid_wide ? 4 : 2;
                break;

            case MT_TABLE_IDX:
                switch(table_index) {
                    default:
                        throw "TODO!";
                }
                break;

            case MT_CONST_IDX:
                n = Math.max( this.tables.get_table('Param').rows,
                              this.tables.get_table('Field').rows,
                              this.tables.get_table('Property').rows );
                field_size = rtsize(n, 16-2);
                break;
            default:
                throw "Not yet implemented: " + code;
            }
        }

        return 1;
    };
    I.prototype.get_table = function(name) {
        for(var i in this.tables) {
            var t = this.tables[i];
            if(t.name === name) {
                return t;
            }
        }
        throw Error("Invalid table name: " + name);
    };
    I.prototype.dis_type = function() {
        var bin = this.raw_data,
            t   = this.get_table('TypeDef'),
            x;
        //p([t]);
        //throw new Error("TODO!");
    };


    var M = function Clion_Module(name) {
        this.module_name = name;
        this.iseq        = [ ];
    };
    M.prototype.initialize = function(vm, args) {
        var i;

        for(i = 0; i < args.length; i++) {
            // convert args to CLI string
            ;
        }

        vm.pc = 0;
        vm.stack  = [ ];
        vm.frames = [ ];
    };
    M.prototype.execute = function(vm) {
        while(1) switch( this.iseq[ this.pc ] ) {
            case ldstr:
                vm.stack.push();
            default:
                throw Error("Unknown instruction: " + this.iseq[ this.pc ]);
        }
    };
    M.prototype.finalize = function(vm) {
    };

    var Clion = exporter.Clion = function Clion() {
    };

    Clion.load = function(thing) {
        var vm = new this();
        vm.load(thing);
        return vm;
    };

    Clion.prototype.load = function(binary) {
        this.main = new M('main');
    };

    Clion.prototype.run = function() {
        // using arguments
        var module = this.main;
        module.initialize(vm, arguments);
        module.execute(vm);
        module.finalize(vm);
    };
    Clion.version = VERSION;
    Clion.Image = I;
})(
    // exporter
      typeof(window)  !== 'undefined' ? window
    : typeof(exports) !== 'undefined' ? exports
    : this
);

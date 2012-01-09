// module clion
"use strict";

/** @const {boolean} */
var CLION_DEBUG = true;

/** @const {string} */
var VERSION = "0.0.1";

var meta = require('./clion/meta');

var TableSchema = meta.TableSchema,
    MetaType    = meta.MetaType,
    C           = meta.C;

function noop() { }

// logger
var D = CLION_DEBUG ? console.log : noop;
var W = console.log;
var XXX = function(s) {
    console.log(s);
    process.exit(1);
};

function InvalidImage(offset) {
    var msg        = offset ? "(offset=" + offset + ")" : "";
    this.__proto__ = new Error("Invalid CLI executable " + msg);
}

function assert(expr) {
    if(!expr) {
        throw new Error('Assertion failed: ' + expr);
    }
}


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
//                  load_tables()
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


I.prototype.rtsize = function(s, b) {
    return s < (1 << b) ? 2 : 4;
};
I.prototype.idx_size = function idx_size(table_idx) {
    return this.tables[table_idx].rows < 65536 ? 2 : 4;
};

I.prototype.load_file = function(file) {
    var bin = require('fs').readFileSync(file);
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
        // TODO
    }
    else if( pe.magic === 0x20B ) { // PE32+ format
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

        t.name = this.read_cstring(offset, 8);
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
    //this.version = bin.slice(offset, offset + str_len).toString();
    this.version = this.read_cstring(offset, str_len);
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

        type = this.read_cstring(offset);
        offset += type.length + 1 /* trailing NUL */;

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
            D("Assembly has the non standard metadata heap #-.");
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
    this.tables = new Array(C.TABLE_LAST + 1);

    for(table = 0; table < 64; table++) {
        o = null;
        if(TableSchema[table]) {
            o = JSON.parse( JSON.stringify(TableSchema[table]) );
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
            if( table > C.TABLE_LAST ) {
                continue;
            }
            o.rows = 0;
            this.tables[table] = o;
            continue;
        }
        if( table > C.TABLE_LAST ) {
            W("bits in valid must be zero above 0x2d");
        }
        else {
            o.rows = bin.readUInt32(rows);
            rows += 4;
        }
        this.tables[table] = o;

        valid++;
    }
    this.tables_base = (heap_tables + 24) + (4 * valid);
    assert(this.tables_base === rows);
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
    if(this.tables[C.TABLE_ASSEMBLY].rows) {
        this.assembly_name = this.metadata_string_heap(
            this.metadata_decode_row_col(
                this.tables[C.TABLE_ASSEMBLY], 0, C.ASSEMBLY_NAME ) );
    }
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
    var bin   = this.raw_data;
    var table = this.tables[table_index],
        i, code, field_size, n,
        bitfield   = 0,
        size       = 0,
        shift      = 0;
    //
    table.field_size = [ ];
    for(i = 0; i < table.fields.length; i++) {
        switch(table.field_type[i]) {
        case MetaType.UINT32: field_size = 4; break;
        case MetaType.UINT16: field_size = 2; break;
        case MetaType.UINT8:  field_size = 1; break;

        case MetaType.BLOB_IDX:
            field_size = this.idx_blob_wide ? 4 : 2;
            break;
        case MetaType.STRING_IDX:
            field_size = this.idx_string_wide ? 4 : 2;
            break;
        case MetaType.GUID_IDX:
            field_size = this.idx_guid_wide ? 4 : 2;
            break;

        case MetaType.TABLE_IDX:
            switch (table_index) {
            case C.TABLE_ASSEMBLYREFOS:
                assert (i === 3);
                field_size = this.idx_size(C.TABLE_ASSEMBLYREF); break;
            case C.TABLE_ASSEMBLYREFPROCESSOR:
                assert (i === 1);
                field_size = this.idx_size(C.TABLE_ASSEMBLYREF); break;
            case C.TABLE_CLASSLAYOUT:
                assert (i === 2);
                field_size = this.idx_size(C.TABLE_TYPEDEF); break;
            case C.TABLE_EVENTMAP:
                assert (i === 0 || i === 1);
                field_size = i ? this.idx_size(C.TABLE_EVENT)
                               : this.idx_size(C.TABLE_TYPEDEF);
                break;
            case C.TABLE_EVENT_POINTER:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_EVENT); break;
            case C.TABLE_EXPORTEDTYPE:
                assert (i === 1);
                field_size = 4; break;
            case C.TABLE_FIELDLAYOUT:
                assert (i === 1);
                field_size = this.idx_size(C.TABLE_FIELD); break;
            case C.TABLE_FIELDRVA:
                assert (i === 1);
                field_size = this.idx_size(C.TABLE_FIELD); break;
            case C.TABLE_FIELD_POINTER:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_FIELD); break;
            case C.TABLE_IMPLMAP:
                assert (i === 3);
                field_size = this.idx_size(C.TABLE_MODULEREF); break;
            case C.TABLE_INTERFACEIMPL:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_TYPEDEF); break;
            case C.TABLE_METHOD:
                assert (i === 5);
                field_size = this.idx_size(C.TABLE_PARAM); break;
            case C.TABLE_METHODIMPL:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_TYPEDEF); break;
            case C.TABLE_METHODSEMANTICS:
                assert (i === 1);
                field_size = this.idx_size(C.TABLE_METHOD); break;
            case C.TABLE_METHOD_POINTER:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_METHOD); break;
            case C.TABLE_NESTEDCLASS:
                assert (i === 0 || i === 1);
                field_size = this.idx_size(C.TABLE_TYPEDEF); break;
            case C.TABLE_PARAM_POINTER:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_PARAM); break;
            case C.TABLE_PROPERTYMAP:
                assert (i === 0 || i === 1);
                field_size = i ? this.idx_size(C.TABLE_PROPERTY)
                               : this.idx_size(C.TABLE_TYPEDEF);
                break;
            case C.TABLE_PROPERTY_POINTER:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_PROPERTY); break;
            case C.TABLE_TYPEDEF:
                assert (i === 4 || i === 5);
                field_size = i == 4 ? this.idx_size(C.TABLE_FIELD)
                                    : this.idx_size(C.TABLE_METHOD);
                break;
            case C.TABLE_GENERICPARAM:
                assert (i === 2);
                n = Math.max(
                    this.tables[C.TABLE_METHOD].rows,
                    this.tables[C.TABLE_TYPEDEF].rows
                );
                field_size = this.rtsize(n, 16 - C.TYPEORMETHOD_BITS);
                break;
            case C.TABLE_GENERICPARAMCONSTRAINT:
                assert (i === 0);
                field_size = this.idx_size(C.TABLE_GENERICPARAM);
                break;

            default:
                throw new Error("Can't handle Type.TABLE_IDX for table " +
                                table_index + " element " + i);
            }
            break;

        case MetaType.CONST_IDX:
            n = Math.max( this.tables[C.TABLE_PARAM].rows,
                          this.tables[C.TABLE_FIELD].rows,
                          this.tables[C.TABLE_PROPERTY].rows );
            field_size = this.rtsize(n, 16-2);
            break;
		case MONO_MT_HASCAT_IDX:
		case MONO_MT_CAT_IDX:
		case MONO_MT_HASDEC_IDX:
		case MONO_MT_IMPL_IDX:
		case MONO_MT_HFM_IDX:
		case MONO_MT_MF_IDX:
		case MONO_MT_TDOR_IDX:
		case MONO_MT_MRP_IDX:
		case MONO_MT_MDOR_IDX:
		case MONO_MT_HS_IDX:
		case MONO_MT_RS_IDX:
        default:
            throw "Not yet implemented: " + JSON.stringify(table.fields[i]);
        }
        table.field_size[i] = field_size;

        bitfield |= (field_size-1) << shift;
		shift += 2;
		size += field_size;
    }

    table.size_bitfield = (i << 24) | bitfield;
    return size;
};
I.prototype.metadata_string_heap = function(idx) {
    if( idx >= this.heap_strings.size ) {
        return "";
    }
    var str  = this.read_cstring( this.heap_strings.data + idx );
    XXX(this);
    return str;
};
I.prototype.metadata_decode_row_col = function(t, idx, col) {
    var bin = this.raw_data;
    var i, offset, size;
    // FIXME: this is very slow!
    assert( idx < t.rows );
    assert( col < t.fields.length );
    offset = t.base + (idx * t.row_size);
    for(i = 0; i < col; i++) {
        offset += t.field_size[i];
    }
    size = t.field_size[col];

    switch(size) {
    case 1: return bin.readUInt8(offset);
    case 2: return bin.readUInt16(offset);
    case 4: return bin.readUInt32(offset);
    }
    throw new InvalidImage(size);
};
I.prototype.read_cstring = function(beg, max_len) {
    var bin = this.raw_data;
    var end = beg;
    if(max_len) {
        max_len += beg;
    }
    else {
        max_len = bin.length;
    }
    while( end < max_len && bin[end] !== 0) {
        end++;
    }
    return bin.slice(beg, end).toString();
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

function Clion() {
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
Clion.Image   = I;

// export
module.exports = Clion;


// module clion
"use strict";

/** @const {boolean} */
var CLION_DEBUG = true;

/** @const {string} */
var VERSION = "0.0.1";

var meta = require('./meta');

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
var I = function Clion_Image(data_view, name) {
   this.image_info = {};
   this.typespec   = {};
   this.memberref  = {};
   this.helper     = {};
   this.method     = {};
   this.property   = {};

   if(name) {
       this.image_name = name;
   }
   if(data_view) {
       this.load_pe_data(data_view);
   }
};
I.create_from_file = function(file) {
    var fs = require('fs'),
        jDataView = require('jdataview').jDataView,
        buff;
    buff = fs.readFileSync(file);
    return new this( new jDataView(buff) );
};

I.prototype.toString = function() {
    var d = JSON.parse( JSON.stringify( this ) );
    delete d.raw_data;
    return JSON.stringify( d, null, 2 );
};

// data manipulators
I.prototype.read_u8 = function(offset) {
    return this.raw_data.getUint8(offset);
};
I.prototype.read_u16 = function(offset) {
    return this.raw_data.getUint16(offset);
};
I.prototype.read_u32 = function(offset) {
    return this.raw_data.getUint32(offset);
};
I.prototype.read_u64 = function(offset) {
    var quad = { };
    quad.lo = this.read32(offset);
    quad.hi = this.read32(offset+4);
    return quad;
};
// byte array
I.prototype.read_bytes = function(beg, len)  {
    var bytes = []; // TODO: typed array?
    var end   = beg + len;
    while(beg != end) {
        bytes.push( this.read_u8(beg) );
        beg++;
    }
    return bytes;
};
// NUL-ended string
I.prototype.read_str = function(beg, max_len) {
    var cstr = '';
    var end = beg;
    if(max_len) {
        assert( max_len > 0 );
        max_len += beg;
    }
    else {
        max_len = Infinity;
    }
    while( end < max_len && this.read_u8(end) !== 0) {
        // TODO: deal with utf-8 multi-byte char
        cstr += String.fromCharCode( this.read_u8(end) );
        end++;
    }
    return cstr;
};

I.prototype.rtsize = function(s, b) {
    return s < (1 << b) ? 2 : 4;
};
I.prototype.idx_size = function idx_size(table_idx) {
    return this.tables[table_idx].rows < 65536 ? 2 : 4;
};

// load & verify the executable binary
I.prototype.load_pe_data = function(data_view) {
    var msdos, h, offset;

    this.raw_data = data_view;

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
    var sig,
        msdos = {},
        offset = 0;

    sig = this.read_str(offset, 2);
    if(sig !== "MZ") {
        throw new InvalidImage(offset);
    }

    msdos.msdos_sig     = sig;
    offset += 2;
    msdos.nlast_page    = this.read_u16(offset);
    offset += 2;
    msdos.npages        = this.read_u16(offset);
    offset += 2;
    msdos.msdos_header  = this.read_bytes(offset, 54);
    offset += 54;
    msdos.pe_offset     = this.read_u32(offset);
    offset += 4;
    msdos.msdos_header2 = this.read_bytes(offset, 64);
    return msdos;
};
I.prototype.read_dir_entry = function(offset) {
    var de = {};
    de.rva  = this.read_u32(offset);
    offset += 4;
    de.size = this.read_u32(offset);
    offset += 4;
    return de;
};
I.prototype.load_header = function(h, offset) {
    var coff, pe, nt, datadir;

    h.pesig              = this.read_bytes(offset, 4);
    offset += 4;

    h.coff = coff = {}; // CoffHeader
    coff.machine         = this.read_u16(offset);
    offset += 2;
    coff.sections        = this.read_u16(offset)
    offset += 2;
    coff.time            = this.read_u32(offset)
    offset += 4;
    coff.symptr          = this.read_u32(offset)
    offset += 4;
    coff.symcount        = this.read_u32(offset)
    offset += 4;
    coff.opt_header_size = this.read_u16(offset)
    offset += 2;
    coff.oattributes     = this.read_u16(offset)
    offset += 2;

    h.pe = pe = {}; // PEHeader
    pe.magic             = this.read_u16(offset);
    offset += 2;
    pe.major             = this.read_u8(offset);
    offset += 1;
    pe.minor             = this.read_u8(offset);
    offset += 1;
    pe.code_size         = this.read_u32(offset);
    offset += 4;
    pe.data_size         = this.read_u32(offset);
    offset += 4;
    pe.uninit_data_size  = this.read_u32(offset);
    offset += 4;
    pe.rva_entry_point   = this.read_u32(offset);
    offset += 4;
    pe.rva_code_base     = this.read_u32(offset);
    offset += 4;
    pe.rva_data_base     = this.read_u32(offset);
    offset += 4;

    h.nt = nt = {}; // PEHeaderNT
    nt.image_base        = this.read_u32(offset);
    offset += 4;
    nt.section_align     = this.read_u32(offset);
    offset += 4;
    nt.file_alignment    = this.read_u32(offset);
    offset += 4;
    nt.os_major          = this.read_u16(offset);
    offset += 2;
    nt.os_minor          = this.read_u16(offset);
    offset += 2;
    nt.user_major        = this.read_u16(offset);
    offset += 2;
    nt.user_minor        = this.read_u16(offset);
    offset += 2;
    nt.subsys_major      = this.read_u16(offset);
    offset += 2;
    nt.subsys_minor      = this.read_u16(offset);
    offset += 2;
    nt.reserved_1        = this.read_u32(offset);
    offset += 4;
    nt.image_size        = this.read_u32(offset);
    offset += 4;
    nt.header_size       = this.read_u32(offset);
    offset += 4;
    nt.checksum          = this.read_u32(offset);
    offset += 4;
    nt.subsys_required   = this.read_u16(offset);
    offset += 2;
    nt.dll_flags         = this.read_u16(offset);
    offset += 2;
    nt.stack_reserve     = this.read_u32(offset);
    offset += 4;
    nt.stack_commit      = this.read_u32(offset);
    offset += 4;
    nt.heap_reserve      = this.read_u32(offset);
    offset += 4;
    nt.heap_commit       = this.read_u32(offset);
    offset += 4;
    nt.loader_flags      = this.read_u32(offset);
    offset += 4;
    nt.data_dir_count    = this.read_u32(offset);
    offset += 4;

    h.datadir = datadir = {};
    datadir.export_table      = this.read_dir_entry(offset);
    offset += 8;
    datadir.import_table      = this.read_dir_entry(offset);
    offset += 8;
    datadir.resource_table    = this.read_dir_entry(offset);
    offset += 8;
    datadir.exception_table   = this.read_dir_entry(offset);
    offset += 8;
    datadir.certificate_table = this.read_dir_entry(offset);
    offset += 8;
    datadir.reloc_table       = this.read_dir_entry(offset);
    offset += 8;
    datadir.debug             = this.read_dir_entry(offset);
    offset += 8;
    datadir.copyright         = this.read_dir_entry(offset);
    offset += 8;
    datadir.global_ptr        = this.read_dir_entry(offset);
    offset += 8;
    datadir.tls_table         = this.read_dir_entry(offset);
    offset += 8;
    datadir.load_config_table = this.read_dir_entry(offset);
    offset += 8;
    datadir.bound_import      = this.read_dir_entry(offset);
    offset += 8;
    datadir.iat               = this.read_dir_entry(offset);
    offset += 8;
    datadir.delay_import_desc = this.read_dir_entry(offset);
    offset += 8;
    datadir.cli_header        = this.read_dir_entry(offset);
    offset += 8;
    datadir.reserved          = this.read_dir_entry(offset);
    offset += 8;

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
    var iinfo = this.image_info;
    var top   = iinfo.header.coff.sections,
        i, t, namelen;

    iinfo.section_count  = top;
    iinfo.section_tables = [];
    iinfo.sections       = {};

    for(i = 0; i < top; i++) {
        t = iinfo.section_tables[i] = {};

        t.name = this.read_str(offset, 8);
        offset += 8;
        t.virtual_size    = this.read_u32(offset);
        offset += 4;
        t.virtual_address = this.read_u32(offset);
        offset += 4;
        t.raw_data_size   = this.read_u32(offset);
        offset += 4;
        t.raw_data_ptr    = this.read_u32(offset);
        offset += 4;
        t.reloc_ptr       = this.read_u32(offset);
        offset += 4;
        t.lineno_ptr      = this.read_u32(offset);
        offset += 4;
        t.reloc_count     = this.read_u32(offset);
        offset += 4;
        t.line_count      = this.read_u32(offset);
        offset += 4;
    }
};
I.prototype.load_cli_data = function() {
    this.load_cli_header();
    this.load_metadata();
};
I.prototype.load_cli_header = function() {
    var iinfo = this.image_info;
    var h     = iinfo.header,
        offset, cli_header;

    offset = this.cli_rva_image_map(h.datadir.cli_header.rva);
    if(offset == 0) {
        throw new InvalidImage();
    }

    cli_header = iinfo.cli_header = {}; // CLIHeader
    cli_header.size          = this.read_u32(offset);
    offset += 4;
    cli_header.runtime_major = this.read_u16(offset);
    offset += 2;
    cli_header.runtime_minor = this.read_u16(offset);
    offset += 2;
    cli_header.metadata      = this.read_dir_entry(offset);
    cli_header.flags         = this.read_u32(offset);
    offset += 4;

    cli_header.entry_point                = this.read_u32(offset);
    offset += 4;
    cli_header.resources                  = this.read_dir_entry(offset);
    offset += 8;
    cli_header.strong_name                = this.read_dir_entry(offset);
    offset += 8;
    cli_header.code_manager_table         = this.read_dir_entry(offset);
    offset += 8;
    cli_header.vtable_fixups              = this.read_dir_entry(offset);
    offset += 8;
    cli_header.export_address_table_jumps = this.read_dir_entry(offset);
    offset += 8;

    cli_header.eeinfo_table    = this.read_dir_entry(offset);
    offset += 8;
    cli_header.helper_table    = this.read_dir_entry(offset);
    offset += 8;
    cli_header.dynamic_info    = this.read_dir_entry(offset);
    offset += 8;
    cli_header.delay_load_info = this.read_dir_entry(offset);
    offset += 8;
    cli_header.module_image    = this.read_dir_entry(offset);
    offset += 8;
    cli_header.external_fixups = this.read_dir_entry(offset);
    offset += 8;
    cli_header.ridmap          = this.read_dir_entry(offset);
    offset += 8;
    cli_header.debug_map       = this.read_dir_entry(offset);
    offset += 8;
    cli_header.ip_map          = this.read_dir_entry(offset);
};
I.prototype.load_metadata = function() {
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
    this.raw_metadata = { data: offset, size: offset + size };
    metadata_offset = offset;

    if( this.read_str(offset, 4) !== "BSJB" ) {
        throw new InvalidImage(offset);
    }
    offset += 4;

    this.version_major = this.read_u16(offset);
    offset += 2;
    this.version_minor = this.read_u16(offset);
    offset += 6;

    str_len = this.read_u32(offset);
    offset += 4;
    this.version = this.read_str(offset, str_len);
    offset += str_len;
    pad = offset - metadata_offset;
    if( pad  % 4 ) {
        offset += 4 - (pad  % 4);
    }
    offset += 2; // skip over flags

    streams = this.read_u16(offset);
    offset += 2;

    for(i = 0; i < streams; i++) {
        o = {};
        o.data = metadata_offset + this.read_u32(offset);
        offset += 4;
        o.size = this.read_u32(offset); // size of heap
        offset += 4;

        type = this.read_str(offset);
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

    this.load_tables();
};
I.prototype.load_tables = function() { // from the "#~" stream
    var heap_tables = this.heap_tables.data;
    var offset, heap_sizes,
        valid_mask_hi,  valid_mask_lo,  // 64 bits
        sorted_mask_hi, sorted_mask_lo, // 64 bits
        rows, table, o, use_lo, flag,
        valid = 0;

    heap_sizes = this.read_u8(heap_tables + 6);
    this.idx_string_wide = !!( heap_sizes & 0x01 );
    this.idx_guid_wide   = !!( heap_sizes & 0x02 );
    this.idx_blob_wide   = !!( heap_sizes & 0x04 );

    offset = heap_tables + 8;
    valid_mask_lo  = this.read_u32(offset);
    offset += 4;
    valid_mask_hi  = this.read_u32(offset);
    offset += 4;
    sorted_mask_lo = this.read_u32(offset);
    offset += 4;
    sorted_mask_hi = this.read_u32(offset);
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
            flag = ( (valid_mask_hi & (1 << (table - 32))) == 0 );
        }
        if(flag) {
            if( table > C.TABLE_LAST ) {
                continue;
            }
            o.rows = 0;
            this.tables[table] = { rows: 0 };
            continue;
        }
        if( table > C.TABLE_LAST ) {
            W("bits in valid must be zero above 0x2d");
        }
        else {
            o.rows = this.read_u32(rows);
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
    // FIXME: something's wrong (?)
    if(this.tables[C.TABLE_ASSEMBLY].rows) {
        this.assembly_name = this.load_cstring_from_string_heap(
            this.tables[C.TABLE_ASSEMBLY], 0, C.ASSEMBLY_NAME
        );
    }
    this.module_name = this.load_cstring_from_string_heap(
        this.tables[C.TABLE_MODULE], 0, C.MODULE_NAME
    );
};
I.prototype.load_modules = function() {
    var t;
    assert( !this.modules );

    t = this.tables[C.TABLE_MODULEREF];
    this.modules        = new Array(t.rows); // of Clion.Image
    this.modules_loaded = new Array(t.rows); // of bool
    this.module_count   = t.rows;
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

        case MetaType.CONST_IDX: // HasConstant
            n = Math.max( this.tables[C.TABLE_PARAM].rows,
                          this.tables[C.TABLE_FIELD].rows,
                          this.tables[C.TABLE_PROPERTY].rows );
            field_size = this.rtsize(n, 16-2);
            break;
		case MetaType.HASCAT_IDX: // HasCastomAttribute
            n = Math.max(
                this.tables[C.TABLE_METHOD].rows,
                this.tables[C.TABLE_FIELD].rows,
                this.tables[C.TABLE_TYPEREF].rows,
                this.tables[C.TABLE_TYPEDEF].rows,
                this.tables[C.TABLE_PARAM].rows,
                this.tables[C.TABLE_INTERFACEIMPL].rows,
                this.tables[C.TABLE_MEMBERREF].rows,
                this.tables[C.TABLE_MODULE].rows,
                this.tables[C.TABLE_DECLSECURITY].rows,
                this.tables[C.TABLE_PROPERTY].rows,
                this.tables[C.TABLE_EVENT].rows,
                this.tables[C.TABLE_STANDALONESIG].rows,
                this.tables[C.TABLE_MODULEREF].rows,
                this.tables[C.TABLE_TYPESPEC].rows,
                this.tables[C.TABLE_ASSEMBLY].rows,
                this.tables[C.TABLE_ASSEMBLYREF].rows,
                this.tables[C.TABLE_FILE].rows,
                this.tables[C.TABLE_EXPORTEDTYPE].rows,
                this.tables[C.TABLE_MANIFESTRESOURCE].rows );
            field_size = this.rtsize(n, 16-5);
            break;
		case MetaType.CAT_IDX: // CustomAttributeType
            n = Math.max(
                this.tables[C.TABLE_TYPEREF].rows,
                this.tables[C.TABLE_TYPEDEF].rows,
                this.tables[C.TABLE_METHOD].rows,
                this.tables[C.TABLE_MEMBERREF].rows );
            field_size = this.rtsize(n, 16-3);
            break;
		case MetaType.HASDEC_IDX: // HasDeclSecurity
            n = Math.max(
                this.tables[C.TABLE_TYPEDEF].rows,
                this.tables[C.TABLE_METHOD].rows,
                this.tables[C.TABLE_ASSEMBLY].rows );
            field_size = this.rtsize(n, 16-2);
            break;
		case MetaType.IMPL_IDX: // Implementation
            n = Math.max(
                this.tables[C.TABLE_FILE].rows,
                this.tables[C.TABLE_ASSEMBLYREF].rows,
                this.tables[C.TABLE_EXPORTEDTYPE].rows );
            field_size = this.rtsize(n, 16-2);
            break;
		case MetaType.HFM_IDX: // HasFieldMarshall
            n = Math.max(
                this.tables[C.TABLE_FIELD].rows,
                this.tables[C.TABLE_PARAM].rows );
            field_size = this.rtsize(n, 16-1);
            break;
		case MetaType.MF_IDX: // MemberForwarded
            n = Math.max(
                this.tables[C.TABLE_FIELD].rows,
                this.tables[C.TABLE_METHOD].rows );
            field_size = this.rtsize(n, 16-1);
            break;
		case MetaType.TDOR_IDX: // TypeDefOrRef
            n = Math.max(
                this.tables[C.TABLE_TYPEDEF].rows,
                this.tables[C.TABLE_TYPEREF].rows,
                this.tables[C.TABLE_TYPESPEC].rows );
            field_size = this.rtsize(n, 16-2);
            break;
		case MetaType.MRP_IDX: // MemberRefParent
            n = Math.max(
                this.tables[C.TABLE_TYPEDEF].rows,
                this.tables[C.TABLE_TYPEREF].rows,
                this.tables[C.TABLE_METHOD].rows,
                this.tables[C.TABLE_MODULEREF].rows,
                this.tables[C.TABLE_TYPESPEC].rows,
                this.tables[C.TABLE_MEMBERREF].rows );
            field_size = this.rtsize(n, 16-3);
            break;
		case MetaType.MDOR_IDX: // MethoDefOrRef
            n = Math.max(
                this.tables[C.TABLE_METHOD].rows,
                this.tables[C.TABLE_MEMBERREF].rows );
            field_size = this.rtsize(n, 16-1);
            break;
		case MetaType.HS_IDX: // HasSemantics
            n = Math.max(
                this.tables[C.TABLE_PROPERTY].rows,
                this.tables[C.TABLE_EVENT].rows );
            field_size = this.rtsize(n, 16-1);
            break;
		case MetaType.RS_IDX: // ResolutionScope
            n = Math.max(
                this.tables[C.TABLE_MODULE].rows,
                this.tables[C.TABLE_MODULEREF].rows,
                this.tables[C.TABLE_ASSEMBLYREF].rows,
                this.tables[C.TABLE_TYPEREF].rows );
            field_size = this.rtsize(n, 16-2);
            break;
        default:
            throw "Unknown field type for " + table.name + "." + table.fields[i];
        }
        table.field_size[i] = field_size;

        bitfield |= (field_size-1) << shift;
		shift += 2;
		size += field_size;
    }

    table.size_bitfield = (i << 24) | bitfield;
    return size;
};
I.prototype.load_cstring_from_string_heap = function(t, idx, col) {
    var offset = this.metadata_decode_row_col(t, idx, col);
    return this.metadata_string_heap(offset);
};
I.prototype.metadata_string_heap = function(idx) {
    if( idx >= this.heap_strings.size ) return "";
    return this.read_str( this.heap_strings.data + idx );
};
I.prototype.metadata_blob_heap = function(idx) {
    if( idx >= this.heap_blob.size ) return "";
    var ptr = this.heap_blob.data + idx;
    var first = this.read_u8(ptr);
    var size;
    // blob_size
    if( (first & 0x80) === 0 ) {
        size = first & 0x7f;
        ptr++;
    }
    else if( (first & 0x40) == 0 ) {
        size = ((first & 0x3f) << 8) + this.read_u8(ptr+1);
        ptr += 2;
    }
    else {
        size = ((first & 0x1f) << 24) +
                (this.read_u8(ptr+1) << 16) +
                (this.read_u8(ptr+2) << 8) +
                 this.read_u8(ptr+3);
        ptr += 4;
    }
    return {
        data: ptr,
        size: size,
    };
};
I.prototype.guid = function() {
    var guid = [],
        i, x;
    for(i = 0; i <this.heap_guid.size; i++) {
        x = this.read_u8( this.heap_guid.data + i ).toString(16).toUpperCase();
        guid.push( x.length === 1 ? '0' + x : x);
    }
    return guid[3] + guid[2] + guid[1] + guid[0] +
            '-' + guid[5] + guid[4] +
            '-' + guid[7] + guid[6] +
            '-' + guid[8] + guid[9] +
            '-' + guid[10] + guid[11] + guid[12] +
                  guid[13] + guid[14] + guid[15];
};
I.prototype.metadata_decode_row = function(t, idx) {
    var i, offset, size, col;

    assert( idx < t.rows );
    assert( idx >= 0 );

    offset = t.base + (idx * t.row_size);

    col = new Array(t.fields.length);
    for(i = 0; i < t.fields.length; i++) {
        size = t.field_size[i];
        switch(size) {
        case 1: col[i] = this.read_u8(offset);  break;
        case 2: col[i] = this.read_u16(offset); break;
        case 4: col[i] = this.read_u32(offset); break;
        default: throw new InvalidImage(size);
        }
        offset += size;
    }
    return col;
};
I.prototype.metadata_decode_row_col = function(t, idx, col) {
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
    case 1: return this.read_u8(offset);
    case 2: return this.read_u16(offset);
    case 4: return this.read_u32(offset);
    }
    throw new InvalidImage(size);
};

I.prototype.metadata_token_table = function(t) {  return t >> 24; };
I.prototype.metadata_token_index = function(t) {  return t & 0x00ffffff; };
I.prototype.metadata_token_code  = function(t) {  return t & 0xff000000; };

I.prototype.get_table = function(name) {
    for(var i in this.tables) {
        var t = this.tables[i];
        if(t.name === name) {
            return t;
        }
    }
    throw Error("Invalid table name: " + name);
};
I.prototype.get_entry_point = function() {
    return this.image_info.cli_header.entry_point;
};
// @meradata/loader.c
I.prototype.get_method_from_token = function(token, klass, context) {
    var table  = this.metadata_token_table(token);
    var idx    = this.metadata_token_index(token);
    var tables = this.tables;
    var cols, sig, method = { };

    if( table !== C.TABLE_METHOD ) {
        throw "TODO!";
    }
    assert( idx <= tables[C.TABLE_METHOD].rows );
    cols = this.metadata_decode_row(tables[C.TABLE_METHOD], idx - 1, cols,
                                    C.METHOD_SIZE);

    method.flags  = cols[C.METHOD_FLAGS];
    method.iflags = cols[C.METHOD_IMPLFLAGS];

    if(    (cols[C.METHOD_FLAGS]     & C.METHOD_ATTRIBUTE_PINVOKE_IMPL)
        || (cols[C.METHOD_IMPLFLAGS] & C.METHOD_IMPL_ATTRIBUTE_INTERNAL_CALL) ) {
        method.type = "MethodPInvoke";
    }
    else {
        method.type = "Method";
    }

    if(!klass) {
        // TODO: load class
    }

    method.slot = -1;
    method.klass = klass;
    method.token = token;
    method.name  = this.metadata_string_heap(cols[C.METHOD_NAME]);

    sig = this.metadata_blob_heap(cols[C.METHOD_SIGNATURE]);
    if( this.raw_data[ sig.data ] & 0x10 ) {
        throw "TODO: generics";
    }

    if(method.iflags & C.METHOD_IMPL_ATTRIBUTE_INTERNAL_CALL) {
        TODO;
    }
    else if(method.flags & C.METHOD_ATTRIBUTE_PINVOKE_IMPL) {
        TODO;
    }

    return method;
};
I.prototype.get_method = function(token, klass, context) {
    // TODO: try method_cache
    var result = this.get_method_from_token(token, klass, context);
    return result;
};
I.prototype.run_main = function(args) {
    this.get_method( this.get_entry_point() );
};
I.prototype.dump = function() { // see dis_types()@dis/main.c
    var t   = this.tables[C.TABLE_TYPEDEF],
        i, flags, cols, cols_next,
        name, ns, o;

    for(i = 0; i < t.rows; i++) {
        o = {};
        cols = this.metadata_decode_row(t, i, C.TYPEDEF_SIZE);
        if(t.rows > i+1) {
            cols_next = this.metadata_decode_row(t, i+1, C.TYPEDEF_SIZE);
        }
        else {
            cols_next = null;
        }

        o.name = this.metadata_string_heap(cols[C.TYPEDEF_NAME]);
        o.ns   = this.metadata_string_heap(cols[C.TYPEDEF_NAMESPACE]);

        o.flags = cols[C.TYPEDEF_FLAGS];

        // TODO: load container

        if( (o.flags & C.TYPE_ATTRIBUTE_CLASS_SEMANTIC_MASK)
            == C.TYPE_ATTRIBUTE_CLASS ) {
            o.type = "class";
            // TODO: load generic param

            if(cols[C.TYPEDEF_EXTENDS]) {
                // TODO: .class extends
             }
        }
        else {
            XXX("not yet implemented: .class interface");
        }

        // TODO: cattrs
        // TODO: declarative security
        // TOOD: packing from typedef

        D(o);
    }
    XXX([t]);
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
// see ves_execute_method_with_context()@mono/interpreter/interp.c
M.prototype.execute = function(vm) {
    while(1) run_loop: switch( this.iseq[ this.pc ] ) {
        case ldstr:
            vm.stack.push();
        default:
            throw Error("Unknown instruction: " + this.iseq[ this.pc ]);
    }
};
M.prototype.finalize = function(vm) {
};

// The Clion application class
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


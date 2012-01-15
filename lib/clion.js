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
var TODO = function(name) {
    throw new Error("Not yet implemented: " + name);
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

function Class() {
}
function Method() {
}
function MethodPInvoke() { // Platform Invoke
}
function MethodSignature() {
}

var CacheMap = Object; // XXX: we need WeakMap (ES6)

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
function Image(data_view, name) {
   this.image_info = {};
   this.typespec   = {};
   this.memberref  = {};
   this.helper     = {};
   this.method     = {};
   this.property   = {};

   // internal caches
   this.class_cache       = new CacheMap();
   this.method_cache      = new CacheMap();
   this.methodref_cache   = new CacheMap();
   this.method_signatures = new CacheMap();

   this._offset    = 0;

   if(name) {
       this.image_name = name;
   }
   if(data_view) {
       this.load_pe_data(data_view);
   }

};
// if node
Image.create_from_file = function(file) {
    var fs = require('fs'),
        jDataView = require('jdataview').jDataView,
        buff;
    buff = fs.readFileSync(file);
    return new this( new jDataView(buff) );
};
// end

Image.prototype.toString = function() {
    return '<Clion.Image ' + this.module_name + ' ' + this.guid +  '>';
};

// data manipulators
Image.prototype.tell = function() {
    return this._offset;
};
Image.prototype.seek_set = function(offset) {
    this._offset = offset;
};
Image.prototype.seek_cur = function(offset) {
    this._offset += offset;
};
Image.prototype.peek_u8 = function(offset) {
    return this.raw_data.getUint8(
        offset === undefined ? this._offset : offset);
};
Image.prototype.peek_u16 = function(offset) {
    return this.raw_data.getUint16(
        offset === undefined ? this._offset : offset);
};
Image.prototype.peek_u32 = function(offset) {
    return this.raw_data.getUint32(
        offset === undefined? this._offset : offset);
};
Image.prototype.read_u8 = function() {
    return this.raw_data.getUint8(this._offset++);
};
Image.prototype.read_u16 = function() {
    var v = this.raw_data.getUint16(this._offset, true);
    this._offset += 2;
    return v;
};
Image.prototype.read_u32 = function() {
    var v = this.raw_data.getUint32(this._offset, true);
    this._offset += 4;
    return v;
};
Image.prototype.read_u64 = function() {
    var quad = { };
    quad.lo = this.raw_data.getUint32(this._offset, true);
    this._offset += 4;
    quad.hi = this.raw_data.getUint32(this._offset, true);
    this._offset += 4;
    return quad;
};
// byte array
Image.prototype.read_bytes = function(len, klass)  {
    var bytes = new (klass || Array)(len),
        i;
    for(i = 0; i < len; i++) {
        bytes[i] = this.read_u8();
    }
    return bytes;
};
// NUL-ended string
Image.prototype.read_str = function(max_len /* optional */) {
    var cstr = '', end_pos, i, c;
    if(max_len) {
        assert( max_len > 0 );
        end_pos = this._offset + max_len;
    }
    else {
        max_len = Infinity;
    }
    // TODO: deal with utf-8 multi-byte char
    while( cstr.length < max_len && (c = this.read_u8()) !== 0 ) {
        cstr += String.fromCharCode(c);
    }
    if(end_pos) {
        this._offset = end_pos;
    }
    return cstr;
};

Image.prototype.rtsize = function(s, b) {
    return s < (1 << b) ? 2 : 4;
};
Image.prototype.idx_size = function idx_size(table_idx) {
    return this.tables[table_idx].rows < 65536 ? 2 : 4;
};

// load & verify the executable binary
Image.prototype.load_pe_data = function(data_view) {
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

    this.seek_set(this.heap_guid.data);
    this.guid = this.format_guid( this.read_bytes( this.heap_guid.size ) );
};
Image.prototype.load_msdos_header = function() {
    var sig,
        msdos = {};

    this.seek_set(0);
    sig = this.read_str(2);
    if(sig !== "MZ") {
        throw new InvalidImage();
    }

    msdos.msdos_sig     = sig;
    msdos.nlast_page    = this.read_u16();
    msdos.npages        = this.read_u16();
    msdos.msdos_header  = this.read_bytes(54);
    msdos.pe_offset     = this.read_u32();
    msdos.msdos_header2 = this.read_bytes(64);
    return msdos;
};
Image.prototype.read_dir_entry = function(offset) {
    var de = {};
    de.rva  = this.read_u32(offset);
    de.size = this.read_u32(offset);
    return de;
};
Image.prototype.load_header = function(h, offset) {
    var coff, pe, nt, datadir;

    this.seek_set(offset);
    h.pesig              = this.read_bytes(4);

    h.coff = coff = {}; // CoffHeader
    coff.machine         = this.read_u16();
    coff.sections        = this.read_u16()
    coff.time            = this.read_u32()
    coff.symptr          = this.read_u32()
    coff.symcount        = this.read_u32()
    coff.opt_header_size = this.read_u16()
    coff.oattributes     = this.read_u16()

    h.pe = pe = {}; // PEHeader
    pe.magic             = this.read_u16();
    pe.major             = this.read_u8();
    pe.minor             = this.read_u8();
    pe.code_size         = this.read_u32();
    pe.data_size         = this.read_u32();
    pe.uninit_data_size  = this.read_u32();
    pe.rva_entry_point   = this.read_u32();
    pe.rva_code_base     = this.read_u32();
    pe.rva_data_base     = this.read_u32();

    h.nt = nt = {}; // PEHeaderNT
    nt.image_base        = this.read_u32();
    nt.section_align     = this.read_u32();
    nt.file_alignment    = this.read_u32();
    nt.os_major          = this.read_u16();
    nt.os_minor          = this.read_u16();
    nt.user_major        = this.read_u16();
    nt.user_minor        = this.read_u16();
    nt.subsys_major      = this.read_u16();
    nt.subsys_minor      = this.read_u16();
    nt.reserved_1        = this.read_u32();
    nt.image_size        = this.read_u32();
    nt.header_size       = this.read_u32();
    nt.checksum          = this.read_u32();
    nt.subsys_required   = this.read_u16();
    nt.dll_flags         = this.read_u16();
    nt.stack_reserve     = this.read_u32();
    nt.stack_commit      = this.read_u32();
    nt.heap_reserve      = this.read_u32();
    nt.heap_commit       = this.read_u32();
    nt.loader_flags      = this.read_u32();
    nt.data_dir_count    = this.read_u32();

    h.datadir = datadir = {};
    datadir.export_table      = this.read_dir_entry();
    datadir.import_table      = this.read_dir_entry();
    datadir.resource_table    = this.read_dir_entry();
    datadir.exception_table   = this.read_dir_entry();
    datadir.certificate_table = this.read_dir_entry();
    datadir.reloc_table       = this.read_dir_entry();
    datadir.debug             = this.read_dir_entry();
    datadir.copyright         = this.read_dir_entry();
    datadir.global_ptr        = this.read_dir_entry();
    datadir.tls_table         = this.read_dir_entry();
    datadir.load_config_table = this.read_dir_entry();
    datadir.bound_import      = this.read_dir_entry();
    datadir.iat               = this.read_dir_entry();
    datadir.delay_import_desc = this.read_dir_entry();
    datadir.cli_header        = this.read_dir_entry();
    datadir.reserved          = this.read_dir_entry();

    // verify
    if( pe.magic === 0x10B ) {
        // TODO
    }
    else if( pe.magic === 0x20B ) { // PE32+ format
        // TODO
    }
    else {
        throw new InvalidImage();
    }

    if( nt.image_base !== 0x400000 ) {
        throw new InvalidImage();
    }
    if( nt.section_align !== 0x2000 ) {
        throw new InvalidImage();
    }
    if(!(nt.file_alignment === 0x200 || nt.file_alignment == 0x1000)) {
        throw new InvalidImage();
    }
    if( nt.os_major !== 4 ) {
        throw new InvalidImage();
    }
    if( nt.os_minor !== 0 ) {
        throw new InvalidImage();
    }

    return this.tell();
};
Image.prototype.load_section_tables = function(offset) {
    var iinfo = this.image_info;
    var top   = iinfo.header.coff.sections,
        i, t, namelen;

    iinfo.section_count  = top;
    iinfo.section_tables = [];
    iinfo.sections       = {};

    this.seek_set(offset);
    for(i = 0; i < top; i++) {
        t = iinfo.section_tables[i] = {};

        t.name = this.read_str(8);
        t.virtual_size    = this.read_u32();
        t.virtual_address = this.read_u32();
        t.raw_data_size   = this.read_u32();
        t.raw_data_ptr    = this.read_u32();
        t.reloc_ptr       = this.read_u32();
        t.lineno_ptr      = this.read_u32();
        t.reloc_count     = this.read_u32();
        t.line_count      = this.read_u32();
    }
};
Image.prototype.load_cli_data = function() {
    this.load_cli_header();
    this.load_metadata();
};
Image.prototype.load_cli_header = function() {
    var iinfo = this.image_info;
    var h     = iinfo.header,
        offset, cli_header;

    offset = this.cli_rva_image_map(h.datadir.cli_header.rva);
    if(offset == 0) {
        throw new InvalidImage();
    }
    this.seek_set(offset);

    cli_header = iinfo.cli_header = {}; // CLIHeader
    cli_header.size          = this.read_u32();
    cli_header.runtime_major = this.read_u16();
    cli_header.runtime_minor = this.read_u16();
    cli_header.metadata      = this.read_dir_entry();
    cli_header.flags         = this.read_u32();

    cli_header.entry_point                = this.read_u32();
    cli_header.resources                  = this.read_dir_entry();
    cli_header.strong_name                = this.read_dir_entry();
    cli_header.code_manager_table         = this.read_dir_entry();
    cli_header.vtable_fixups              = this.read_dir_entry();
    cli_header.export_address_table_jumps = this.read_dir_entry();

    cli_header.eeinfo_table    = this.read_dir_entry();
    cli_header.helper_table    = this.read_dir_entry();
    cli_header.dynamic_info    = this.read_dir_entry();
    cli_header.delay_load_info = this.read_dir_entry();
    cli_header.module_image    = this.read_dir_entry();
    cli_header.external_fixups = this.read_dir_entry();
    cli_header.ridmap          = this.read_dir_entry();
    cli_header.debug_map       = this.read_dir_entry();
    cli_header.ip_map          = this.read_dir_entry();
};
Image.prototype.load_metadata = function() {
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

    this.seek_set(offset);
    if( this.read_str(4) !== "BSJB" ) {
        throw new InvalidImage();
    }

    this.version_major = this.read_u16();
    this.version_minor = this.read_u16();
    this.seek_cur(4);

    str_len = this.read_u32();
    this.version = this.read_str(str_len);
    pad = this.tell() - metadata_offset;
    if( pad  % 4 ) {
        this.seek_cur(4 - (pad  % 4));
    }
    this.seek_cur(2); // skip over flags

    streams = this.read_u16();

    for(i = 0; i < streams; i++) {
        o = {};
        o.data = metadata_offset + this.read_u32();
        o.size = this.read_u32(offset); // size of heap

        type = this.read_str();

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

        pad = this.tell() - this.raw_metadata.data;
        if(pad % 4) {
            this.seek_cur(4 - (pad % 4));
        }
    }

    this.load_tables();
};
Image.prototype.load_tables = function() { // from the "#~" stream
    var heap_tables = this.heap_tables.data;
    var offset, heap_sizes,
        valid_mask_hi,  valid_mask_lo,  // 64 bits
        sorted_mask_hi, sorted_mask_lo, // 64 bits
        rows, table, o, use_lo, flag,
        valid = 0;

    this.seek_set(heap_tables + 6);
    heap_sizes = this.read_u8();
    this.idx_string_wide = !!( heap_sizes & 0x01 );
    this.idx_guid_wide   = !!( heap_sizes & 0x02 );
    this.idx_blob_wide   = !!( heap_sizes & 0x04 );

    this.seek_set(heap_tables + 8);
    valid_mask_lo  = this.read_u32();
    valid_mask_hi  = this.read_u32();
    sorted_mask_lo = this.read_u32();
    sorted_mask_hi = this.read_u32();

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
            o.rows = this.read_u32();
        }
        this.tables[table] = o;

        valid++;
    }
    this.tables_base = (heap_tables + 24) + (4 * valid);
    assert(this.tables_base === this.tell());
    this.metadata_compute_table_bases();
};
Image.prototype.cli_rva_image_map = function(addr) {
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
Image.prototype.load_names = function() {
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
Image.prototype.load_modules = function() {
    var t;
    assert( !this.modules );

    t = this.tables[C.TABLE_MODULEREF];
    this.modules        = new Array(t.rows); // of Clion.Image
    this.modules_loaded = new Array(t.rows); // of bool
    this.module_count   = t.rows;
};

// metadata decoder
// see mono_metadata_compute_table_bases()@mono/metadata/metadata.c
Image.prototype.metadata_compute_table_bases = function() {
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
Image.prototype.metadata_compute_size = function(table_index, table) {
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
Image.prototype.load_cstring_from_string_heap = function(t, idx, col) {
    var offset = this.metadata_decode_row_col(t, idx, col);
    return this.metadata_string_heap(offset);
};
Image.prototype.metadata_string_heap = function(idx) {
    if( idx >= this.heap_strings.size ) return "";
    this.seek_set(this.heap_strings.data + idx);
    return this.read_str();
};
Image.prototype.metadata_decode_blob = function(idx) {
    if( idx >= this.heap_blob.size ) return { };
    return this.metadata_decode_value( this.heap_blob.data + idx);
};
Image.prototype.metadata_decode_value = function(offset) {
    var size;
    this.seek_set(offset);

    size = this.read_u8();
    if( (size & 0x80) === 0 ) {
        size &= 0x7f;
    }
    else if( (size & 0x40) == 0 ) {
        size &= 0x3f;
        size <<= 8;
        size |= this.read_u8();
    }
    else {
        size &= 0x1f;
        size <<= 24;
        size |= this.read_u8() << 16;
        size |= this.read_u8() <<  8;
        size |= this.read_u8();
    }
    return {
        data: this.tell(),
        size: size,
    };
};
Image.prototype.metadata_typedef_from_method = function(idx) {
    var tdef = this.tables[C.TABLE_TYPEDEF],
        token_idx, i, mlist_idx;
    token_idx = this.metadata_token_index(idx);

    if(this.uncompressed_metadata) {
        token_idx = this.search_ptr_table(C.TABLE_METHOD_POINTER, token_idx);
    }

    // FIXEM: Image don't know the why
    return token_idx;

    // XXX: performs linear search, but binary search can be better
    for(i = 0; i < tdef.rows; i++) {
        mlist_idx = this.metadata_decode_row_col(tdef, i, C.TYPEDEF_METHOD_LIST);
        //console.log([i, mlist_idx, token_idx, this.load_cstring_from_string_heap(tdef, i, C.TYPEDEF_NAME)]);
        if(mlist_idx === token_idx) {
            return i + 1;
        }
    }
    return 0;
};
Image.prototype.metadata_interface_from_typedef_full= function(idx, heap_allc_result, context) {
    var tdef = this.tables[C.TABLE_INTERFACEIMPL];
    var interfaces = [];
    if(!tdef.base) {
        return interfaces;
    }
    TODO('interface');
};
Image.prototype.format_guid = function(binary) {
    var guid = new Array(binary.length),
        i, x;
    for(i = 0; i < binary.length; i++) {
        x = binary[i].toString(16).toUpperCase();
        guid[i] = ( x.length === 1 ? '0' + x : x);
    }
    return guid[3] + guid[2] + guid[1] + guid[0] +
            '-' + guid[5]  + guid[4] +
            '-' + guid[7]  + guid[6] +
            '-' + guid[8]  + guid[9] +
            '-' + guid[10] + guid[11] + guid[12] +
                  guid[13] + guid[14] + guid[15];
};
Image.prototype.metadata_decode_row = function(t, idx) {
    var i, cols;

    assert( idx < t.rows );
    assert( idx >= 0 );

    this.seek_set( t.base + (idx * t.row_size) );

    cols = new Array(t.fields.length);
    for(i = 0; i < t.fields.length; i++) {
        switch(t.field_size[i]) {
        case 1: cols[i] = this.read_u8();  break;
        case 2: cols[i] = this.read_u16(); break;
        case 4: cols[i] = this.read_u32(); break;
        default: throw new InvalidImage();
        }
    }
    return cols;
};
Image.prototype.metadata_decode_row_col = function(t, idx, col) {
    var i, offset;
    // FIXME: this is very slow!
    assert( idx < t.rows );
    assert( col < t.fields.length );
    offset = t.base + (idx * t.row_size);
    for(i = 0; i < col; i++) {
        offset += t.field_size[i];
    }
    switch(t.field_size[col]) {
    case 1: return this.peek_u8(offset);
    case 2: return this.peek_u16(offset);
    case 4: return this.peek_u32(offset);
    throw new InvalidImage();
    }
};

Image.prototype.metadata_token_table = function(t) {  return t >> 24; };
Image.prototype.metadata_token_index = function(t) {  return t & 0x00ffffff; };
Image.prototype.metadata_token_code  = function(t) {  return t & 0xff000000; };

Image.prototype.class_create_from_typedef = function(type_token, context) {
    var tables = this.tables;
    var tdef = tables[C.TABLE_TYPEDEF];
    var klass, parent = null, cols, cols_next,
        tidx = this.metadata_token_index(type_token),
        context,
        name, nspace, icount, interfaces,
        field_last, method_last, nesting_token;

    assert(!(
        this.metadata_token_table(type_token) !== C.TABLE_TYPEDEF
        ||
        tidx > tdef.rows
    ));

    klass = this.class_cache[ type_token ];
    if(klass) {
        return klass;
    }
    cols = this.metadata_decode_row(tdef, tidx - 1, C.TYPEDEF_SIZE);

    name   = this.metadata_string_heap(cols[C.TYPEDEF_NAME]);
    nspace = this.metadata_string_heap(cols[C.TYPEDEF_NAMESPACE]);

    klass = new Class();
    klass.name       = name;
    klass.name_space = nspace;
    klass.image      = this;
    klass.type_token = type_token;
    klass.flags      = cols[C.TYPEDEF_FLAGS];

    this.class_cache[type_token] = klass;

    // TODO: this.metadata_load_generic_params
    klass.generic_container = null;

    if(cols[C.TYPEDEF_EXTENDS]) {
        parent = null; // TODO
    }
    //klass.setup_parent(parent);
    //klass.setup_type();

    // TODO: nesting

    if((klass.flags & C.TYPE_ATTRIBUTE_STRING_FORMAT_MASK)
             == C.TYPE_ATTRIBUTE_UNICODE_CLASS) {
        klass.unicode = true;
    }

    klass.cast_cllass = klass.elemen_class = klass;

    if(!klass.enumtype) {
        interfaces = this.metadata_interface_from_typedef_full(
            type_token, false, context);
        klass.interfaces = interfaces;
    }
    else {
        TODO('enumtype');
    }

    klass.field  = { first: cols[C.TYPEDEF_FIELD_LIST] - 1 };
    klass.method = { first: cols[C.TYPEDEF_METHOD_LIST] - 1 };

    if(tdef.rows > tidx) {
        cols_next    = this.metadata_decode_row(tdef, tidx, T.TYPEDEF_SIZE);
        field_last  = cols_next[C.TYPEDEF_FIELD_LIST] - 1;
        method_last = cols_next[C.TYPEDEF_METHOD_LIST] - 1;
    }
    else {
        field_last  = tables[C.TABLE_FIELD].rows;
        method_last = tables[C.TABLE_METHOD].rows;
    }

    if(cols[C.TYPEDEF_FIELD_LIST] <= tables[C.TABLE_FIELD].rows) {
        klass.field.count = field_last - klass.field.first;
    }
    else {
        klass.field.count = 0;
    }

    if(cols[C.TYPEDEF_METHOD_LIST] <= tables[C.TABLE_METHOD].rows) {
        klass.method.count = field_last - klass.method.first;
    }
    else {
        klass.method.count = 0;
    }

    if(klass.generic_container) {
        TODO('generic container');
    }

    return klass;
};
Image.prototype.class_get_full = function(type_token, context) {
    var klass;
    if(this.dynamic) {
        TODO('dynamic');
    }
    switch( this.metadata_token_code(type_token) ) {
    case C.TOKEN_TYPE_DEF:
        klass = this.class_create_from_typedef(type_token);
        break;
    case C.TOKEN_TYPE_REF:
        klass = this.class_from_typeref(type_token);
        break;
    case C.TOKEN_TYPE_SPEC:
        klass = this.class_create_from_typespec(type_token, context);
        break;
    default: throw new InvalidImage();
    }
    return klass;
};

Image.prototype.get_table_entries = function(t) { // for debugging
    var i, j, reader, a = new Array(t.rows),
        row, v, save;
    this.seek_set( t.base );

    reader = function(img, size) {
        switch(size) {
        case 1: return img.read_u8();
        case 2: return img.read_u16();
        case 4: return img.read_u32();
        default: throw new InvalidImage();
        }
    };
    for(i = 0; i < t.rows; i++) {
        row = {};
        for(j = 0; j < t.fields.length; j++) {
            switch(t.field_type[j]) {
            case MetaType.UINT8:
                v = this.read_u8();
                break;
            case MetaType.UINT16:
                v = this.read_u16();
                break;
            case MetaType.UINT32:
                v = this.read_u32();
                break;
            case MetaType.STRING_IDX:
                reader(this, t.field_size[j]);
                save = this.tell();
                v = this.load_cstring_from_string_heap(t, i, j);
                this.seek_set(save);
                break;
            case MetaType.TABLE_IDX:
            case MetaType.TDOR_IDX:
            case MetaType.GUID_IDX:
            case MetaType.BLOB_IDX:
            case MetaType.MRP_IDX:
                v = reader(this, t.field_size[j]);
                break;
            default:
                v = this.read_bytes(t.field_size[j]);
                break;
            }
            row[ t.fields[j] ] = v;
        }
        a[i] = row;
    }
    return a;
};
Image.prototype.get_table = function(name) { // for debugging
    for(var i in this.tables) {
        var t = this.tables[i];
        if(t.name === name) {
            return t;
        }
    }
    throw Error("Invalid table name: " + name);
};
Image.prototype.get_entry_point = function() {
    return this.image_info.cli_header.entry_point;
};
// @meradata/loader.c
Image.prototype.get_method_from_token = function(token, klass, context) {
    var table  = this.metadata_token_table(token);
    var idx    = this.metadata_token_index(token);
    var tables = this.tables;
    var cols, iflags, flags, type, sig, method;

    if(this.dynamic) {
        TODO('dynamic');
    }

    if( table !== C.TABLE_METHOD ) {
        TODO('the case of table != C.TABLE_METHOD');
    }
    assert( idx <= tables[C.TABLE_METHOD].rows );
    cols = this.metadata_decode_row(tables[C.TABLE_METHOD], idx - 1, cols,
                                    C.METHOD_SIZE);

    flags  = cols[C.METHOD_FLAGS];
    iflags = cols[C.METHOD_IMPLFLAGS];

    if(    (flags  & C.METHOD_ATTRIBUTE_PINVOKE_IMPL)
        || (iflags & C.METHOD_IMPL_ATTRIBUTE_INTERNAL_CALL) ) {
        method = new MethodPInvoke();
    }
    else {
        method = new Method();
    }

    if(!klass) {
        type  = this.metadata_typedef_from_method(token);
        assert(type === 2); // XXX for hello.exe
        klass = this.class_get_full(C.TOKEN_TYPE_DEF | type, null);
    }

    method.slot   = -1;
    method.klass  = klass;
    method.flags  = flags;
    method.iflags = iflags;
    method.token  = token;
    method.name   = this.metadata_string_heap(cols[C.METHOD_NAME]);

    sig = this.metadata_decode_blob(cols[C.METHOD_SIGNATURE]);
    if( this.peek_u8(sig.data) & 0x10 ) {
        TODO('generics');
    }

    if(iflags & C.METHOD_IMPL_ATTRIBUTE_INTERNAL_CALL) {
        TODO('internal call');
    }
    else if(flags & C.METHOD_ATTRIBUTE_PINVOKE_IMPL) {
        TODO('pinvoke');
    }

    return method;
};
Image.prototype.get_method_full = function(token, klass, context) {
    var cache, method, out;
    if( this.metadata_token_table(token) === C.TABLE_METHOD ) {
        cache = this.method_cache;
    }
    else {
        cache = this.methodref_cache;
    }
    method = cache[token];
    if(method) {
        return method;
    }
    out = {};
    method = this.get_method_from_token(token, klass, context, out);

    if(!out.used_context && !method.is_inflated) {
        cache[token] = method;
    }
    return method;
};
Image.prototype.parse_method_signature_full = function(container, def, sig) {
    var v, signature, i, pattrs,
        hasthis, explicit_this, call_convertion, param_count,
        gen_param_count, is_open;

    this.seek_set(sig.data);
    v = this.read_u8();
    if(v & 0x10) {
        gen_param_count = 1;
    }
    if(v & 0x20) {
        hasthis = 1;
    }
    if(v & 0x40) {
        explicit_this = 1;
    }
    call_convention = v & 0x0F;

    if(gen_param_count) {
        v = this.metadata_decode_value(this.tell());
        gen_param_count = v.size;
    }
    v = this.metadata_decode_value(this.tell());
    param_count = v.size;

    if(def) {
        pattrs = this.metadata_get_param_attrs(def, param_count + 1);
    }

    signature = new MethodSignature();
    signature.hasthis             = hasthis;
    signature.explicit_this       = explicit_this;
    signature.call_convertion     = call_convertion;
    signature.generic_param_count = gen_param_count;

    if(call_convertion !== 0x0a) {
        signature.ret = this.metadata_parse_type_full(
            container,
            C.PARSE_RET,
            pattrs ? pattrs[0] : 0,
            this.tell()
        );
        is_open = false; // class_is_open_constructed_type
    }

    signature.params = [];
    for(i = 0; i < param_count; i++) {
        v = this.peek_u8();
        if(v === C.TYPE_SENTINEL) {
            if(call_convention !== C.CALL_VARARG || def) {
                throw new Error("found sentinel for methoddef or no vararg method");
            }
            if(signature.sentinelpos >= 0) {
                throw new Error("found sentinel twice in the same signature");
            }
            signature.sentinelpos = i;
            this.seek_cur(1);
        }
        signature.params[i] = this.metadata_parse_type_full(
            container, C.PARSE_PARAM, pattrs[i+1], this.tell()
        );
        if(!is_open) {
            is_open = false; // class_is_open_constructed_type
        }
    }

};
Method.prototype.signature = function() { // @metadata/loader.c
    var image, idx, sig, container,
        signature, sig_offset,
        can_cache_signature;
    if(this._signature) {
        return this._signature;
    }

    if(this.is_inflated) {
        TODO("method.is_inflated");
        signature = null; // TODO
    }

    image      = this.klass.image;
    idx        = image.metadata_token_index(this.token);
    sig_offset = image.metadata_decode_row_col(image.tables[C.TABLE_METHOD],
                                              idx - 1, C.METHOD_SIGNATURE);
    sig        = image.metadata_decode_blob(sig_offset);

    /* TODO
    container = method.get_generic_container();
    if(!container) {
        container = method.klass.generic_container;
    }
    */
    can_cache_signature = true;
    if(this.iflags & C.METHOD_IMPL_ATTRIBUTE_INTERNAL_CALL) {
        can_cache_signature = false;
    }
    else if(this.flags & C.METHOD_ATTRIBUTE_PINVOKE_IMPL) {
        can_cache_signature = false;
    }
    else if(container) {
        can_cache_signature = false;
    }
    else if(image.metadata_method_has_param_attrs(idx)) {
        can_cache_signature = false;
    }

    if(can_cache_signature) {
        signature = image.method_signatures[sig];
    }

    if(!signature) {
        signature = image.metadata_parse_method_signature_full(
            container, idx, sig);
        if(!signature) {
            throw new Error("Failed to load method signature");
        }

        if(can_cache_signature) {
            image.method_signatures[sig] = signature;
        }
    }

    if(signature.generic_param_count) {
        TODO('generics');
    }
    if(this.iflags & C.METHOD_IMPL_ATTRIBUTE_INTERNAL_CALL) {
        signature.pinvoke = true;
    }
    else if(this.flags & C.METHOD_ATTRIBUTE_PINVOKE_IMPL) {
        signature.pinvoke = true;
        TODO('pinvoke call convention');
    }

    this._signature = signature;
    return signature;
};

Image.prototype.run = function(args) { // ves_exec()@interpreter/interp.c
    var method = this.get_method_full(this.get_entry_point(), null, null);

    // runtime_run_main()@metaata/objcect.c
    var domain = null // TODO: Clion.domain();
    var fullpath, sig;

    sig = method.signature();
    XXX(sig);

};
Image.prototype.dump = function() { // see dis_types()@dis/main.c
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
                void(0);
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

// The Clion application class
function Clion() {
};

Clion.version = VERSION;
Clion.Image   = Image;;

// export
module.exports = Clion;


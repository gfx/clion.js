// Clion.JS - ECMA-335 implementation in JavaScript
// http://github.com/gfx/clion.js

(function(exporter) {
    "use strict";
    var DEBUG = true;

    var __ii = 0; // instruction identifier
    var ldstr = ++__ii;

    var InvalidImage = function InvalidImage(offset) {
        var msg        = offset ? "(offset=" + offset + ")" : "";
        this.__proto__ = new Error("Invalid CLI executable " + msg);
    };

    var p = console.log;
    var d = DEBUG ? console.log : function() { };

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
       this.name       = name;
       this.image_info = {};
       this.typespec   = {};
       this.memberref  = {};
       this.helper     = {};
       this.method     = {};
       this.property   = {};
    };
    I.prototype.load_pe_data = function(bin) {
        var msdos  = this.load_msdos_header(bin),
            h      = {}; // .NET header
        var offset = msdos.pe_offset;

        this.image_info.header = h;

        offset = this.load_header(bin, h, offset);
        if(offset < 0) {
            throw new InvalidImage(offset);
        };

        offset = this.load_section_tables(bin, offset);

        this.load_cli_data(bin);

        d(this.image_info);
        d(h);
        d(this);
    };
    I.prototype.load_msdos_header = function(bin) {
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
    I.prototype.load_header = function(bin, h, offset) {
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
    I.prototype.load_section_tables = function(bin, offset) {
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
    I.prototype.load_cli_data = function(bin) {
        var iinfo = this.image_info;
        var h     = iinfo.header,
            offset, cli_header;

        // load cli header
        offset = this.cli_rva_image_map(bin, h.datadir.cli_header.rva);
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
    I.prototype.cli_rva_image_map = function(bin, addr) {
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


    var M = function Clion_Module(name) {
        this.name = name;
        this.iseq = [ ];
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

    var VM = exporter.Clion = function Clion_VES() {
    };

    VM.load = function(thing) {
        var vm = new this();
        vm.load(thing);
        return vm;
    };

    VM.prototype.load = function(binary) {
        this.main = new M('main');
    };

    VM.prototype.run = function() {
        // using arguments
        var module = this.main;
        module.initialize(vm, arguments);
        module.execute(vm);
        module.finalize(vm);
    };
    VM.Image = I;
})(
    // exporter
      typeof(window)  !== 'undefined' ? window
    : typeof(exports) !== 'undefined' ? exports
    : this
);

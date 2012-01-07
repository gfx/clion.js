// Clion.JS - ECMA-335 implementation in JavaScript
// http://github.com/gfx/clion.js

(function(exporter) {
    "use strict";

    var __ii = 0; // instruction identifier
    var ldstr = ++__ii;

    var InvalidImage = function InvalidImage(offset) {
        var msg        = "(offset=" + offset + ")";
        this.__proto__ = new Error("Invalid CLI executable " + msg);    
    };

    var p = console.log;

    // see:
    // mono_image_load_pe_data()@mono/metadata/image.c
    // MonoMSDOSHeader@mono/metadata/cil-conff.h
    var I = function Clion_Image() {
       this.typespec  = {};
       this.memberref = {};
       this.helper    = {};
       this.method    = {};
       this.property  = {};
    };
    I.prototype.load_image = function(bin) {
        var msdos  = this.load_msdos_header(bin),
            h      = {}; // .NET header
        var offset = msdos.pe_offset;

        offset = this.load_cli_header(bin, offset, h);
        if(offset < 0) {
            throw new InvalidImage(offset);
        };
        p(h);
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

        msdos.msdos_sig     = bin.slice(offset, 2);
        offset += 2;
        msdos.nlast_page    = bin.readUInt16(offset);
        offset += 2;
        msdos.npages        = bin.readUInt16(offset);
        offset += 2;
        msdos.msdos_header  = bin.slice(offset, 54);
        offset += 54;
        msdos.pe_offset     = bin.readUInt32(offset);
        offset += 4;
        msdos.msdos_header2 = bin.slice(offset, 64);
        return msdos;
    };
    I.prototype.load_cli_header = function(bin, offset, h) {
        var coff, pe, nt, pedatadir;
        
        h.pesig              = bin.readUInt32(offset);
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
        
        // verify 
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

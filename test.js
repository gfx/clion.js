#!/usr/bin/env node
"use strict";

var fs = require("fs");

var Clion = require('./clion').Clion;

var img = new Clion.Image;

img.load_pe_data( fs.readFileSync("./hello.exe") );




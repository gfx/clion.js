#!/usr/bin/env node
"use strict";

var util  = require('util');
var Clion = require("..");

var img = Clion.Image.create_from_file("test/r/hello.exe");

console.log( util.inspect(img, null, 10) );

#!/usr/bin/env node
"use strict";

var Clion = require('..');

var file = process.argv[2] || 'example/hello.exe' || '/dev/stdin';

var img = Clion.Image.create_from_file(file);

console.log( img );

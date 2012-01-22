#!/usr/bin/env node
"use strict";

var Clion = require('..');

var file = process.argv[2] || 'example/hello.exe' || '/dev/stdin';

var img = Clion.load_from_file(file);

img.run([]);

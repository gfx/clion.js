#!/usr/bin/env node
"use strict";

var Clion     = require('./');

var file = process.argv[2] || '/dev/stdin';

var img = Clion.Image.create_from_file(file);

img.dump();

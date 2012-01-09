#!/usr/bin/env node
"use strict";

var Clion = require('./');

var file = process.argv[2];
var img = new Clion.Image(file);

img.dump();

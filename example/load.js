#!/usr/bin/env node
"use strict";

var Clion = require("..");

var img = Clion.Image.create_from_file("test/r/hello.exe");

console.log(img);

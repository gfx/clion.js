#!/usr/bin/env node
"use strict";

var Clion = require('./clion').Clion;

var file = process.argv[2];
var img = new Clion.Image(file);

//console.log('image_info:', img.image_info);
//console.log('image:', img);
img.dis_type();


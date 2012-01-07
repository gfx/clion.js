#!/usr/bin/env node
"use strict";

var Clion = require('./clion').Clion;

var img = new Clion.Image('./hello.exe');

console.log('image_info:', img.image_info);
console.log('image:', img);



Clion.JS - ECMA-335 virtual machine in JavaScript
==================================================

SYNOPSIS
=================================================

    // load Clion.JS in node.js
    var Clion = require('Clion').Clion;

    var c = new Clion("hello.exe");
    c.run();

DESCRIPTION
==================================================
Clion.JS is a JavaScript implementation of ECMA-335 specification
(Common Lanugage Infrastructure).

Clion.JS provides only a virtual machine, i.e. not including compilers
nor the other toolchains.

COMPONENTS
==================================================

* Loader
* Virtual Machine
* Object Space

INSTALL
==================================================

For testing, you can install all the deps in `node_modules/` by:

    npm install

And then type the following command:

    mocha

SEE ALSO
==================================================

* http://www.ecma-international.org/publications/standards/Ecma-335.htm
* http://www.mono-project.com/
* http://github.com/mono/mono

LICENSE AND COPYRIGHT
==================================================
Copyright (c) Fuji Goro (gfx) <gfuji at cpan.org>. All rights reserved.

This program is free software; you can redistribute it and/or modify it under terms of the Artistic License version 2.



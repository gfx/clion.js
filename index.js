// support for require("..") in tests
try {
    module.exports = require('./clion.min.js').Clion;
}
catch(e) {
    module.exports = require('./lib/clion').Clion;
}

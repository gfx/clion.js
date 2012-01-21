/**
 * Representation of 64 bit unsigned integer
 * @constructor
 */
function U64(hi, lo) {
    this.hi = hi;
    this.lo = lo;
}
U64.from_be32 = function(hi, lo) {
    return new U64(hi, lo);
}
U64.from_le32 = function(lo, hi) {
    return new U64(hi, lo);
}
/**
 * Checks whether a bit is enabled or disabled
 * @param {number} idx
 * @return {boolean}
 */
U64.prototype.at = function(idx) {
    if(idx < 32) {
        return( (this.lo & (1 << idx)) !== 0 );
    }
    else {
        return( (this.hi & (1 << (idx - 32))) !== 0 );
    }
};


/**
 * @param {string} hex
 * @return {string}
 */
function padding32(hex) {
    while( (8 - hex.length) > 0) {
        hex = '0' + hex;
    }
    return hex;
}
/**
 * @return {string}
 */
U64.prototype.toString = function() {
    return '0x' +
        padding32( this.hi.toString(16).toUpperCase() ) +
        padding32( this.lo.toString(16).toUpperCase() );
};

module.exports = U64;


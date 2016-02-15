'use strict';

var multipliers = {
    'b': 1,
    'k': 1024,
    'm': 1024 * 1024,
    'g': 1024 * 1024 * 1024
};

function parseSize(size) {
    // Parse `size`.
    if (typeof (size) === 'string') {
        // <number><scope> where scope is:
        //    b   bytes
        //    k   kilobytes
        //    m   megabytes
        //    g   gigabytes
        var threshold = size;
        var m = /^([1-9][0-9]*)([bkmg])$/.exec(threshold);
        if (!m) {
            throw new Error(format('invalid threshold: "%s"', size));
        }

        return Number(m[1]) * multipliers[m[2]];
    } else {
        return size;
    }
}

module.exports = parseSize;

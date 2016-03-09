'use strict';

var multipliers = {
    'b': 1,
    'k': 1024,
    'm': 1024 * 1024,
    'g': 1024 * 1024 * 1024
};

function parsePeriod(period) {
    var result = {
        periodNum: 1,
        periodScope: 'd'
    };

    // Parse `period`.
    if (period) {
        // <number><scope> where scope is:
        //    h   hours (at the start of the hour)
        //    d   days (at the start of the day, i.e. just after midnight)
        //    w   weeks (at the start of Sunday)
        //    m   months (on the first of the month)
        //    y   years (at the start of Jan 1st)
        // with special values 'hourly' (1h), 'daily' (1d), "weekly" (1w),
        // 'monthly' (1m) and 'yearly' (1y)
        var crackedperiod = {
            'hourly': '1h',
            'daily': '1d',
            'weekly': '1w',
            'monthly': '1m',
            'yearly': '1y'
        }[period] || period;
        var m = /^([1-9][0-9]*)([hdwmy]|ms)$/.exec(crackedperiod);
        if (!m) {
            throw new Error('invalid period: "' + period + '"');
        }

        result.periodNum = Number(m[1]);
        result.periodScope = m[2];
    }

    return result;
}

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
            throw new Error('invalid threshold: "' + size + '"');
        }

        return Number(m[1]) * multipliers[m[2]];
    } else {
        return size;
    }
}

module.exports = { parseSize: parseSize, parsePeriod: parsePeriod };

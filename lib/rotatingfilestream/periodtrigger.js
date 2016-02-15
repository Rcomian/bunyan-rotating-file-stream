// Just emits "rotate" events at the right time.
// Does not know about a rotating file stream.
'use strict';

var util = require('util');
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

var _DEBUG = false;

function nextRotTime(rotAt, periodScope, periodNum) {
    if (_DEBUG)
        console.log('-- _nextRotTime: %s%s', periodNum, periodScope);
    var d = new Date();

    if (_DEBUG) console.log('  now local: %s', d);
    if (_DEBUG) console.log('    now utc: %s', d.toISOString());

    var newRotAt;
    switch (periodScope) {
    case 'ms':
        // Hidden millisecond period for debugging.
        if (rotAt) {
            newRotAt = rotAt + periodNum;
        } else {
            newRotAt = Date.now() + periodNum;
        }
        break;
    case 'h':
        if (rotAt) {
            newRotAt = rotAt + periodNum * 60 * 60 * 1000;
        } else {
            // First time: top of the next hour.
            newRotAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
                d.getUTCDate(), d.getUTCHours() + 1);
        }
        break;
    case 'd':
        if (rotAt) {
            newRotAt = rotAt + periodNum * 24 * 60 * 60 * 1000;
        } else {
            // First time: start of tomorrow (i.e. at the coming midnight) UTC.
            newRotAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
                d.getUTCDate() + 1);
        }
        break;
    case 'w':
        // Currently, always on Sunday morning at 00:00:00 (UTC).
        if (rotAt) {
            newRotAt = rotAt + periodNum * 7 * 24 * 60 * 60 * 1000;
        } else {
            // First time: this coming Sunday.
            newRotAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),
                d.getUTCDate() + (7 - d.getUTCDay()));
        }
        break;
    case 'm':
        if (rotAt) {
            newRotAt = Date.UTC(d.getUTCFullYear(),
                d.getUTCMonth() + periodNum, 1);
        } else {
            // First time: the start of the next month.
            newRotAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
        }
        break;
    case 'y':
        if (rotAt) {
            newRotAt = Date.UTC(d.getUTCFullYear() + periodNum, 0, 1);
        } else {
            // First time: the start of the next year.
            newRotAt = Date.UTC(d.getUTCFullYear() + 1, 0, 1);
        }
        break;
    default:
        assert.fail(format('invalid period scope: "%s"', periodScope));
    }

    if (_DEBUG) {
        console.log('  **rotAt**: %s (utc: %s)', newRotAt,
            new Date(rotAt).toUTCString());
        var now = Date.now();
        console.log('        now: %s (%sms == %smin == %sh to go)',
            now,
            newRotAt - now,
            (newRotAt-now)/1000/60,
            (newRotAt-now)/1000/60/60);
    }
    return newRotAt;
};

function parseOptions(options) {
    var result = {
        periodNum: 1,
        periodScope: 'd'
    };

    // Parse `options.period`.
    if (options.period) {
        // <number><scope> where scope is:
        //    h   hours (at the start of the hour)
        //    d   days (at the start of the day, i.e. just after midnight)
        //    w   weeks (at the start of Sunday)
        //    m   months (on the first of the month)
        //    y   years (at the start of Jan 1st)
        // with special values 'hourly' (1h), 'daily' (1d), "weekly" (1w),
        // 'monthly' (1m) and 'yearly' (1y)
        var period = {
            'hourly': '1h',
            'daily': '1d',
            'weekly': '1w',
            'monthly': '1m',
            'yearly': '1y'
        }[options.period] || options.period;
        var m = /^([1-9][0-9]*)([hdwmy]|ms)$/.exec(period);
        if (!m) {
            throw new Error(format('invalid period: "%s"', options.period));
        }

        result.periodNum = Number(m[1]);
        result.periodScope = m[2];
    }

    return result;
}


function PeriodRotateTrigger(options) {
    var self = this;

    var periodNum = 1;
    var periodScope = 'd';

    var rotAt = null;
    var timeout = null;


    function setupNextRot() {
        if (!rotAt || rotAt <= Date.now()) {
            rotAt = nextRotTime(rotAt, periodScope, periodNum);
        }

        var delay = rotAt - Date.now();

        // Cap timeout to Node's max setTimeout, see
        // <https://github.com/joyent/node/issues/8656>.
        var TIMEOUT_MAX = 2147483647; // 2^31-1
        if (delay > TIMEOUT_MAX) {
            delay = TIMEOUT_MAX;
        }

        timeout = setTimeout(function () {
            // If rotation period is > ~25 days, we have to break into multiple
            // setTimeout's. See <https://github.com/joyent/node/issues/8656>.
            if (rotAt && rotAt > Date.now()) {
                return setupNextRot();
            } else {
                self.emit('rotate');
            }
        }, delay);

        if (typeof (timeout.unref) === 'function') {
            timeout.unref();
        }
    }

    function shutdown() {
        clearTimeout(timeout);
        timeout = null;
    }

    function reset() {
        clearTimeout(timeout);
        setupNextRot();
    }

    function check() {
        // Do nothing
    }

    var parsed = parseOptions(options);
    periodScope = parsed.periodScope;
    periodNum = parsed.periodNum;

    setupNextRot();

    this.reset = reset;
    this.check = check;
    this.shutdown = shutdown;
};

util.inherits(PeriodRotateTrigger, EventEmitter);

module.exports = PeriodRotateTrigger;

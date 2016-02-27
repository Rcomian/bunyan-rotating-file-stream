'use strict';

var _DEBUG = false;

var assert = require('assert');

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
        assert.fail('invalid period scope: "' + periodScope + '"');
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

module.exports = nextRotTime;

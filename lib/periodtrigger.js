// Just emits "rotate" events at the right time.
// Does not know about a rotating file stream.
'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var optionParser = require('./optionParser');
var nextRotTime = require('./nextrotationtime');

var _DEBUG = false;

function PeriodRotateTrigger(options) {
    var base = new EventEmitter;

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
                base.emit('rotate');
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

    var parsed = optionParser.parsePeriod(options.period);
    periodScope = parsed.periodScope;
    periodNum = parsed.periodNum;

    setupNextRot();

    return _.extend({}, {reset, check, shutdown}, base);
};

module.exports = PeriodRotateTrigger;

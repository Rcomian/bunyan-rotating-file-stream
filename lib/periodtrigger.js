// Just emits "rotate" events at the right time.
// Does not know about a rotating file stream.
'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var optionParser = require('./optionParser');
var nextRotTime = require('./nextrotationtime');

var setLongTimeout = require('./setlongtimeout');

var _DEBUG = false;

function PeriodRotateTrigger(options) {
    var base = new EventEmitter;

    var periodNum = 1;
    var periodScope = 'd';

    var rotAt = null;
    var timeout = null;


    function setupNextRotation() {
        // Only step the rotation time forward if the rotation time is passed
        if (rotAt <= Date.now()) {
            rotAt = nextRotTime(rotAt, periodScope, periodNum);
        }

        timeout = setLongTimeout(rotAt, false, function () {
            timeout = null;
            base.emit('rotate', {date: rotAt});
        });
    }

    function shutdown() {
        if (timeout) {
            timeout.clear();
        }
        timeout = null;
    }

    function newFile() {
        if (timeout) {
            timeout.clear();
        }
        setupNextRotation();
    }

    function logWrite() {
        // Do nothing
    }

    var parsed = optionParser.parsePeriod(options.period);
    periodScope = parsed.periodScope;
    periodNum = parsed.periodNum;

    setupNextRotation();

    return _.extend({}, {
        newFile: newFile,
        logWrite: logWrite,
        shutdown: shutdown
    }, base);
};

module.exports = PeriodRotateTrigger;

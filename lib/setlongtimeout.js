'use strict';

// Nodejs has a limit on timers of ~25 days.
// Timers longer than this value need to be split into multiple
// timeouts.

// Parameters:
// triggerTime: Date to fire the trigger (eg, from Date.now())
// keepAlive: true to keep the nodejs program alive until this timer fires
// callback: The callback to fire at the given time
// maxTimeout: (for testing) use a value other than node's max sleep time
//             for the individual sleep period

// Note - this should be replaced with 'long-timeout' once it supports unref()

function setLongTimeout(triggerTime, keepAlive, callback, maxTimeout) {

    var timeout = null;
    var TIMEOUT_MAX = maxTimeout || 2147483647; // 2^31-1

    function doSleep() {
        var delay = triggerTime - Date.now();

        // Cap timeout to Node's max setTimeout, see
        // <https://github.com/joyent/node/issues/8656>.
        if (delay > TIMEOUT_MAX) {
            delay = TIMEOUT_MAX;
        }

        // If we were called with a datetime of now or in the past
        if (delay <= 0) {
            callback();
            return;
        }

        timeout = setTimeout(function () {
            timeout = null;

            // If teimer period is > ~25 days, we have to break into multiple
            // setTimeout's. See <https://github.com/joyent/node/issues/8656>.
            if (triggerTime && triggerTime > Date.now()) {
                doSleep();
            } else {
                callback();
            }
        }, delay);

        if (!keepAlive && typeof (timeout.unref) === 'function') {
            timeout.unref();
        }
    }

    function clear() {
        if (timeout) {
            clearTimeout(timeout);
        }
    }

    doSleep();

    return { clear: clear };
}

module.exports = setLongTimeout;

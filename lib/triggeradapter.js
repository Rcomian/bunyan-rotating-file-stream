'use strict';

// This module knows how to wire together a
// rotating file stream and a rotation trigger

function TriggerAdapter(trigger, rfs) {
    var onRotate = function () {
        rfs.rotate();
    };

    var onNewFile = function (data) {
        trigger.newFile(data);
    };

    var onLogWrite = function (data) {
        trigger.logWrite(data);
    };

    var onShutdown = function () {
        trigger.shutdown();

        trigger.removeListener('rotate', onRotate);
        rfs.removeListener('newfile', onNewFile);
        rfs.removeListener('logwrite', onLogWrite);
        rfs.removeListener('shutdown', onShutdown);
    }

    trigger.on('rotate', onRotate);

    rfs.on('newfile', onNewFile);
    rfs.on('logwrite', onLogWrite);
    rfs.on('shutdown', onShutdown);

    return { onShutdown };
}

module.exports = TriggerAdapter;

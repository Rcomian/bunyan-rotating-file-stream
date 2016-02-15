// This module knows how to wire together a
// rotating file stream and a rotation trigger

function TriggerAdapter(trigger, rfs) {
    var onRotate = function () {
        rfs.rotate();
    };

    var onNewFile = function (data) {
        trigger.reset(data);
    };

    var onData = function (data) {
        trigger.check(data);
    };

    var onShutdown = function () {
        trigger.shutdown();

        trigger.removeListener('rotate', onRotate);
        rfs.removeListener('newfile', onNewFile);
        rfs.removeListener('data', onData);
        rfs.removeListener('shutdown', onShutdown);
    }

    trigger.on('rotate', onRotate);

    rfs.on('newfile', onNewFile);
    rfs.on('data', onData);
    rfs.on('shutdown', onShutdown);
}

module.exports = TriggerAdapter;

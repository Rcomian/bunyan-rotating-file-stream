Bunyan is **a simple and fast JSON logging library** for node.js services:
Bunyan Rotating File Stream is a rotating file stream component that has some extra features

```js
    var log = bunyan.createLogger({
        name: 'foo',
        streams: [{
            stream: new RotatingFileStream({
                path: '/var/log/foo.log',
                period: '1d',          // daily rotation
                totalFiles: 10,        // keep up to 10 back copies
                rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
                threshold: '10m',      // Rotate log files larger than 10 megabytes
                totalSize: '20m',      // Don't keep more than 20mb of archived log files
                gzip: true             // Compress the archive log files to save space
            })
        }]
    });
```

# Recent changes

## 1.3

It's a very common programming error to accidentally create 2 rotating file streams against the same log file.
By default, we detect and disallow this option, throwing an exception as it normally means that a mistake has been made.
If, however, you really want to be able to do this, we can cache the file streams and return the original one
each time. To do this add `shared: true` to the list of options when creating each file stream.

Either way, it is now not possible to create 2 rotating file streams against the same file.

## 1.2

- Support non-raw streams. For some reason, raw streams are MUCH faster in high load scenarios (at least when this is the only stream).
- Better guarantees over file rollover - we will write exactly one log record that goes over the size threshold before we rotate
  The previous performance release meant that we couldn't rotate until the write had completed to the disk - in the meantime several other
  logs could have been written. This made everything unpredictable.
- Making better use of the cargo datatype to write multiple log records in a single event loop tick.
- Using setImmediate rather than process.nextTick in the write loop to allow io and other operations time to happen rather than hog the event loop.
- Other refactorings and minor bug fixes.

# Current Status

The basics of the features are there, you should be able to use the
rotating file logging to limit disk space usage while maximising
the amount of logs kept.

As ever, there's a lot more features to add as well as a number of
gaurantees to make.

# Installation

```sh
npm install bunyan-rotating-file-stream
```

# Features

- Rotate to a new log file periodically (can also rotate on startup to clean old log files)
- Rotate to a new log file once the main log file goes over a certain size
- Keep a maximum number of archival log files
- Delete older log files once the archive reaches a certain size
- GZip archived log files
- Supports being a raw stream or a normal stream


## stream type: `rotating-file`

**WARNING on node 0.8 usage:** Users should use at
least node 0.10 (node 0.8 does not support the `unref()` method on
`setTimeout(...)`). The symptom is that process
termination will hang for up to a full rotation period if period rotation is used.
You can manually keep hold of the logger and call "shutdown" to prevent this.

**WARNING on [cluster](http://nodejs.org/docs/latest/api/all.html#all_cluster)
usage:** Using `bunyan-rotating-file-stream` with node.js's "cluster" module
can result in unexpected file rotation. You must not have multiple processes
in the cluster logging to the same file path. In other words, you must have
a separate log file path for the master and each worker in the cluster.
Alternatively, consider using a system file rotation facility such as
`logrotate` on Linux or `logadm` on SmartOS/Illumos. See
[this comment on issue #117](https://github.com/trentm/node-bunyan/issues/117#issuecomment-44804938)
for details.

Add this stream directly to the bunyan logger.
The logger supports being both a raw and normal stream modes. Raw streams can be faster
under some high-load scenarios but may serialize the json differently to bunyan.

```js
    var log = bunyan.createLogger({
        name: 'foo',
        streams: [{
            stream: new RotatingFileStream({
                path: '/var/log/foo.log',
                period: '1d',          // daily rotation
                totalFiles: 10,        // keep 10 back copies
                rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
                threshold: '10m',       // Rotate log files larger than 10 megabytes
                totalSize: '20m',       // Don't keep more than 20mb of archived log files
                gzip: true             // Compress the archive log files to save space
            })
        }]
    });
```

This will rotate '/var/log/foo.log' every day (at midnight) to:

```sh
/var/log/foo.log.1     # yesterday
/var/log/foo.log.2     # 1 day ago
/var/log/foo.log.3     # 2 days ago
```

*Currently*, there is no support for providing a template for the rotated
file names.

<table>
<tr>
<th>Field</th>
<th>Required?</th>
<th>Default</th>
<th>Description</th>
</tr>
<td>path</td>
<td>Yes</td>
<td>-</td>
<td>A file path to which to log. Rotated files will be "$path.0",
"$path.1", ...</td>
</tr>
<tr>
<td>period</td>
<td>No</td>
<td>1d</td>
<td>The period at which to rotate. This is a string of the format
"$number$scope" where "$scope" is one of "ms" (milliseconds -- only useful for
testing), "h" (hours), "d" (days), "w" (weeks), "m" (months), "y" (years). Or
one of the following names can be used "hourly" (means 1h), "daily" (1d),
"weekly" (1w), "monthly" (1m), "yearly" (1y). Rotation is done at the start of
the scope: top of the hour (h), midnight (d), start of Sunday (w), start of the
1st of the month (m), start of Jan 1st (y).</td>
</tr>
<tr>
<td>rotateExisting</td>
<td>No</td>
<td>false</td>
<td>If period is also set, will rotate an existing log file when the process
starts up if that file needs rotating due to its age. This means that
if you want a new file every day, and the process isn't running over midnight,
this option will give you that new file when you next startup.</td>
</tr>
<tr>
<td>threshold</td>
<td>No</td>
<td>0</td>
<td>The maximum size for a log file to reach before it's rotated.
Can be specified as a number of bytes, or a more friendly units:
eg, '100k', '1m', '2g' etc.</td>
</tr>
<tr>
<td>totalFiles</td>
<td>No</td>
<td>0</td>
<td>The maximum number of rotated files to keep. 0 to keep files regardless of how many there are.</td>
</tr>
<td>totalSize</td>
<td>No</td>
<td>0</td>
<td>The maximum storage to allow for the rotated files. Older files are deleted to keep within this size.
0 here keeps files regardless of how large they get.
Can be specified as a number of bytes, or a more friendly unit:
eg, '100k', '1m', '2g' etc.</td>
</tr>
<tr>
<td>gzip</td>
<td>No</td>
<td>false</td>
<td>Compress rotated files using gzip. Adds a '.gz' extension.</td>
</tr>
</table>


**Note on log rotation**: Often you may be using external log rotation utilities
like `logrotate` on Linux or `logadm` on SmartOS/Illumos. In those cases, unless
your are ensuring "copy and truncate" semantics (via `copytruncate` with
logrotate or `-c` with logadm) then the fd for your 'file' stream will change.
You can tell bunyan to reopen the file stream with code like this in your
app:

```js
var log = bunyan.createLogger(...);
...
process.on('SIGUSR2', function () {
    log.reopenFileStreams();
});
```

where you'd configure your log rotation to send SIGUSR2 (or some other signal)
to your process. Any other mechanism to signal your app to run
`log.reopenFileStreams()` would work as well.


The scheme I follow is most succinctly described by the bootstrap guys
[here](https://github.com/twitter/bootstrap#versioning).

tl;dr: All versions are `<major>.<minor>.<patch>` which will be incremented for
breaking backward compat and major reworks, new features without breaking
change, and bug fixes, respectively.

# License

MIT. See "LICENSE.txt".

# See Also

- Bunyan: <https://github.com/trentm/node-bunyan>.

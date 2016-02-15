Bunyan is **a simple and fast JSON logging library** for node.js services:
Bunyan Rotating File Stream is an improved rotating file stream component that has some extra features

```js
    new RotatingFileStream({
        path: '/var/log/foo.log',
        period: '1d',   // daily rotation
        totalFiles: 3   // keep at most 3 back copies
    });
```


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

- Rotate to a new log file periodically
- Rotate to a new log file once the main log file goes over a certain size
- Keep a maximum number of archival log files
- Delete older log files once the archive reaches a certain size
- GZip archived log files


## stream type: `rotating-file`

**WARNING on node 0.8 usage:** Users of Bunyan's `rotating-file` should (a) be
using at least bunyan 0.23.1 (with the fix for [this
issue](https://github.com/trentm/node-bunyan/pull/97)), and (b) should use at
least node 0.10 (node 0.8 does not support the `unref()` method on
`setTimeout(...)` needed for the mentioned fix). The symptom is that process
termination will hang for up to a full rotation period.

**WARNING on [cluster](http://nodejs.org/docs/latest/api/all.html#all_cluster)
usage:** Using Bunyan's `rotating-file` stream with node.js's "cluster" module
can result in unexpected file rotation. You must not have multiple processes
in the cluster logging to the same file path. In other words, you must have
a separate log file path for the master and each worker in the cluster.
Alternatively, consider using a system file rotation facility such as
`logrotate` on Linux or `logadm` on SmartOS/Illumos. See
[this comment on issue #117](https://github.com/trentm/node-bunyan/issues/117#issuecomment-44804938)
for details.

A `type === 'raw'` is a file stream that handles file automatic
rotation.

```js
var log = bunyan.createLogger({
    name: 'foo',
    streams: [{
        type: 'raw',
        stream: new RotatingFileStream({
            path: '/var/log/foo.log',
            period: '1d',   // daily rotation
            totalFiles: 3        // keep 3 back copies
        })
    }]
});
```

This will rotate '/var/log/foo.log' every day (at midnight) to:

```sh
/var/log/foo.log.0     # yesterday
/var/log/foo.log.1     # 1 day ago
/var/log/foo.log.2     # 2 days ago
```

*Currently*, there is no support for providing a template for the rotated
files.

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
<td>threshold</td>
<td>No</td>
<td>0</td>
<td>The maximum size for a log file to reach before it's rotated.
Can be specified as a number of bytes, or a more friendly unit:
eg, '100k', '1m', '2g' etc.</td>
</tr>
<tr>
<td>totalFiles</td>
<td>No</td>
<td>0</td>
<td>The number of rotated files to keep. 0 to keep files regardless of how many there are.</td>
</tr>
<td>totalSize</td>
<td>No</td>
<td>0</td>
<td>Delete older rotated files once the total size of rotated files reaches this size.
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

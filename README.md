Bunyan Rotating File Stream is a stream component for the logging system "node bunyan" that provides rich and flexible control over your log files.

[![Join the chat at https://gitter.im/Rcomian/bunyan-rotating-file-stream](https://badges.gitter.im/Rcomian/bunyan-rotating-file-stream.svg)](https://gitter.im/Rcomian/bunyan-rotating-file-stream?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

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

## 1.6.3 Type definition file for Typescript

Generously provided by: scippio

## 1.6.2 Fixed support for the "rotateExisting" flag

Tests have been added to ensure that this feature keeps working in the future.
Note that this feature may not work as expected with linux on EXT4.

## 1.6 Support for non-JSON logs

Minor release but now that logs which are written in a non-json format are supported.

## 1.5 Templates Release

We now have the ability to specify templates in the log's filename. For full details see the templating section, but briefly: we can template where you put the number when rotating files (this allows you to preserve the extension so that the files open in the correct viewer), or give your log filename a timestamp in your preferred format.
All previous features are maintained and you should be able to use your existing configuration without change.

Integration testing is still rudimentary in terms of technology, but the coverage has been massively improved, checking that no logs have been re-ordered or lost.


# Compatibility

Implemented tests and strategies to support specific node versions:

* 0.12.*latest*
* 4.*latest*
* 6.*latest*
* 7.*latest*

*0.10 and earlier*

Not supported as it is missing a lot of useful path processing features. Whilst we could patch this with inline code and npm packages, I think it's a shame to have these hanging around when the functionality will be built into all future versions of node.

*0.12*

Is supported, but it's performance cannot keep up with the latest versions of node. I've had to reduce the stress involved when running tests to allow old `0.12` to keep up.

*5*

Is supported, but won't be stress tested as those resources are being used for the LTS releases 0.12, 4 & 6.


# Current Status

The basics of the features are there, you should be able to use the
rotating file logging to limit disk space usage while maximising
the amount of logs kept.

There are a few extra features to add to the system, but in general it needs stabilisation, code cleanup and bug fixing.

We can now regularly run feature tests against all supported versions of node.


# Planned Future Features

* Prevent multiple processes logging to the same file
* Allow multiple processes to safely log to the same file
* Allow you to say where to put the number in date formatted file names

# Installation

```sh
npm install bunyan-rotating-file-stream
```

# Main Features

- Name log files with templates
- Rotate to a new log file periodically (can also rotate on startup to clean old log files)
- Rotate to a new log file once the main log file goes over a certain size
- Keep a maximum number of archival log files
- Delete older log files once the archive reaches a certain size
- GZip archived log files
- Supports being a raw stream or a normal stream


## How to use

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
The stream supports being both a raw and normal stream modes. Raw streams can be faster
under some high-load scenarios but may serialize the json differently to bunyan.

```js
    var bunyan = require('bunyan');
    var RotatingFileStream = require('bunyan-rotating-file-stream');

    var log = bunyan.createLogger({
        name: 'foo',
        streams: [{
            type: 'raw',
            stream: new RotatingFileStream({
                path: '/var/log/foo.log',
                period: '1d',          // daily rotation
                totalFiles: 10,        // keep 10 back copies
                rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
                threshold: '10m',      // Rotate log files larger than 10 megabytes
                totalSize: '20m',      // Don't keep more than 20mb of archived log files
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

<table>
<tr>
<th>Field</th>
<th>Required?</th>
<th>Default</th>
<th>Description</th>
</tr>
<tr>
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
this option will give you that new file when you next startup.

See note on EXT4.
</td>
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
<tr>
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
<tr>
<td>fieldOrder</td>
<td>No</td>
<td></td>
<td><p>An array of string that specify the order the log parameters are written to the file.</p>

<p>This option allows certain keys in the log fields to be written first for each log entry in the file.
For example, if you use the value ['time'], the timestamp will appear on the left of each row.
This doesn't affect how programs read each log record if they just JSON.parse each line at a time, it's
purely for visual browsing when you scan through the text file.
For this to work, the stream must be set to "raw" mode. You can't use this option without that setting.
This option has a measurable performance impact as it's copying each log entry object, so be aware if you're
using this in heavily loaded systems.</p>

<p>*note* This feature currently works using an undocumented and un-guaranteed side effect of how serialisation
works. It may break for a time on new versions of node if the internals of serialisation change how things work.
In that case, the replacement code will likely be even slower.</p>
</td>
</tr>
<tr>
<td>startNewFile</td>
<td>No</td>
<td>false</td>
<td>
<p>By default the file stream will open the most recent log file it can find and append to it. This flag will
force the stream to create a new file instead.</p>
</td>
</tr>
</table>

## rotateExisting and Linux filesystems (EXT4) support

Some filesystems on Linux (in particular EXT4) do not record the file creation date.

Since the rotateExisting requires us to look at this date to see if the file would have been rotated had the
system been running for all that time, this feature cannot work as required.

You can check if this feature will work on your filesystem by executing `stat [mylogfile]`. If the "Birth" field
has a value in it, rfs will be able to see the creation time correctly.

Otherwise behaviour of this flag will be based on what birthtime is filled with. If it returns 0, then the file
will always be rotated. If it returns ctime, it will only be rotated if the rotation period has expired since the
last write.

# Templating

## Behaviour without templating

By default, if you just give a normal filename for your log, it will be rotated by appending a number to the end of the file.

For example, if you log to a file `webapi.log`, you'll have the following in your log directory:

```
    webapi.log  // log file having logs written to it.
```

When the file needs to be rotated, we'll rename the existing file to `webapi.log.1` and create a new empty file `webapi.log`. Giving you:

```
    webapi.log   // new log file, logs will be written here.
    webapi.log.1 // old log file, for archival only.
```

When we rotate again, we rename the `.1` file to `.2`, the log file to `.1` and create another file, giving us:

```
    webapi.log   // new log file, logs will be written here.
    webapi.log.1 // archive of the previously active log file.
    webapi.log.2 // oldest log file containing oldest entries.
```

As you can see, the extension of the log files is effectively changed to a number, making it lose its association with any tool that you use to open log files and look at them.

## Rotation number templating [%N]

We can tell the system where to insert the rotation number in the filename. To do this, use the `%N` template parameter (uppercase N). This parameter can only appear in the filename, not in the directories or the extension.

If you use the parameter to make `webapi.%N.log`, after the 2 rotations as above, we end up with:

```
    webapi.log   // the log file receiving new logs.
    webapi.1.log // archive of the previously active log file.
    webapi.2.log // oldest log file containing oldest entries.
```

Notice that the %N has been stripped out of the name for the active log file - we have no number so we have nothing to put there. If the preceding character is `'.', '_' or '-'`, then that will be stripped out too.

This preserves both the numbering system of the archived files and their extension, so we can open them with the correct tool when we click on them.

## Datetime templating [%Y %m %d %H %M %S]

We can also insert the current time into the log file name. This is the time that the log file was created and should contain logs from that time onwards (notice: this is a hint, not a guarantee: there may be some stragglers from the previous file).

When we do this, we no-longer do any renaming when we rotate to a new log file - we simply create a new file with a new timestamp and use that.

The filename is formatted using <https://www.npmjs.com/package/strftime> and so supports any of the format strings they allow.
The template parameters must be in the main body of the filename and cannot be in the extension (after the last dot in the name) or in the directories leading up to it.

As an example, we can use the a log name for our system like: `webapi.%d-%b-%y.log`. If we then rotated twice, on separate days, we'd end up with the following files:

```
    webapi.28-Feb-16.log // Oldest file containing the oldest logs
    webapi.29-Feb-16.log
    webapi.01-Mar-16.log // Current file receiving logs
```

### Filename clashes

The file stream makes no requirement that your filename be particularly unique or sort sensibly in any way. If in the previous example, we rotated twice on the same day, we'd differentiate the files by adding a number like this:

```
    webapi.28-Feb-16.log   // Original file containing the oldest logs
    webapi.28-Feb-16.1.log
    webapi.28-Feb-16.2.log // Current file receiving logs
```

As with rotating number templating, you can specify where this differentiating number goes using %N.

### Deleting old files

When deleting files based on how many archive files we want to keep, or how much space we want to give to log archives, we delete the oldest files based on the modified time of that file.

When we look for files to delete, we look at all the files in the directory that:

* Match up to the first % sign in the filename template
* Have the same extension (excluding the .gz if you are compressing old files)

Any files matching those criteria are considered part of the logging system and will be deleted based on the normal deletion rules.

# Creating new files on startup

When we startup we look for any existing log files to append to. If we find a viable file, we simply open it and start appending logs to it. This is the behaviour for all files, whether templated or not.

## Rotating old files [{rotateExisting: true}]
If an old file should have been rotated but your process wasn't running at the time (maybe you choose to have a new file every day, but the process wasn't running at midnight), we will still append to it. Force a rotation on old files using the option: `{rotateExisting: true}`. This will only rotate files that would have been rotated had we stayed running. This option works for templated or non-templated files.


**Note 1: Timestamp in filename**: If your log files have a timestamp in the filename, the timestamp will match when the file would have last rotated, not the current time.

**Note 2: Size thresholds**: If a file would be rotated because of a change in threshold size between runs, then that rotation will happen on the first log write as normal regardless of any flags that are set.

## Force new files [{startNewFile: true}]
Instead of appending logs to an existing file, you can force a new file to be created using the option: `{startNewFile: true}`.
If the file date stamp clashes with an existing file, the dotted number notation will be used as normal.


# Versioning

The scheme I follow is most succinctly described by the bootstrap guys
[here](https://github.com/twitter/bootstrap#versioning).

tl;dr: All versions are `<major>.<minor>.<patch>` which will be incremented for
breaking backward compat and major reworks, new features without breaking
change, and bug fixes, respectively.

# License

MIT. See "LICENSE.txt".

# See Also

- Bunyan: <https://github.com/trentm/node-bunyan>.

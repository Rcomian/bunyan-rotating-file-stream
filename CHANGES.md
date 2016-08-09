# bunyan Changelog

## 1.6.1

- Copying the options object given from the caller as it may be immutable and we like to change things, set defaults, etc.

## 1.6.0

- Support writing logs that aren't in bunyan's normal JSON format. Or JSON at all.
- Officially moved tests to node 6

## 1.5.4

- Checked with node v6 and updated support notes on the README.

## 1.5.3

- Fixed issue with handling template filenames containing dots: #4

- Can handle this.%Y.log as well as this.%N-%Y.log, which both failed before, when using gzip.

## 1.5.2

- Expanded node version compatibility and making a statement about which versions of node we offically support- `0.12.9`, `0.12.latest`, `4.latest`, `5.latest`.

- Full passing test suites running against each version using `nvm`.

- Stress test in place, needs tuning.

## 1.5.1

- Fixed an issue with gzipped files not being deleted when using datestamps
- Fixed an issue with gzipped files not being rotated correctly when continuing an existing log file

## 1.5.0 Templates Release

We now have the ability to specify templates in the log's filename. For full details see the templating section, but briefly: we can template where you put the number when rotating files (this allows you to preserve the extension so that the files open in the correct viewer), or give your log filename a timestamp in your preferred format.
All previous features are maintained and you should be able to use your existing configuration without change.

Integration testing is still rudimentary in terms of technology, but the coverage has been massively improved, checking that no logs have been re-ordered or lost.

## 1.4.0
- New feature to allow the user to specify the order the fields of the log records are written to the log file, this can make manual browsing of the files easier if you put the timestamp and other relevant information first.
- Some clean ups and refactorings to try to remove some flags.

## 1.3.1

- Fix bug: If we started rotating files in the middle of a write batch, the remaining logs in the batch would be reversed.
- Start rotating if a log record would breach a threshold rather than rotate after threshold reached.

## 1.3.0

- It appears to be a very common problem that multiple rotating file streams are created against the same file. This version should resolve this issue when done within the same process by caching and returning the first rotating stream created.

## 1.2.1

- Catching write errors and emitting them
- Ensuring a stream is closed before finishing a join (internal testing method)
- Handling events in the underlying stream

## 1.2.0

- Support non-raw streams. For some reason, raw streams are MUCH faster in high load scenarios (at least when this is the only stream).
- Better guarantees over file rollover - we will write exactly one log record that goes over the size threshold before we rotate
  The previous performance release meant that we couldn't rotate until the write had completed to the disk - in the meantime several other
  logs could have been written. This made everything unpredictable.
- Making better use of the cargo datatype to write multiple log records in a single event loop tick.
- Using setImmediate rather than process.nextTick in the write loop to allow io and other operations time to happen rather than hog the event loop.

## 1.1.1

- Being far more aggressive when writing logs in order to improve log writing speed
- Basic performance test that writes 1million logs

## 1.1.0

- Adding ability to rotate existing log files when we open them up with the "rotateExisting" feature.

## 1.0.6

- Fixing special values (eg, 'hourly') for period rollover. These were broken in v1.0.5

## 1.0.5

- Restructured project
- Moved to a properly named git repository with only this project's history in it
- Added basic tests to excercise everything and make sure nothing is broken

## 1.0.4

- Correcting github location

## 1.0.3

- Docs changes

## 1.0.2

- Getting the right filepath to import from package.json

## 1.0.1

- Minor docs update

## 1.0.0 (First release)

- First release

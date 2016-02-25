# bunyan Changelog

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

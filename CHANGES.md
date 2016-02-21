# bunyan Changelog

## Next

- Long periods support refactored into its own component.

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

declare class RotatingFileStream {
    constructor(options: RotatingFileStream.options);
}

declare namespace RotatingFileStream {
    interface options {
        /**
         * A file path to which to log. Rotated files will be "$path.0", "$path.1", ...
         */
        path: string
        /**
         * The period at which to rotate. This is a string of the format "$number$scope" where 
         * "$scope" is one of "ms" (milliseconds -- only useful for testing), "h" (hours), "d" (days), 
         * "w" (weeks), "m" (months), "y" (years). Or one of the following names can be used "hourly" 
         * (means 1h), "daily" (1d), "weekly" (1w), "monthly" (1m), "yearly" (1y). Rotation is done at the 
         * start of the scope: top of the hour (h), midnight (d), start of Sunday (w), start of 
         * the 1st of the month (m), start of Jan 1st (y).
         */
        period?: string
        /**
         * If period is also set, will rotate an existing log file when the process starts up if 
         * that file needs rotating due to its age. This means that if you want a new file 
         * every day, and the process isn't running over midnight, this option will give you 
         * that new file when you next startup.
         * See note on EXT4.
         */
        rotateExisting?: boolean
        /**
         * The maximum size for a log file to reach before it's rotated. Can be specified as a number 
         * of bytes, or a more friendly units: eg, '100k', '1m', '2g' etc.
         */
        threshold?: string | number
        /**
         * 	The maximum number of rotated files to keep. 0 to keep files regardless of how many there are.
         */
        totalFiles?: number
        /**
         * The maximum storage to allow for the rotated files. Older files are deleted to keep within 
         * this size. 0 here keeps files regardless of how large they get. Can be specified 
         * as a number of bytes, or a more friendly unit: eg, '100k', '1m', '2g' etc.
         */
        totalSize?: string | number
        /**
         * Compress rotated files using gzip. Adds a '.gz' extension.
         */
        gzip?: boolean
        /**
         * An array of string that specify the order the log parameters are written to the file. 
         * This option allows certain keys in the log fields to be written first for each log 
         * entry in the file. For example, if you use the value ['time'], the timestamp will 
         * appear on the left of each row. This doesn't affect how programs read each log record 
         * if they just JSON.parse each line at a time, it's purely for visual browsing when you 
         * scan through the text file. For this to work, the stream must be set to "raw" mode. 
         * You can't use this option without that setting. This option has a measurable performance 
         * impact as it's copying each log entry object, so be aware if you're using this in heavily 
         * loaded systems.
         * 
         * *note* This feature currently works using an undocumented and un-guaranteed side effect 
         * of how serialisation works. It may break for a time on new versions of node if the internals 
         * of serialisation change how things work. In that case, the replacement code will likely be 
         * even slower.
         */
        fieldOrder?: string[]
        /**
         * By default the file stream will open the most recent log file it can find and append to it. 
         * This flag will force the stream to create a new file instead.
         */
        startNewFile?: boolean
    }
}

export = RotatingFileStream

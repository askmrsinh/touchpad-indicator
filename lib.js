/*
 * Copyright 2011-2013 Armin Köhler <orangeshirt at web.de>
 *
 * Thanks to Lorenzo Carbonell Cerezo and Miguel Angel Santamaría Rogado
 * which has written touchpad-indicator
 * (https://launchpad.net/touchpad-indicator) as python app and inspired
 * myself to write this extension for gnome-shell.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program; if not, write to:
 * The Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor
 * Boston, MA 02110-1301, USA.
 */


const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Gettext = imports.gettext.domain('touchpad-indicator@orangeshirt');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();


const StoragePath = '.local/share/gnome-shell/extensions/'+
                        Me.metadata.uuid.toString();
GLib.mkdir_with_parents(StoragePath, parseInt('0775', 8));

// Debug Mode Settings
var DEBUG = false; // overwritten by settings
const FORCE_DEBUG = false;
var DEBUG_TO_FILE = false; // overwritten by settings
var DEBUG_INFO = 'Extension '+ Me.metadata.name.toString() +': ';
var DEBUG_LOG_FILE = GLib.build_filenamev([StoragePath,
   'touchpad-indicator.log']);
if (GLib.file_test(DEBUG_LOG_FILE, GLib.FileTest.EXISTS) === false)
    GLib.file_set_contents(DEBUG_LOG_FILE, "");
    

let LOGS = "";

// Possible Devices
const TOUCHPADS = new Array('touchpad','glidepoint','fingersensingpad',
                            'bcm5974','trackpad','smartpad');
var ALL_TOUCHPADS = TOUCHPADS.slice();
const TRACKPOINTS = new Array('trackpoint','accu point','trackstick',
                              'touchstyk','pointing stick','dualpoint stick');
const FINGER_TOUCHES = Array('finger touch');
const TOUCHSCREENS = Array('touchscreen', 'maxtouch');
const PENS = Array('pen stylus', 'pen eraser');
const OTHERS = new Array();
var ALL_OTHERS = OTHERS.slice();

// Methods to en- or disable the touchpad
const METHOD = {
    GCONF: 0,
    SYNCLIENT: 1,
    XINPUT: 2
};

// Settings
const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.touchpad-indicator';
const TOUCHPAD_SETTINGS_SCHEMA =
    'org.gnome.desktop.peripherals.touchpad';


function get_logs() {
    let logtxt;
    try {
        logtxt = GLib.file_get_contents(DEBUG_LOG_FILE)[1].toString();
    } catch (err) {
        logtxt = _("Sorry could not read logfile!\n") + err;
    }
    return logtxt;
}

function logging(message, debug, debug_to_file) {
    if (debug === undefined) {
        debug = DEBUG;
    } else {
        DEBUG = debug;
    }
    if (debug_to_file === undefined) {
        debug_to_file = DEBUG_TO_FILE;
    } else {
        DEBUG_TO_FILE = debug_to_file;
    }
    if (debug || FORCE_DEBUG) {
        let timestamp = format_time(new Date(new Date().getTime()));
        message = timestamp + "    " + message + "\n";
        global.log(DEBUG_INFO + message);
        if (debug_to_file) {
            let file = get_logs();
            let txt = file + message;
            GLib.file_set_contents(DEBUG_LOG_FILE, txt);
        }
    }
};

function format_time(d) {
    function pad(n) { return n < 10 ? '0' + n : n; }
    return d.getUTCFullYear()+'-'
        + pad(d.getUTCMonth()+1)+'-'
        + pad(d.getUTCDate())+'T'
        + pad(d.getUTCHours())+':'
        + pad(d.getUTCMinutes())+':'
        + pad(d.getUTCSeconds())+'Z';
};

function execute_sync(command) {
    try {
        return GLib.spawn_command_line_sync(command);
    } catch (err) {
        logging(err.message.toString());
        return false;
    }
};

function execute_async(command) {
    try {
        return GLib.spawn_command_line_async(command);
    } catch (err) {
        logging(err.message.toString());
        return false;
    }
};

function list_mouse_devices() {
    logging('Lib.list_mouse_devices()');
    let comp = execute_sync('cat /proc/bus/input/devices');
    if (comp) {
        let where = comp[1].toString().split("\n\n"),
            mouses = new Array(),
            name,
            hits = 0;
        for (let x = 0; x < where.length; x++) {
            if (!(where[x].indexOf('mouse') == -1)) {
                let data = where[x].toString().split("\n");
                for (let z = 0; z < data.length; z++) {
                    if (!(data[z].indexOf("N: Name=") == -1)) {
                        name = data[z].split("\"")[1];
                        logging('Lib.list_mouse_devices(): Device found: '
                            + name.toString());
                        mouses[hits] = name.toString();
                        hits++;
                    }
                }
            }
        }
        if (mouses[0]) {
            return [true, mouses];
        } else {
            logging('Lib.list_mouse_devices(): Could not detect a mouse device');
            return [false, _("    - No mouse device detected.") + "\n"];
        }
    }
    logging('Lib.list_mouse_devices(): Sorry "cat" has no output');
    return [false, _("    - No mouse device detected.") + "\n"];
};

function search_touchpads() {
    logging('Lib.search_touchpads()');
    var where = list_mouse_devices();
    if (where[0]) {
        where = where[1];
        let touchpads = "";
        let hits = 0;
        for (let x = 0; x < where.length; x++) {
            for (let tpd = 0; tpd < TOUCHPADS.length; tpd++) {
                if (!(where[x].toLowerCase().indexOf(
                        TOUCHPADS[tpd].toString()) == -1)) {
                    logging('Lib.search_touchpads(): Touchpad found: '
                        + where[x].toString());
                    if (hits > 0)
                        touchpads += " | ";
                    touchpads += where[x].toString();
                    hits++;
                }
            }
        }
        if (touchpads != "") {
            return [true, touchpads + "\n"];
        } else {
            logging('Lib.search_touchpads(): Could not detect a touchpad');
            return [false, _("No Touchpad detected.") + "\n"];
        }
    }
    logging('Lib.search_touchpads(): Sorry "cat" has no output');
    return [false, _("No Touchpad detected.") + "\n"];
};

function list_mouses(skip_excluded) {
    logging('Lib.list_mouses()');
    let where = list_mouse_devices(),
        mouses = new Array(false, []);
    logging('Lib.list_mouses(): ' + where.toString());
    if (where[0]) {
        where = where[1];
        let hits = 0;
        for (let x = 0; x < where.length; x++) {
            for (let tpd = 0; tpd < TOUCHPADS.length; tpd++) {
                if (!(where[x].toLowerCase().indexOf(
                        TOUCHPADS[tpd].toString()) == -1)) {
                    logging('Lib.list_mouses(): Touchpad found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            for (let tpt = 0; tpt < TRACKPOINTS.length; tpt++) {
                if (!(where[x].toLowerCase().indexOf(
                        TRACKPOINTS[tpt].toString()) == -1)) {
                    logging('Lib.list_mouses(): Trackpoint found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            for (let tch = 0; tch < TOUCHSCREENS.length; tch++) {
                if (!(where[x].toLowerCase().indexOf(
                        TOUCHSCREENS[tch].toString()) == -1)) {
                    logging('Lib.list_mouses(): Touchscreen found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            for (let tch = 0; tch < FINGER_TOUCHES.length; tch++) {
                if (!(where[x].toLowerCase().indexOf(
                        FINGER_TOUCHES[tch].toString()) == -1)) {
                    logging('Lib.list_mouses(): Fingertouch found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            for (let pen = 0; pen < PENS.length; pen++) {
                if (!(where[x].toLowerCase().indexOf(
                        PENS[pen].toString()) == -1)) {
                    logging('Lib.list_mouses(): Pen found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            if (skip_excluded) {
                for (let oth = 0; oth < ALL_OTHERS.length; oth++) {
                    if (!(where[x].toLowerCase().indexOf(
                            ALL_OTHERS[oth].toString()) == -1)) {
                        hits++;
                        logging('Lib.list_mouses(): Other device to ignore'
                            + ' found: '+ where[x].toString());
                        break;
                    }
                }
            }
            if (hits == 0) {
                logging('Lib.list_mouses(): Mouse found: '
                    + where[x].toString());
                mouses[0] = true;
                mouses[1][mouses[1].length] = where[x].toString();
            } else {
                hits = 0;
            }
        }
    }
    if (!mouses[0])
        logging('Lib.list_mouses(): Could not detect a mouse ');
    return mouses;
};

function watch_mouse() {
    let file = Gio.file_new_for_path("/dev/input")
    return file.monitor_directory(Gio.FileMonitorFlags.NONE, null);
};

function load_excluded_mouses(excluded_mouses) {
    ALL_OTHERS = OTHERS.slice();
    for(var key in excluded_mouses) {
        if (excluded_mouses[key])
            ALL_OTHERS[ALL_OTHERS.length] = key.toString().toLowerCase();
    }
    return ALL_OTHERS;
};

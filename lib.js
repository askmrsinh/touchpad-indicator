/* TouchpadIndicator - Touchpad management GNOME Shell Extension.
 * Orignal work Copyright (C) 2011-2013 Armin Köhler <orangeshirt at web.de>
 * Modifcations Copyright (C) 2019 Ashesh Singh <user501254 at gmail.com>
 *
 * This file is part of TouchpadIndicator, a fork of Armin Köhler's
 * 'gnome-shell-extension-touchpad-indicator' project which is licensed GPLv2.
 * Orignal source code is available at https://git.io/fjVec.
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


const { Gio, GLib } = imports.gi;
const ByteArray = imports.byteArray;

const Me = imports.misc.extensionUtils.getCurrentExtension();

// Settings
const SCHEMA_EXTENSION = 'org.gnome.shell.extensions.touchpad-indicator';
const SCHEMA_TOUCHPAD = 'org.gnome.desktop.peripherals.touchpad';

// Debug Mode Settings
const LOG_FILEPATH = GLib.build_filenamev([Me.path, 'touchpad-indicator.log']);
const LOG_PREFIX = `[${Me.uuid}] `;
var DEBUG = false;
var DEBUG_TO_FILE = false;

// Possible Devices
const TOUCHPADS = ['touchpad', 'glidepoint', 'fingersensingpad', 'bcm5974', 'trackpad', 'smartpad'];
const TRACKPOINTS = ['trackpoint', 'accu point', 'trackstick', 'touchstyk', 'pointing stick', 'dualpoint stick'];
const TOUCHSCREENS = ['touchscreen', 'maxtouch', 'touch digitizer', 'touch system'];
const FINGERTOUCHES = ['finger touch'];
const PENS = ['pen stylus', 'pen eraser'];
const OTHERS = [];
var ALL_TYPES = {
    'touchpad': TOUCHPADS,
    'trackpoint': TRACKPOINTS,
    'touchscreen': TOUCHSCREENS,
    'fingertouch': FINGERTOUCHES,
    'pen': PENS,
    'other': OTHERS
};
var ALL_TOUCHPADS = TOUCHPADS.slice();
var ALL_OTHERS = OTHERS.slice();

// Methods to enable or disable the touchpad
var METHOD = { GCONF: 0, SYNCLIENT: 1, XINPUT: 2 };


function createLogFile(filepath) {
    const PERMISSIONS_MODE = 0o755;
    let isSuccess = false;
    filepath = (filepath !== undefined) ? filepath : LOG_FILEPATH;
    try {
        let file = Gio.File.new_for_path(filepath);
        if (GLib.mkdir_with_parents(file.get_parent().get_path(), PERMISSIONS_MODE) === 0) {
            isSuccess = file.replace_contents('', null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null)[0];
        }
        return isSuccess;
    } catch (err) {
        let error = `Sorry could not create logfile!\n${err}`;
        return [isSuccess, error];
    }

}

function writeLog(filepath, contents) {
    filepath = (filepath !== undefined) ? filepath : LOG_FILEPATH;
    let isSuccess = false;
    try {
        isSuccess = GLib.file_set_contents(filepath, contents);
        return isSuccess;
    } catch (err) {
        let error = `Sorry could not write to logfile!\n${err}`;
        return [isSuccess, error];
    }
}

function readLog(filepath) {
    filepath = (filepath !== undefined) ? filepath : LOG_FILEPATH;
    let [isSuccess, contents] = [false, ''];
    try {
        [isSuccess, contents] = GLib.file_get_contents(filepath);
        return [isSuccess, ByteArray.toString(contents)];
    } catch (err) {
        let error = `Sorry could not read from logfile!\n${err}`;
        return [isSuccess, error];
    }
}

function logger(event, filepath) {
    // TODO: Fix log file exists check
    filepath = (filepath !== undefined) ? filepath : LOG_FILEPATH;
    let logFileExists = true;
    if (DEBUG_TO_FILE && !logFileExists) {
        createLogFile(filepath);
    }
    // TODO: More structured logging.
    let timestamp = new Date(new Date().getTime()).toISOString();
    let message = `${timestamp} ${event}`;
    global.log(LOG_PREFIX + message);
    if (DEBUG_TO_FILE && logFileExists) {
        let messages = readLog(filepath)[1] + message;
        writeLog(filepath, `${messages}\n`);
    }
}


function executeCmdAsync(command) {
    try {
        return GLib.spawn_command_line_async(command);
    } catch (err) {
        logger(err.message.toString());
        return false;
    }
}

function executeCmdSync(command) {
    let [isSuccess, stdOut] = [false, ''];
    try {
        [isSuccess, stdOut] = GLib.spawn_command_line_sync(command);
        return [isSuccess, ByteArray.toString(stdOut)];
    } catch (err) {
        logger(err.message.toString());
        return false;
    }
}

function watchDevInput() {
    let file = Gio.file_new_for_path('/dev/input');
    return file.monitor_directory(Gio.FileMonitorFlags.WATCH_MOUNTS, null);
}


function makePointingDevice(pointingDeviceLines) {
    //assuming that N: & P: always appear at lines 2 and 3 respectively
    if (pointingDeviceLines[1].startsWith('N: Name=') &&
        pointingDeviceLines[2].startsWith('P: Phys=')) {
        let pointingDevice = {};
        pointingDevice.name = pointingDeviceLines[1].split('"')[1];
        pointingDevice.phys = pointingDeviceLines[2].split('=')[1];
        pointingDevice.type = 'mouse'; //default
        for (let type in ALL_TYPES) {
            if (ALL_TYPES[type].some((t) => {
                return (pointingDevice.name.toLowerCase().indexOf(t) >= 0);
            })) {
                pointingDevice.type = type;
                break;
            }
        }
        return pointingDevice;
    }
}

function listPointingDevices() {
    let pointingDevices = [];
    let comp = executeCmdSync('cat /proc/bus/input/devices');
    let allDeviceChunks = comp[1].split('\n\n');
    for (let x = 0; x < allDeviceChunks.length; x++) {
        if (allDeviceChunks[x].indexOf('mouse') !== -1) {
            let pointingDeviceLines = allDeviceChunks[x].split('\n');
            let pointingDevice = makePointingDevice(pointingDeviceLines);
            if (pointingDevice !== undefined) {
                pointingDevices.push(pointingDevice);
            }
        }
    }
    if (pointingDevices[0]) {
        return [true, pointingDevices];
    } else {
        return [false, '    - No Pointing Devices detected.\n'];
    }
}


function removeSource(...args) {
    return GLib.source_remove(...args);
}

function addTimeout(...args) {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, ...args);
}
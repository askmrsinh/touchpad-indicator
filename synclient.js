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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

// Disable Synclient manually to prevent errors
const USE_SYNCLIENT = true;

let logging = Lib.logger;

class Synclient {
    constructor(gsettings) {
        this._init(gsettings);
    }

    _init(gsettings) {
        logging('Synclient._init()');
        this.gsettings = gsettings;
        this.synclient_status = false;
        this.stop = false;
        this.watch = false;
        this.timeout = false;
        this.synclientInUse = this._isSynclientInUse();
    }

    _isSynclientInUse() {
        if (!USE_SYNCLIENT) {
            logging('Synclient._isSynclientInUse(): synclient manually '
                + 'disabled');
            return false;
        }
        this.output = Lib.executeCmdSync('synclient -l');
        if (!this.output) {
            logging('Synclient._isSynclientInUse(): synclient not found');
            return false;
        }
        if (!this.output[0]) {
            logging('Synclient._isSynclientInUse(): synclient not found');
            return false;
        }
        for (let x = 0; x < this.output.length; x++) {
            if (typeof (this.output[x]) == 'object' &&
                this.output[x].length > 0) {
                if (this.output[x].toString().includes("Couldn't find synaptics properties")) {
                    logging('Synclient._isSynclientInUse(): no properties '
                        + 'found');
                    return false;
                }
                if (this.output[x].toString().includes('TouchpadOff')) {
                    logging('Synclient._isSynclientInUse(): synclient '
                        + 'found and ready to use');
                    return true;
                }
            }
        }
        logging('Synclient._isSynclientInUse(): unknown situation - '
            + 'Return false');
        return false;
    }

    _isSynclientStillInUse() {
        this.synclientInUse = this._isSynclientInUse();
        return this.synclientInUse;
    }

    _watch() {
        if (!this.stop && !this.wait) {
            this.output = Lib.executeCmdSync('synclient -l');
            if (this.output) {
                let lines = this.output[1].toString().split('\n');
                for (let x = 0; x < lines.length; x++) {
                    if (lines[x].includes('TouchpadOff')) {
                        this.touchpad_off = lines[x];
                        break;
                    }
                }
                if (!this.synclient_status)
                    this.synclient_status = this.touchpad_off;
                if (this.synclient_status === this.touchpad_off) {
                    this._wait();
                } else {
                    let parts = this.touchpad_off.split('= ');
                    let state = true;
                    if (parts[1] === '1') {
                        state = false;
                    }
                    logging(`Synclient._watch: Touchpad state changed to ${
                        state.toString()}`);
                    this.gsettings.set_boolean('touchpad-enabled', state);
                    this.synclient_status = this.touchpad_off;
                    this._wait();
                }
            }
        }
    }

    _callWatch() {
        this.wait = false;
        this._watch();
    }

    _wait() {
        this.wait = true;
        this.timeout = Lib.addTimeout(1000, this._callWatch.bind(this));
    }

    _cancel() {
        logging('Synclient._cancel()');
        this.stop = true;
        this.wait = false;
        this.synclient_status = false;
        if (this.timeout) {
            Lib.removeSource(this.timeout);
            this.timeout = false;
        }
    }

    _disable() {
        logging('Synclient._disable()');
        this._cancel();
        if (Lib.executeCmdAsync('synclient TouchpadOff=1')) {
            this.stop = false;
            this._watch();
            return false;
        } else
            return true;
    }

    _enable() {
        logging('Synclient._enable()');
        this._cancel();
        if (Lib.executeCmdAsync('synclient TouchpadOff=0')) {
            this.stop = false;
            this._watch();
            return true;
        } else
            return false;
    }

    _switch(state) {
        if (state) {
            return this._enable();
        } else {
            return this._disable();
        }
    }
}


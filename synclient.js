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

function logging(event) {
    Lib.logger(`Synclient.${event}`);
}

class Synclient {
    constructor() {
        this._init();
    }

    _init() {
        logging('_init()');
        this.tpdOff = false;
        this.isUsable = this._isUsable();
    }

    _isUsable() {
        let comp = Lib.executeCmdSync('synclient -l');
        if (!USE_SYNCLIENT) {
            logging('_isSynclientInUse(): synclient manually disabled');
            return false;
        }

        if (comp[1].includes('TouchpadOff')) {
            logging('_isSynclientInUse(): synclient found and ready to use');
            return true;
        } else if (comp[1].includes("Couldn't find synaptics properties")) {
            logging('_isSynclientInUse(): no properties found');
            return false;
        } else if (comp[1] === '') {
            logging('_isSynclientInUse(): synclient not found');
            return false;
        }

        logging('_isSynclientInUse(): unknown situation - Return false');
        return false;
    }

    _disable() {
        logging('_disable()');
        if (Lib.executeCmdAsync('synclient TouchpadOff=1')) {
            this.tpdOff = true;
        } else
            this.tpdOff = false;
    }

    _enable() {
        logging('_enable()');
        if (Lib.executeCmdAsync('synclient TouchpadOff=0')) {
            this.tpdOff = true;
        } else
            this.tpdOff = false;
    }

    _switch(state) {
        if (state) {
            return this._enable();
        } else {
            return this._disable();
        }
    }
}


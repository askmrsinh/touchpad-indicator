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

// for consistency, does nothing.
const USE_XINPUT = true;

function logging(event) {
    Lib.logger(`XInput.${event}`);
}

class XInput {
    constructor(devices) {
        this._init(devices);
    }

    _init(devices) {
        logging(`_init(${devices})`);
        this.devices = devices;
        this.ids = this._getIds();
        this.isPresent = this._isPresent();
        logging(`_init(): Found Device - ${
            this.isPresent.toString()} ${this.ids}`);
    }

    _getIds() {
        let tpids = [];
        let y = 0;
        let allIds = this._getAllIds();
        for (let id = 0; id < allIds.length; id++) {
            if (this._isDevice(allIds[id]) === true) {
                tpids[y] = allIds[id];
                y++;
            }
        }
        return tpids;
    }

    _getAllIds() {
        let devids = [];
        let comp = Lib.executeCmdSync('xinput --list');
        if (comp[0]) {
            let lines = comp[1].split('\n');
            let line = 0;
            //assuming that 'pointer' lines always appear fist & together
            while (lines[line].includes('pointer')) {
                devids.push(lines[line].split('id=')[1].split('\t')[0]);
                line++;
            }
        }
        return devids;
    }

    _isDevice(id) {
        let comp = Lib.executeCmdSync(`xinput --list-props ${id.toString()}`);
        return this._searchDevice(comp[1]);
    }

    _isPresent() {
        return this.ids.length > 0;
    }

    _searchDevice(where) {
        if (where) {
            where = where.toLowerCase();
            for (let tpid = 0; tpid < this.devices.length; tpid++) {
                if (where.includes(this.devices[tpid].toString().toLowerCase())) {
                    return true;
                }
            }
        }
        return false;
    }

    _setDeviceEnabled(id) {
        logging(`_setDeviceEnabled() id: ${id.toString()}`);
        return Lib.executeCmdAsync(`xinput set-prop ${id.toString()
        } "Device Enabled" 1`);
    }

    _setDeviceDisabled(id) {
        logging(`_setDeviceDisabled() id: ${id.toString()}`);
        return Lib.executeCmdAsync(`xinput set-prop ${id.toString()
        } "Device Enabled" 0`);
    }

    _disableAllDevices() {
        for (let id = 0; id < this.ids.length; id++) {
            this._setDeviceDisabled(this.ids[id]);
        }
        return !this._allDevicesEnabled();
    }

    _enableAllDevices() {
        for (let id = 0; id < this.ids.length; id++) {
            this._setDeviceEnabled(this.ids[id]);
        }
        return this._allDevicesEnabled();
    }

    _switchAllDevices(state) {
        for (let id = 0; id < this.ids.length; id++) {
            if (state) {
                this._setDeviceEnabled(this.ids[id]);
            } else {
                this._setDeviceDisabled(this.ids[id]);
            }
        }
        return this._allDevicesEnabled();
    }

    _isDeviceEnabled(id) {
        logging('_isDeviceEnabled()');
        let lines = Lib.executeCmdSync(`xinput --list-props ${id.toString()}`);
        if (lines) {
            lines = lines[1].split('\n');
            for (let line = 0; line < lines.length; line++) {
                if (lines[line].toString().toLowerCase().includes('device enabled')) {
                    if (lines[line].toString().split(':')[1].includes('1')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    _allDevicesEnabled() {
        if (!this.isPresent) {
            return false;
        }
        for (let id = 0; id < this.ids.length; id++) {
            if (this._isDeviceEnabled(this.ids[id]) === false) {
                return false;
            }
        }
        return true;
    }
}


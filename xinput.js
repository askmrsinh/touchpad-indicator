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

// for consistency
var USE_XINPUT = true;

let logging = Lib.logger;

function XInput(devices) {
    this._init(devices);
}

XInput.prototype = {
    _init: function (devices) {
        logging(`XInput._init(${devices})`);
        this.devices = devices;
        this.ids = this._getIds();
        this.isPresent = this._isPresent();
        logging(`XInput._init(): Found Device - ${
            this.isPresent.toString()} ${this.ids}`);
    },

    _getIds: function () {
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
    },

    _getAllIds: function () {
        let devids = [];
        let comp = Lib.executeCmdSync('xinput --list');
        if (comp[0]) {
            let lines = comp[1].split('\n');
            let line = 0;
            //assuming that 'pointer' lines always appear fist & together
            while (lines[line].indexOf('pointer') !== -1) {
                devids.push(lines[line].split('id=')[1].split('\t')[0]);
                line++;
            }
        }
        return devids;
    },

    _isDevice: function (id) {
        let comp = Lib.executeCmdSync(`xinput --list-props ${id.toString()}`);
        return this._searchDevice(comp[1]);
    },

    _isPresent: function () {
        return this.ids.length > 0;
    },

    _searchDevice: function (where) {
        if (where) {
            where = where.toLowerCase();
            for (let tpid = 0; tpid < this.devices.length; tpid++) {
                if (where.indexOf(
                    this.devices[tpid].toString().toLowerCase()) !== -1) {
                    return true;
                }
            }
        }
        return false;
    },

    _setDeviceEnabled: function (id) {
        logging(`XInput._setDeviceEnabled() id: ${id.toString()}`);
        return Lib.executeCmdAsync(`xinput set-prop ${id.toString()
        } "Device Enabled" 1`);
    },

    _setDeviceDisabled: function (id) {
        logging(`XInput._setDeviceDisabled() id: ${id.toString()}`);
        return Lib.executeCmdAsync(`xinput set-prop ${id.toString()
        } "Device Enabled" 0`);
    },

    _disableAllDevices: function () {
        for (let id = 0; id < this.ids.length; id++) {
            this._setDeviceDisabled(this.ids[id]);
        }
        return !this._allDevicesEnabled();
    },

    _enableAllDevices: function () {
        for (let id = 0; id < this.ids.length; id++) {
            this._setDeviceEnabled(this.ids[id]);
        }
        return this._allDevicesEnabled();
    },

    _switchAllDevices: function (state) {
        for (let id = 0; id < this.ids.length; id++) {
            if (state) {
                this._setDeviceEnabled(this.ids[id]);
            } else {
                this._setDeviceDisabled(this.ids[id]);
            }
        }
        return this._allDevicesEnabled();
    },

    _isDeviceEnabled: function (id) {
        logging('XInput._isDeviceEnabled()');
        let lines = Lib.executeCmdSync(`xinput --list-props ${id.toString()}`);
        if (lines) {
            lines = lines[1].split('\n');
            for (let line = 0; line < lines.length; line++) {
                if (lines[line].toString().toLowerCase().indexOf(
                    'device enabled') !== -1) {
                    if (lines[line].toString().split(':')[1].indexOf('1')
                        !== -1) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    _allDevicesEnabled: function () {
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
};


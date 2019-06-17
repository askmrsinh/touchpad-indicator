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
    constructor() {
        this._init();
    }

    _init() {
        logging('_init()');
        this.pointingDevices = this._listPointingDevices()[1];
        this.isUsable = this._isUsable();
    }

    _isUsable() {
        let comp = Lib.executeCmdSync('xinput --list');
        if (comp[1]) {
            logging('_isUsable(): xinput found and ready to use');
            return true;
        }

        logging('_isUsable(): unknown situation - Return false');
        return false;
    }

    _listPointingDevices() {
        let pointingDevices = [];
        let comp = Lib.executeCmdSync('xinput --list');
        let allDeviceLines = comp[1].split('\n');
        let x = 0;
        //assuming that 'pointer' lines always appear fist & together
        while (allDeviceLines[x].includes('pointer')) {
            if (allDeviceLines[x].indexOf('Virtual') === -1) {
                let pointingDeviceLine = allDeviceLines[x];
                let pointingDevice = this._makePointingDevice(pointingDeviceLine);
                if (pointingDevice !== undefined) {
                    pointingDevices.push(pointingDevice);
                }
            }
            x++;
        }
        if (pointingDevices[0]) {
            return [true, pointingDevices];
        } else {
            return [false, '    - No Pointing Devices detected.\n'];
        }
    }

    _makePointingDevice(pointingDeviceLine) {
        let pointingDevice = {};
        let id = pointingDeviceLine.split('id=')[1].split('\t')[0];
        let name = Lib.executeCmdSync(`xinput --list --name-only ${id}`)[1];
        for (let type in Lib.ALL_TYPES) {
            if (Lib.ALL_TYPES[type].some((t) => {
                return (name.toLowerCase().indexOf(t) >= 0);
            })) {
                pointingDevice.id = id;
                pointingDevice.name = name.slice(0, -1);
                pointingDevice.type = type;
                // eslint-disable-next-line prefer-template
                logging('_makePointingDevice(): Found ' + pointingDevice.type +
                        ',' +
                        ' Id="' + pointingDevice.id + '"' +
                        ' Name="' + pointingDevice.name + '"');
                return pointingDevice;
            }
        }
        return;
    }

    _enableAll() {
        logging('_enableAll()');
        for (let i = 0; i < this.pointingDevices.length; ++i) {
            let id = this.pointingDevices[i].id;
            Lib.executeCmdAsync(`xinput set-prop ${id} "Device Enabled" 1`);
        }
    }

    _enableByType(deviceType) {
        let ids = this._filterIdsByType(deviceType);
        return this._enable(ids);
    }

    _disableByType(deviceType) {
        let ids = this._filterIdsByType(deviceType);
        return this._disable(ids);
    }

    _switchByType(deviceType, state) {
        logging(`_switchByType(): ${deviceType}(s) set to ${state}`);
        if (state) {
            this._enableByType(deviceType);
        } else {
            this._disableByType(deviceType);
        }
    }

    _enable(ids) {
        logging(`_enable(${ids})`);
        for (let i = 0; i < ids.length; ++i) {
            Lib.executeCmdAsync(`xinput set-prop ${ids[i]} "Device Enabled" 1`);
        }
    }

    _disable(ids) {
        logging(`_disable(${ids})`);
        for (let i = 0; i < ids.length; ++i) {
            Lib.executeCmdAsync(`xinput set-prop ${ids[i]} "Device Enabled" 0`);
        }
    }

    _filterIdsByType (deviceType) {
        let ids = [];
        let filteredPointingDevices = this.pointingDevices.filter((d) => {
            return (d.type === deviceType);
        });
        for (let i = 0; i < filteredPointingDevices.length; i++) {
            ids.push(filteredPointingDevices[i].id);
        }
        return ids;
    }

    _isPresent(deviceType) {
        let ids = this._filterIdsByType(deviceType);
        let isPresent = (ids.length > 0);
        logging(`_isPresent(${deviceType}): ${isPresent}`);
        return isPresent;
    }
}
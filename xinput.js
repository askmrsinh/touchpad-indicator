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

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;

// Disable Xinput manually to prevent errors
const USE_XINPUT = true;

function logging(event) {
    if (Lib.DEBUG) {
        Lib.logger(`XInput.${event}`);
    }
}

var XInput = class XInput {
    constructor() {
        this._init();
    }

    _init() {
        logging('_init()');
        this.isUsable = this._isUsable();
        if (!this.isUsable){
            return;
        }
        this.pointingDevices = this._listPointingDevices()[1];
    }

    _isUsable() {
        if (Lib.SESSION_TYPE.indexOf('wayland') !== -1) {
            logging('_isUsable(): ignoring xinput on wayland');
            return false;
        }

        if (!USE_XINPUT) {
            logging('_isUsable(): xinput manually disabled');
            return false;
        }

        let comp = Lib.executeCmdSync('xinput --list');
        if ((comp[1] === undefined) || (comp[0] === false)) {
            logging('_isUsable(): xinput not found');
            return false;
        } else if (comp[1].includes("Virtual core pointer")) {
            logging('_isUsable(): xinput found');
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
                pointingDevice.name = name;
                pointingDevice.type = type;
                pointingDevice.driver = this._getDriver(pointingDevice.id);
                // eslint-disable-next-line prefer-template
                logging('_makePointingDevice(...): Found ' + pointingDevice.type +
                    ', Id="' + pointingDevice.id + '"' +
                    ', Name="' + pointingDevice.name + '"' +
                    ', Driver="' + pointingDevice.driver + '"');
                return pointingDevice;
            }
        }
    }

    _enableAll() {
        if (this.isUsable) {
            logging('_enableAll()');
            for (let i = 0; i < this.pointingDevices.length; ++i) {
                let id = this.pointingDevices[i].id;
                Lib.executeCmdAsync(`xinput set-prop ${id} "Device Enabled" 1`);
            }
        }
    }

    _enableByType(deviceType) {
        let ids = this._filterByType(deviceType).ids;
        return this._enable(ids);
    }

    _disableByType(deviceType) {
        let ids = this._filterByType(deviceType).ids;
        return this._disable(ids);
    }

    _switchByType(deviceType, state) {
        logging(`_switchByType(${deviceType}, ${state})`);
        if (state) {
            this._enableByType(deviceType);
        } else {
            this._disableByType(deviceType);
        }
    }

    _enable(ids) {
        if (this.isUsable) {
            logging(`_enable(${ids})`);
            for (let i = 0; i < ids.length; ++i) {
                Lib.executeCmdAsync(`xinput set-prop ${ids[i]} "Device Enabled" 1`);
            }
        }
    }

    _disable(ids) {
        if (this.isUsable) {
            logging(`_disable(${ids})`);
            for (let i = 0; i < ids.length; ++i) {
                Lib.executeCmdAsync(`xinput set-prop ${ids[i]} "Device Enabled" 0`);
            }
        }
    }

    _filterByType(deviceType) {
        let ids = [];
        let names = [];
        let drivers = [];

        if (this.isUsable) {
            let filteredPointingDevices = this.pointingDevices.filter((d) => {
                return (d.type === deviceType);
            });
            for (let i = 0; i < filteredPointingDevices.length; i++) {
                ids.push(filteredPointingDevices[i].id);
                names.push(filteredPointingDevices[i].name);
                drivers.push(filteredPointingDevices[i].driver);
            }
        }

        return { 'ids': ids, 'names': names, 'drivers': drivers };
    }

    _isPresent(deviceType) {
        let ids = this._filterByType(deviceType).ids;
        let isPresent = (ids.length > 0);
        logging(`_isPresent(${deviceType}): ${isPresent}`);
        return isPresent;
    }

    _getDriver(id) {
        let properties = Lib.executeCmdSync(`xinput --list-props ${id}`)[1];
        if (properties.includes('libinput')) {
            return 'libinput';
        } else if (properties.includes('Synaptics')) {
            return 'Synaptics';
        }
        return 'other';
    }
};


/* exported XInput */
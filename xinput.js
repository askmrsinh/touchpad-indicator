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

let logging = Lib.logging;

function XInput(devices) {
    this._init(devices);
};

XInput.prototype = {
    _init: function(devices) {
        logging('XInput._init(' + devices + ')');
        this.devices = devices;
        this.ids = this._get_ids();
        this.is_there_device = this._is_there_device();
        logging('XInput._init(): Found Device - ' + 
            this.is_there_device.toString() + ' ' + this.ids);
    },

    _get_ids: function() {
        var tpids = new Array();
        let y = 0;
        let all_ids = this._get_all_ids();
        for (let id = 0; id < all_ids.length; id++) {
            if (this._is_device(all_ids[id]) == true) {
                tpids[y] = all_ids[id];
                y++;
            }
        }
        return tpids;
    },

    _get_all_ids: function() {
        var devids = new Array();
        let lines = Lib.execute_sync('xinput --list');
        if (lines) {
            lines = lines[1].toString().split('\n');
	        let y = 0;
            for (let line = 0; line < lines.length; line++) {
                if (lines[line].indexOf('pointer')!=-1) {
                     devids[y] = lines[line].toString().split('=')[1].
                            split('[')[0].split('\t')[0];
                     y++;
                }
            }
        }
        return devids;
    },

    _is_device: function(id) {
        let comp = Lib.execute_sync('xinput --list-props ' + id.toString());
        return this._search_device(comp[1]);
    },

    _is_there_device: function() {
        if (this.ids.length > 0)
            return true;
        return false;
    },

    _search_device: function(where) {
        if (where) {
            where = where.toString().toLowerCase();
            for (let tpid = 0; tpid < this.devices.length; tpid++) {
                if (!(where.indexOf(
                        this.devices[tpid].toString().toLowerCase()) == -1)) {
                    return true;
                }
            }
        }
        return false;
    },

    _set_device_enabled: function(id) {
        logging('XInput._set_device_enabled() id: '+id.toString());
        return Lib.execute_async('xinput set-prop ' + id.toString()
            + ' "Device Enabled" 1');
    },

    _set_device_disabled: function(id) {
        logging('XInput._set_device_disabled() id: '+id.toString());
        return Lib.execute_async('xinput set-prop ' + id.toString()
            + ' "Device Enabled" 0');
    },

    _disable_all_devices: function() {
        for (let id = 0; id < this.ids.length; id++) {
            this._set_device_disabled(this.ids[id]);
        }
        return !this._all_devices_enabled();
    },

    _enable_all_devices: function() {
        for (let id = 0; id < this.ids.length; id++) {
            this._set_device_enabled(this.ids[id]);
        }
        return this._all_devices_enabled();
    },

    _switch_all_devices: function(state) {
        for (let id = 0; id < this.ids.length; id++) {
            if (state) {
                this._set_device_enabled(this.ids[id]);
            } else {
                this._set_device_disabled(this.ids[id]);
            }
        }
        return this._all_devices_enabled();
    },

    _is_device_enabled: function(id) {
        logging('XInput._is_device_enabled()');
        var lines = Lib.execute_sync('xinput --list-props ' + id.toString());
        if (lines) {
            lines = lines[1].toString().split('\n');
            for (let line = 0; line < lines.length; line++) {
                if (lines[line].toString().toLowerCase().indexOf(
                        'device enabled') != -1) {
                    if (lines[line].toString().split(':')[1].indexOf('1')
                            != -1) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    _all_devices_enabled: function() {
        if (!this.is_there_device) {
            return false;
        }
        for (let id = 0; id < this.ids.length; id++) {
            if (this._is_device_enabled(this.ids[id]) == false) {
                return false;
            }
        }
        return true;
    }
};


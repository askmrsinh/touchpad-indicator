/*
 * Copyright 2011 Armin Köhler <orangeshirt at web.de>
 *
 * Thanks to Lorenzo Carbonell Cerezo and Miguel Angel Santamaría Rogado
 * which has written touchpad-indicator 
 * (https://launchpad.net/touchpad-indicator) as python app and inspired 
 * myself to write these extension for gnome-shell.
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

const St = imports.gi.St;
const Gettext = imports.gettext.domain('gnome-shell-extension-touchpad-indicator');
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;


const TOUCHPADS = new Array('touchpad','glidepoint','fingersensingpad','bcm5974');
const MOUSE = new Array('mouse');

// Set your default behaviour here (read README for extended explanations):
var METHOD = 0; // possible values: '0' for xinput or '1'  for synclient
var DISABLE_TOUCHPAD_AT_STARTUP = true; //possible values: 'true' or 'false'


// Settings
const WEATHER_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.touchpad-indicator';
const METHOD_KEY = 'method-to-disable';
const DISABLE_TOUCHPAD_AT_STARTUP_KEY = 'disable-touchpad-at-startup';

// Keep enums in sync with GSettings schemas
const MethodToDisable = {
    XINPUT: 0,
    SYNCLIENT: 1
}


function getSettings(schema) {
    if (Gio.Settings.list_schemas().indexOf(schema) == -1) {
        throw _("Schema \"%s\" not found.").format(schema);
        return false;
    }
    return new Gio.Settings({ schema: schema });
};

function execute_sync(command) {
    var valor = GLib.spawn_command_line_sync(command);
    return valor[1];
};

function execute_async(command) {
    var valor = GLib.spawn_command_line_async(command);
    return valor;
};

function is_there_mouse() {
    let comp = execute_sync('xinput --list');
    return search_mouse(comp);
};

function search_mouse(where) {
    where = where.toString().toLowerCase();
    for (let mouse = 0; mouse < MOUSE.length; mouse++) {
        if (!(where.indexOf(MOUSE[mouse].toString()) == -1)) {
            return true;
        }
    }
    return false;
};


function TouchpadXInput() {
    this._init();
}

TouchpadXInput.prototype = {
    _init: function() {
        this.ids = this._get_ids();
    },

    _get_ids: function() {
        var tpids = new Array();
        let y = 0;
        let all_ids = this._get_all_ids();
        for (let id = 0; id < all_ids.length; id++) {
            if (this._is_touchpad(all_ids[id]) == true) {
                tpids[y] = all_ids[id];
                y++;
            }
        }
        return tpids;
    },

    _get_all_ids: function() {
        var devids = new Array();
        let lines = execute_sync('xinput --list');
        lines = lines.toString().split('\n');
	    let y = 0;
        for (let line = 0; line < lines.length; line++) {
            if (lines[line].indexOf('id=')!=-1) {
                 devids[y] = lines[line].toString().split('=')[1].split('[')[0].split('\t')[0];
                 y++;
            }  
        }
        return devids;
    },

    _is_touchpad: function(id) {
        let comp = execute_sync('xinput --list-props ' + id.toString());
        return this._search_touchpad(comp);
    },

    _is_there_touchpad: function() {
        let comp = execute_sync('xinput --list');
        return this._search_touchpad(comp);
    },

    _search_touchpad: function(where) {
        where = where.toString().toLowerCase();
        for (let tpid = 0; tpid < TOUCHPADS.length; tpid++) {
            if (!(where.indexOf(TOUCHPADS[tpid].toString()) == -1)) {
                return true;
            }
        }
        return false;
    },

    _set_touchpad_enabled: function(id) {
        if (execute_async('xinput set-prop ' + id.toString() + ' "Device Enabled" 1') == true) {
            return true;
        }
        return false;
    },

    _set_touchpad_disabled: function(id) {
        if (execute_async('xinput set-prop ' + id.toString() + ' "Device Enabled" 0') == true) {
            return true;
        }
        return false;
    },

    _disable_all_touchpads: function() {
        for (let id = 0; id < this.ids.length; id++) {
            this._set_touchpad_disabled(this.ids[id]);
            //Thread.sleep(1);
        }
        return !this._all_touchpad_enabled();
    },

    _enable_all_touchpads: function() {
        for (let id = 0; id < this.ids.length; id++) {
            this._set_touchpad_enabled(this.ids[id]);
            //Thread.sleep(1);
        }
        return this._all_touchpad_enabled();
    },

    _lock_tab_and_scroll: function() {
        return false;
    },

    _is_touchpad_enabled: function(id) {
        var lines = execute_sync('xinput --list-props ' + id.toString());
        lines = lines.toString().split('\n');
        for (let line = 0; line < lines.length; line++) {
            if (lines[line].toString().toLowerCase().indexOf('device enabled') != -1) {
                if (lines[line].toString().split(':')[1].indexOf('1') != -1) {
                    return true;
                }
            }
        }
        return false;
    },

    _all_touchpad_enabled: function() {
        if (this._is_there_touchpad() == false) {
            return false;
        }
        for (let id = 0; id < this.ids.length; id++) {
            if (this._is_touchpad_enabled(this.ids[id]) == false) {
                return false;
            }
        }
        return true;
    }
};


function TouchpadSynClient() {
    this._init();
}

TouchpadSynClient.prototype = {
    _init: function() {
    },

    _disable_all_touchpads: function() {
        if (execute_async('synclient TouchpadOff=1 LEDStatus=1') == true) {
            return true;
        }
        return false;
    },

    _enable_all_touchpads: function() {
        if (execute_async('synclient TouchpadOff=0 LEDStatus=0') == true) {
            return true;
        }
        return false;
    },

    _lock_tab_and_scroll: function() {
        if (execute_async('synclient TouchpadOff=2 LEDStatus=0') == true) {
            return true;
        }
        return false;
    },

    _is_touchpad_enabled: function() {
	    var tp = execute_sync('synclient -l');
	    tp = tp.toString().split('\n');
	    for (let i = 0; i < tp.length; i++) {
	        if (tp[i].indexOf('TouchpadOff') != -1) {
	            tp = tp[i];
	            break;
	        }
	    }
        if (tp.indexOf('1') != -1) {
	        return false;
	    }
        return true;
    },

    _all_touchpad_enabled: function() {
        return this._is_touchpad_enabled();
    }
};


function PopupMenuItem(label, tag, icon, callback) {
    this._init(label, tag, icon, callback);
};

PopupMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, tag, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.icon = new St.Icon({ icon_name: icon,
                                  icon_type: St.IconType.SYMBOLIC,
                                  style_class: 'popup-menu-icon' });
        this.addActor(this.icon);
	    this.tag = tag;
        this.label = new St.Label({ text: text });
        this.addActor(this.label);
        this.connect('activate', callback);
    }
};


let button_definition;
let touchpad;

function touchpadButton() {
   this._init();
}

touchpadButton.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        let settings = getSettings(WEATHER_SETTINGS_SCHEMA);
        if (settings != false) {
            METHOD  = settings.get_enum(METHOD_KEY);
            DISABLE_TOUCHPAD_AT_STARTUP = settings.get_boolean(DISABLE_TOUCHPAD_AT_STARTUP_KEY);
        };

        touchpad = this._chooseMethod();
	    if (DISABLE_TOUCHPAD_AT_STARTUP == true) {
            if (is_there_mouse() == true) {
	            touchpad._disable_all_touchpads();
            }
	    }
	
        button_icon = 'input-touchpad';
        if (touchpad._all_touchpad_enabled() == false) {
            button_icon = 'touchpad-disabled';
        }
        PanelMenu.SystemStatusButton.prototype._init.call(this, button_icon, 'Turn Touchpad On/Off');
            
        this._enableItem = new PopupMenuItem('Enable touchpad', 0, 'input-touchpad', this._onMenuSelect);
        this._disableItem = new PopupMenuItem('Disable touchpad', 1, 'touchpad-disabled', this._onMenuSelect);
        this._lockItem = new PopupMenuItem('Lock tap & scroll', 2, 'input-touchpad', this._onMenuSelect);

        this.menu.addMenuItem(this._enableItem);
        this.menu.addMenuItem(this._disableItem);
        if (METHOD == MethodToDisable.SYNCLIENT) {
            this.menu.addMenuItem(this._lockItem);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        button_definition = this;
    },

    _onMenuSelect: function(actor, event) {
        if (actor.tag == 1) {	
            if (touchpad._disable_all_touchpads() == true) {	        
                PanelMenu.SystemStatusButton.prototype.setIcon.call(button_definition, 'touchpad-disabled');
            }
        } else if (actor.tag == 2) {
            if (touchpad._lock_tab_and_scroll() == true) {
                PanelMenu.SystemStatusButton.prototype.setIcon.call(button_definition, 'input-touchpad');
            }
        } else {
            if (touchpad._enable_all_touchpads() == true) {
	            PanelMenu.SystemStatusButton.prototype.setIcon.call(button_definition, 'input-touchpad');
            }
        }
    }, 
   
    _chooseMethod: function() {
        let tp;
        switch (METHOD) {
            case MethodToDisable.XINPUT:
                tp = new TouchpadSynClient();
                tp._enable_all_touchpads();
                return new TouchpadXInput();
                break;
            case MethodToDisable.SYNCLIENT:
                tp = new TouchpadXInput();
                tp._enable_all_touchpads()
                return new TouchpadSynClient();
                break;
        }
    }
}


// Put your extension initialization code here
let touchpadButton;

function init() {
}

function enable() {
    touchpadButton = new touchpadButton();
    Main.panel.addToStatusArea('touchpad_button', touchpadButton);
}

function disable() {
    touchpadButton.destroy();
}

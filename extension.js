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
const Gio = imports.gi.Gio;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

const TOUCHPADS = new Array('touchpad','glidepoint','fingersensingpad','bcm5974');
const MOUSE = new Array('mouse');

// Set your default behaviour here (read README for extended explanations):
var DISABLE_TOUCHPAD_AT_STARTUP = false; //possible values: 'true' or 'false'
var SYNCLIENT_EXISTS = false; //possible values: 'true' or 'false'. Attention! Set only to 'true' if you have a Synaptics touchpad which use 'synclient' exits on your PC, otherwise gnome-shell will crash while start.


// Settings
const TOUCHPAD_SETTINGS_SCHEMA = 'org.gnome.settings-daemon.peripherals.touchpad'; 


function getSettings(schema) {
    return new Gio.Settings({ schema: schema });
};

function execute_sync(command) {
    return GLib.spawn_command_line_sync(command);
};

function execute_async(command) {
    return GLib.spawn_command_line_async(command);
};

function is_there_mouse() {
    let comp = execute_sync('xinput --list');
    return search_mouse(comp[1]);
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


let button;
let touchpad;

function touchpadButton() {
   this._init();
}

touchpadButton.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        touchpad = getSettings(TOUCHPAD_SETTINGS_SCHEMA);

	    if (DISABLE_TOUCHPAD_AT_STARTUP) {
            if (is_there_mouse()) {
                if (this._touchpad_enabled())
    	            this._disable_touchpad(this);
            } else {
                this._enable_touchpad(this);
            }
	    }

        button_icon = 'input-touchpad';
        if (!this._touchpad_enabled()) {
            button_icon = 'touchpad-disabled';
        }

        PanelMenu.SystemStatusButton.prototype._init.call(this, button_icon, 'Turn Touchpad On/Off');

        touchpad.connect('changed::touchpad-enabled', this._onChangeIcon);

        this._enableItem = new PopupMenuItem('Enable touchpad', 0, 'input-touchpad', this._onMenuSelect);
        this._disableItem = new PopupMenuItem('Disable touchpad', 1, 'touchpad-disabled', this._onMenuSelect);
        this._lockItem = new PopupMenuItem('Lock tap & scroll', 2, 'input-touchpad', this._onMenuSelect);

        this.menu.addMenuItem(this._enableItem);
        this.menu.addMenuItem(this._disableItem);
        if (SYNCLIENT_EXISTS) {
            this.menu.addMenuItem(this._lockItem);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        button = this;
    },

    _onChangeIcon: function(actor, event) {
        if (!button._touchpad_enabled()) {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(button, 'touchpad-disabled');
        } else {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(button, 'input-touchpad');
        }
    },

    _onMenuSelect: function(actor, event) {
        if (actor.tag == 1) {	
            button._disable_touchpad(button)
        } else if (actor.tag == 2) {
            button._lock_tab_and_scroll()
        } else {
            button._enable_touchpad(button)
        }
    },

    _disable_touchpad: function(self) {
        if (SYNCLIENT_EXISTS) {
            if (self._is_lock_tab_and_scroll_enabled())
                execute_async('synclient TouchpadOff=0');
        }
        return touchpad.set_boolean('touchpad-enabled', false);
    },

    _enable_touchpad: function(self) {
        if (SYNCLIENT_EXISTS) {        
            if (self._is_lock_tab_and_scroll_enabled())
                execute_async('synclient TouchpadOff=0');
        }
        return touchpad.set_boolean('touchpad-enabled', true);
    },

    _touchpad_enabled: function() {
        return touchpad.get_boolean('touchpad-enabled');
    },

    _lock_tab_and_scroll: function() {
        if (button._enable_touchpad(button))
            return execute_async('synclient TouchpadOff=2');
    },

    _is_lock_tab_and_scroll_enabled: function() {
	    var tp = execute_sync('synclient -l');
	    tp = tp[1].toString().split('\n');
	    for (let i = 0; i < tp.length; i++) {
	        if (tp[i].indexOf('TouchpadOff') != -1) {
	            tp = tp[i];
	            break;
	        }
	    }
        if (tp.indexOf('2') != -1) {
	        return true;
	    }
        return false;
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

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
const Lang = imports.lang;
const ExtensionSystem = imports.ui.extensionSystem
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gettext = imports.gettext;

Gettext.textdomain("touchpad-indicator@orangeshirt");
Gettext.bindtextdomain("touchpad-indicator@orangeshirt",
    ExtensionSystem.extensionMeta["touchpad-indicator@orangeshirt"].path + "/locale");

const _ = Gettext.gettext;

const TOUCHPADS = new Array('touchpad','glidepoint','fingersensingpad',
                            'bcm5974');
const MOUSE = new Array('mouse');

// Set your default behaviour here (read README for extended explanations):
var DISABLE_TOUCHPAD_AT_STARTUP = false; //possible values: 'true' or 'false'

// Settings
const TOUCHPAD_SETTINGS_SCHEMA = 
    'org.gnome.settings-daemon.peripherals.touchpad';


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


function PopupMenuItem(label, tag, icon, callback, dot, span) {
    this._init(label, tag, icon, callback, dot, span);
};

PopupMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, tag, icon, callback, dot, span) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.label = new St.Label({ text: text,
                                    style_class: 'touchpad-menu-label' });
        this.addActor(this.label, { span: span, expand: true });
        if (icon != false) {
            this.icon = new St.Icon({ icon_name: icon,
                                      icon_type: St.IconType.SYMBOLIC,
                                      style_class: 'popup-menu-icon' });
            this.addActor(this.icon, { span: 1});
        }
	    this.tag = tag;
        this.setShowDot(dot);
        this.connect('activate', callback);
    }
};


function PopupSwitchMenuItem(label, tag, state, callback) {
    this._init(label, tag, state, callback);
};

PopupSwitchMenuItem.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(label, tag, state, callback) {
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, label, state);
	    this.tag = tag;
        this.connect('activate', callback);
    }
};


let button;
let touchpad;

function touchpadIndicatorButton() {
   this._init();
}

touchpadIndicatorButton.prototype = {
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

        PanelMenu.SystemStatusButton.prototype._init.call(this, button_icon, 
            _("Turn Touchpad On/Off"));

        touchpad.connect('changed::touchpad-enabled', this._onChangeIcon);
        touchpad.connect('changed::tap-to-click', this._onSwitchTapToClick);
        touchpad.connect('changed::scroll-method', this._onSwitchScrollMethod);

        this._dot_disable = false;
        this._dot_edge = false;
        this._dot_tow_finger = false;
        if (this._get_scroll_method() == 0) {
            this._dot_disable = true;
        } else if (this._get_scroll_method() == 1) {
            this._dot_edge = true;
        } else if (this._get_scroll_method() == 2) {
            this._dot_two_finger = true;
        }

        this._enableItem = new PopupMenuItem(_("Enable touchpad"), 0,
            'input-touchpad', this._onMenuSelect, false, 1);
        this._disableItem = new PopupMenuItem(_("Disable touchpad"), 1,
            'touchpad-disabled', this._onMenuSelect, false, 1);
        this._ClickToTapItem = new PopupSwitchMenuItem(_("Click to Tap"), 2,
            this._is_tap_to_click_enabled(), this._onMenuSelect);
        this._SettingsItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Touchpadsettings"), { span: -1 });
        this._ScrollItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Scroll behaviour"), { span: -1 });
        this._ScrollItemDisable = new PopupMenuItem(_("Disable scrolling"), 3,
            false, this._onMenuSelect, this._dot_disable, -1);
        this._ScrollItemEdge = new PopupMenuItem(_("Edge scrolling"), 4, 
            false, this._onMenuSelect, this._dot_edge, -1);
        this._ScrollItemTwoFinger = new PopupMenuItem(_("Two Finger scrolling"),
            5, false, this._onMenuSelect, this._dot_two_finger, -1);

        this.menu.addMenuItem(this._enableItem);
        this.menu.addMenuItem(this._disableItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._SettingsItem);
        this._SettingsItem.menu.addMenuItem(this._ClickToTapItem);
        this._SettingsItem.menu.addMenuItem(this._ScrollItem);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemDisable);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemEdge);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemTwoFinger);
        this._SettingsItem.menu.addSettingsAction(_("Additional Settings ..."), 'gnome-mouse-panel.desktop');

        this._onSwitchScrollMethod;

        button = this;
    },

    _onChangeIcon: function(actor, event) {
        if (!button._touchpad_enabled()) {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(button,
                'touchpad-disabled');
        } else {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(button,
                'input-touchpad');
        }
    },

    _onSwitchTapToClick: function(actor, event) {
        if (button._is_tap_to_click_enabled()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                button._ClickToTapItem, true);
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                button._ClickToTapItem, false);
        }
    },

    _onSwitchScrollMethod: function(actor, event) {
        if (button._get_scroll_method() == 0) {
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemDisable, true);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemEdge, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemTwoFinger, false);
        } else if (button._get_scroll_method() == 1) {
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemDisable, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemEdge, true);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemTwoFinger, false);
        } else if (button._get_scroll_method() == 2) {
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemDisable, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemEdge, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                button._ScrollItemTwoFinger, true);
        }
    },

    _onMenuSelect: function(actor, event) {
        if (actor.tag == 0) {	
            button._enable_touchpad();
        } else if (actor.tag == 1) {
            button._disable_touchpad();
        } else if (actor.tag == 2) {   
            button._switch_tap_to_click();
        } else if (actor.tag == 3) {
            button._set_scroll_method(0);
        } else if (actor.tag == 4) {
            button._set_scroll_method(1);
        } else if (actor.tag == 5) {
            button._set_scroll_method(2);
        }
    },

    _disable_touchpad: function() {
        return touchpad.set_boolean('touchpad-enabled', false);
    },

    _enable_touchpad: function() {
        return touchpad.set_boolean('touchpad-enabled', true);
    },

    _touchpad_enabled: function() {
        return touchpad.get_boolean('touchpad-enabled');
    },

    _switch_tap_to_click: function() {
        if (button._is_tap_to_click_enabled()) {
            return touchpad.set_boolean('tap-to-click', false);
        } else {
            return touchpad.set_boolean('tap-to-click', true);
        }
    },

    _is_tap_to_click_enabled: function() {
        return touchpad.get_boolean('tap-to-click');
    },

    _set_scroll_method: function(id) {
        return touchpad.set_enum('scroll-method', id);
    },

    _get_scroll_method: function() {
        return touchpad.get_enum('scroll-method');
    }
}


// Put your extension initialization code here
let touchpadIndicator;

function init() {
}

function enable() {
    touchpadIndicator = new touchpadIndicatorButton();
    Main.panel.addToStatusArea('touchpad_button', touchpadIndicator);
}

function disable() {
    touchpadIndicator.destroy();
}

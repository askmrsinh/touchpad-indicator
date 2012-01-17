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
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('touchpad-indicator@orangeshirt');
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


function PopupMenuItem(label, tag, callback) {
    this._init(label, tag, callback);
};

PopupMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, tag, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.label = new St.Label({ text: text,
                                    style_class: 'touchpad-menu-label' });
        this.addActor(this.label);
	    this.tag = tag;
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


function touchpadIndicatorButton() {
    let button, touchpad;
    this._init();
};

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

        PanelMenu.SystemStatusButton.prototype._init.call(this,
            'input-touchpad', _("Turn Touchpad On/Off"));

        this._touchpadItem = new PopupSwitchMenuItem(_("Touchpad"), 0,
            this._touchpad_enabled(), this._onMenuSelect);
        this._ClickToTapItem = new PopupSwitchMenuItem(_("Click to Tap"), 2,
            this._is_tap_to_click_enabled(), this._onMenuSelect);
        this._SettingsItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Touchpadsettings"));
        this._ScrollItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Scroll behaviour"));
        this._ScrollItemDisable = new PopupMenuItem(_("Disable scrolling"), 3,
            this._onMenuSelect);
        this._ScrollItemEdge = new PopupMenuItem(_("Edge scrolling"), 4, 
            this._onMenuSelect);
        this._ScrollItemTwoFinger = new PopupMenuItem(_("Two Finger scrolling"),
            5, this._onMenuSelect);

        this.menu.addMenuItem(this._touchpadItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._SettingsItem);
        this._SettingsItem.menu.addMenuItem(this._ClickToTapItem);
        this._SettingsItem.menu.addMenuItem(this._ScrollItem);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemDisable);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemEdge);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemTwoFinger);
        this._SettingsItem.menu.addSettingsAction(_("Additional Settings ..."),
            'gnome-mouse-panel.desktop');

        button = this;
        this._onChangeIcon();
        this._onSwitchScrollMethod();
        this._connect_signals();
    },

    _onChangeIcon: function() {
        if (!button._touchpad_enabled()) {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(button,
                'touchpad-disabled');
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                button._touchpadItem, false);
        } else {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(button,
                'input-touchpad');
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                button._touchpadItem, true);
        }
    },

    _onSwitchTapToClick: function() {
        if (button._is_tap_to_click_enabled()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                button._ClickToTapItem, true);
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                button._ClickToTapItem, false);
        }
    },

    _onSwitchScrollMethod: function() {
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
            if (actor.state) {
                button._enable_touchpad();           
            } else {
                button._disable_touchpad();
            }
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
    },

    _connect_signals: function() {
        button.signal_touchpadEnabled = touchpad.connect(
            'changed::touchpad-enabled', button._onChangeIcon);
        button.signal_tapToClick = touchpad.connect(
            'changed::tap-to-click', button._onSwitchTapToClick);
        button.signal_scrollMethod = touchpad.connect(
            'changed::scroll-method', button._onSwitchScrollMethod);
    },

    _disconnect_signals: function() {
        touchpad.disconnect(button.signal_touchpadEnabled);
        touchpad.disconnect(button.signal_tapToClick);
        touchpad.disconnect(button.signal_scrollMethod);
    }
};


// Put your extension initialization code here
let touchpadIndicator;

function init(metadata) {
    imports.gettext.bindtextdomain('touchpad-indicator@orangeshirt',
        GLib.build_filenamev([metadata.path, 'locale']));
};

function enable() {
    touchpadIndicator = new touchpadIndicatorButton;
    Main.panel.addToStatusArea('touchpad-indicator', touchpadIndicator);
};

function disable() {
    touchpadIndicator._disconnect_signals();
    touchpadIndicator.destroy();
};

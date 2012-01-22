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
const ExtensionSystem = imports.ui.extensionSystem;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('touchpad-indicator@orangeshirt');
const _ = Gettext.gettext;

const TOUCHPADS = new Array('touchpad','glidepoint','fingersensingpad',
                            'bcm5974');
const TRACKPOINTS = new Array('trackpoint','accu point','trackstick',
                              'touchstyk','pointing stick');

// Settings
const TOUCHPAD_SETTINGS_SCHEMA = 
    'org.gnome.settings-daemon.peripherals.touchpad';

// Configsettings - overwritten by the values of touchpad-indicator.conf
var CONFIG = {TOUCHPAD_ENABLED : 'true',
              TRACKPOINT_ENABLED : 'true',
              SWITCH_IF_MOUSE : 'false',
              AUTO_SWITCH_TOUCHPAD : 'false',
              AUTO_SWITCH_TRACKPOINT : 'false'}


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
    where = where.toString().toLowerCase().split("\n");
    let hits = 0;
    for (let x = 0; x < where.length; x++) {
        if (!(where[x].indexOf('pointer') == -1) &&
                where[x].indexOf('virtual core') == -1) {
            for (let tpd = 0; tpd < TOUCHPADS.length; tpd++) {
                if (!(where[x].indexOf(TOUCHPADS[tpd].toString()) == -1)) {
                    hits++;
                    break;
                }
            }
            for (let tpt = 0; tpt < TRACKPOINTS.length; tpt++) {
                if (!(where[x].indexOf(TRACKPOINTS[tpt].toString()) == -1)) {
                    hits++;
                    break;
                }
            }
            if (hits == 0) {
                return true;
            } else {
                hits = 0;
            }
        }
    }
    return false;
};

function watch_mouse() {
    this.file = Gio.file_new_for_path("/dev/input/by-path")
    return this.file.monitor(Gio.FileMonitorFlags.NONE, null);       
};


function Config() {
    this._init();
};

Config.prototype = {
    _init: function() {
        this.path = ExtensionSystem.extensionMeta[
           "touchpad-indicator@orangeshirt"].path + '/touchpad-indicator.conf';
    },

    readConfig: function() {
        let [success, config_content, len] = GLib.file_get_contents(this.path);
        config_content = config_content.toString().split("\n");
        let line, parts;
        for (let x = 0; x < config_content.length; x++) {
            line = config_content[x].toString();
            if (line.indexOf('#') == -1 && line.indexOf('=') != -1 ) {
                parts = line.split("=");
                switch (parts[0]) {
                    case 'TOUCHPAD_ENABLED':
                        CONFIG.TOUCHPAD_ENABLED = parts[1];
                        break;
                    case 'TRACKPOINT_ENABLED':
                        CONFIG.TRACKPOINT_ENABLED = parts[1];
                        break;
                    case 'SWITCH_IF_MOUSE':
                        CONFIG.SWITCH_IF_MOUSE = parts[1];
                        break;
                    case 'AUTO_SWITCH_TOUCHPAD':
                        CONFIG.AUTO_SWITCH_TOUCHPAD = parts[1];
                        break;
                    case 'AUTO_SWITCH_TRACKPOINT':
                        CONFIG.AUTO_SWITCH_TRACKPOINT = parts[1];
                        break;
                }
            }
        }
    },

    writeConfig: function() {
        let content = '# Config File for gnome-shell extension '+
            'touchpad-indicator\n\n'+
            'TOUCHPAD_ENABLED='+CONFIG.TOUCHPAD_ENABLED.toString()+'\n'+
            'TRACKPOINT_ENABLED='+CONFIG.TRACKPOINT_ENABLED.toString()+'\n'+
            'SWITCH_IF_MOUSE='+CONFIG.SWITCH_IF_MOUSE.toString()+'\n'+
            'AUTO_SWITCH_TOUCHPAD='+
                CONFIG.AUTO_SWITCH_TOUCHPAD.toString()+'\n'+
            'AUTO_SWITCH_TRACKPOINT='+
                CONFIG.AUTO_SWITCH_TRACKPOINT.toString();
        return GLib.file_set_contents(this.path, content);
    }
};


function TrackpointXInput() {
    this._init();
};

TrackpointXInput.prototype = {
    _init: function() {
        this.ids = this._get_ids();
    },

    _get_ids: function() {
        var tpids = new Array();
        let y = 0;
        let all_ids = this._get_all_ids();
        for (let id = 0; id < all_ids.length; id++) {
            if (this._is_trackpoint(all_ids[id]) == true) {
                tpids[y] = all_ids[id];
                y++;
            }
        }
        return tpids;
    },

    _get_all_ids: function() {
        var devids = new Array();
        let lines = execute_sync('xinput --list');
        lines = lines[1].toString().split('\n');
	    let y = 0;
        for (let line = 0; line < lines.length; line++) {
            if (lines[line].indexOf('id=')!=-1) {
                 devids[y] = lines[line].toString().split('=')[1].split('[')[0]
                                .split('\t')[0];
                 y++;
            }  
        }
        return devids;
    },

    _is_trackpoint: function(id) {
        let comp = execute_sync('xinput --list-props ' + id.toString());
        return this._search_trackpoint(comp[1]);
    },

    _is_there_trackpoint: function() {
        let comp = execute_sync('xinput --list');
        return this._search_trackpoint(comp[1]);
    },

    _search_trackpoint: function(where) {
        where = where.toString().toLowerCase();
        for (let tpid = 0; tpid < TRACKPOINTS.length; tpid++) {
            if (!(where.indexOf(TRACKPOINTS[tpid].toString()) == -1)) {
                return true;
            }
        }
        return false;
    },

    _set_trackpoint_enabled: function(id) {
        return execute_async('xinput set-prop ' + id.toString() +
            ' "Device Enabled" 1');
    },

    _set_trackpoint_disabled: function(id) {
        return execute_async('xinput set-prop ' + id.toString() +
            ' "Device Enabled" 0')
    },

    _disable_all_trackpoints: function() {
        for (let id = 0; id < this.ids.length; id++) {
            this._set_trackpoint_disabled(this.ids[id]);
        }
        return !this._all_trackpoints_enabled();
    },

    _enable_all_trackpoints: function() {
        for (let id = 0; id < this.ids.length; id++) {
            this._set_trackpoint_enabled(this.ids[id]);
        }
        return this._all_trackpoints_enabled();
    },

    _is_trackpoint_enabled: function(id) {
        var lines = execute_sync('xinput --list-props ' + id.toString());
        lines = lines[1].toString().split('\n');
        for (let line = 0; line < lines.length; line++) {
            if (lines[line].toString().toLowerCase().indexOf('device enabled')
                     != -1) {
                if (lines[line].toString().split(':')[1].indexOf('1') != -1) {
                    return true;
                }
            }
        }
        return false;
    },

    _all_trackpoints_enabled: function() {
        if (this._is_there_trackpoint() == false) {
            return false;
        }
        for (let id = 0; id < this.ids.length; id++) {
            if (this._is_trackpoint_enabled(this.ids[id]) == false) {
                return false;
            }
        }
        return true;
    }
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
    let button, touchpad, trackpoint, config_settings;
    this._init();
};

touchpadIndicatorButton.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        touchpad = getSettings(TOUCHPAD_SETTINGS_SCHEMA);
        trackpoint = new TrackpointXInput();

        config_settings = new Config();
        config_settings.readConfig();

        if (CONFIG.TRACKPOINT_ENABLED == 'false')
            trackpoint._disable_all_trackpoints();

        PanelMenu.SystemStatusButton.prototype._init.call(this,
            'input-touchpad', _("Turn Touchpad On/Off"));

        this._touchpadItem = new PopupSwitchMenuItem(_("Touchpad"), 0,
            this._touchpad_enabled(), this._onMenuSelect);
        this._trackpointItem = new PopupSwitchMenuItem(_("Trackpoint"), 1,
            trackpoint._all_trackpoints_enabled(), this._onMenuSelect);
        this._GeneralSettingsItem = new PopupMenu.PopupSubMenuMenuItem(
            _("General Settings"));
        this.auto_switch_touchpad = false;
        if (CONFIG.AUTO_SWITCH_TOUCHPAD == 'true')
            this.auto_switch_touchpad = true;
        this._AutoSwitchTouchpadItem = new PopupSwitchMenuItem(
            _("Auto Switch Touchpad"), 6, this.auto_switch_touchpad,
            this._onMenuSelect);
        this.auto_switch_trackpoint = false;
        if (CONFIG.AUTO_SWITCH_TRACKPOINT == 'true')
            this.auto_switch_trackpoint = true;
        this._AutoSwitchTrackpointItem = new PopupSwitchMenuItem(
            _("Auto Switch Trackpoint"), 7, this.auto_switch_trackpoint,
            this._onMenuSelect);
        this._SettingsItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Touchpadsettings"));
        this._ClickToTapItem = new PopupSwitchMenuItem(_("Click to Tap"), 2,
            this._is_tap_to_click_enabled(), this._onMenuSelect);
        this._ScrollItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Scroll behaviour"));
        this._ScrollItemDisable = new PopupMenuItem(_("Disable scrolling"), 3,
            this._onMenuSelect);
        this._ScrollItemEdge = new PopupMenuItem(_("Edge scrolling"), 4, 
            this._onMenuSelect);
        this._ScrollItemTwoFinger = new PopupMenuItem(_("Two Finger scrolling"),
            5, this._onMenuSelect);

        this.menu.addMenuItem(this._touchpadItem);
        if (trackpoint._is_there_trackpoint())
            this.menu.addMenuItem(this._trackpointItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._GeneralSettingsItem);
        this._GeneralSettingsItem.menu.addMenuItem(
            this._AutoSwitchTouchpadItem);
        if (trackpoint._is_there_trackpoint())
            this._GeneralSettingsItem.menu.addMenuItem(
                this._AutoSwitchTrackpointItem);
        this.menu.addMenuItem(this._SettingsItem);
        this._SettingsItem.menu.addMenuItem(this._ClickToTapItem);
        this._SettingsItem.menu.addMenuItem(this._ScrollItem);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemDisable);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemEdge);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemTwoFinger);
        this._SettingsItem.menu.addSettingsAction(_("Additional Settings ..."),
            'gnome-mouse-panel.desktop');

        button = this;
        this._onMousePlugged();
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
            CONFIG.TOUCHPAD_ENABLED = 'false';
            config_settings.writeConfig();
        } else {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(button,
                'input-touchpad');
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                button._touchpadItem, true);
            CONFIG.TOUCHPAD_ENABLED = 'true';
            config_settings.writeConfig();
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
        switch (actor.tag) {
            case 0:
                if (actor.state) {
                    button._enable_touchpad();           
                } else {
                    button._disable_touchpad();
                }
                break;
            case 1:
                if (actor.state) {
                    button._enable_trackpoint();
                } else {
                    button._disable_trackpoint();
                }
                break;
            case 2:
                button._switch_tap_to_click();
                break;
            case 3:
                button._set_scroll_method(0);
                break;
            case 4:
                button._set_scroll_method(1);
                break;
            case 5:
                button._set_scroll_method(2);
                break;
            case 6:
                if (actor.state) {
                    CONFIG.AUTO_SWITCH_TOUCHPAD = 'true';
                    CONFIG.SWITCH_IF_MOUSE = 'true';
                    config_settings.writeConfig();
                } else {
                    CONFIG.AUTO_SWITCH_TOUCHPAD = 'false';
                    if (CONFIG.AUTO_SWITCH_TRACKPOINT == 'false')
                        CONFIG.SWITCH_IF_MOUSE = 'false';
                    config_settings.writeConfig();
                }
                break;
            case 7:
                if (actor.state) {
                    CONFIG.AUTO_SWITCH_TRACKPOINT = 'true';
                    CONFIG.SWITCH_IF_MOUSE = 'true';
                    config_settings.writeConfig();
                } else {
                    CONFIG.AUTO_SWITCH_TRACKPOINT = 'false';
                    if (CONFIG.AUTO_SWITCH_TOUCHPAD == 'false')
                        CONFIG.SWITCH_IF_MOUSE = 'false'
                    config_settings.writeConfig();
                }
                break;
        }
    },

    _onMousePlugged: function() {
	    if (CONFIG.SWITCH_IF_MOUSE == 'true') {
            let is_mouse = is_there_mouse();
            if (CONFIG.AUTO_SWITCH_TOUCHPAD == 'true') {
                if (is_mouse && button._touchpad_enabled()) {
                    button._disable_touchpad(button);
                } else if (!is_mouse && !button._touchpad_enabled()) {
                    button._enable_touchpad(button);
                }
            }
            if (CONFIG.AUTO_SWITCH_TRACKPOINT == 'true' && 
                    trackpoint._is_there_trackpoint()) {
                if (is_mouse && trackpoint._all_trackpoints_enabled()) {
                    button._disable_trackpoint();
                } else if (!is_mouse && !trackpoint._all_trackpoints_enabled()) {
                    button._enable_trackpoint();
                }
            }
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

    _disable_trackpoint: function() {
        if (trackpoint._disable_all_trackpoints()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(button._trackpointItem, false);
            CONFIG.TRACKPOINT_ENABLED = 'false';
            config_settings.writeConfig();
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(button._trackpointItem, true);
            return false;
        }
    },

    _enable_trackpoint: function() {
        if (trackpoint._enable_all_trackpoints()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(button._trackpointItem, true);
            CONFIG.TRACKPOINT_ENABLED = 'true';
            config_settings.writeConfig();
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(button._trackpointItem, false);
            return false;
        }
    },

    _connect_signals: function() {
        button.signal_touchpadEnabled = touchpad.connect(
            'changed::touchpad-enabled', button._onChangeIcon);
        button.signal_tapToClick = touchpad.connect(
            'changed::tap-to-click', button._onSwitchTapToClick);
        button.signal_scrollMethod = touchpad.connect(
            'changed::scroll-method', button._onSwitchScrollMethod);
        button.watch_mouse = watch_mouse();
        button.signal_watchMouse = button.watch_mouse.connect('changed',
            button._onMousePlugged);
    },

    _disconnect_signals: function() {
        touchpad.disconnect(button.signal_touchpadEnabled);
        touchpad.disconnect(button.signal_tapToClick);
        touchpad.disconnect(button.signal_scrollMethod);
        button.watch_mouse.disconnect(button.signal_watchMouse);
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

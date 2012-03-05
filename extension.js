/*
 * Copyright 2011 Armin Köhler <orangeshirt at web.de>
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

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionMeta = ExtensionSystem.extensionMeta[
                                            "touchpad-indicator@orangeshirt"];
const MessageTray = imports.ui.messageTray;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('touchpad-indicator@orangeshirt');
const _ = Gettext.gettext;

const TOUCHPADS = new Array('touchpad','glidepoint','fingersensingpad',
                            'bcm5974');
const TRACKPOINTS = new Array('trackpoint','accu point','trackstick',
                              'touchstyk','pointing stick','dualpoint stick');

// Settings
const TOUCHPAD_SETTINGS_SCHEMA = 
    'org.gnome.settings-daemon.peripherals.touchpad';

// Configsettings - overwritten by the values of touchpad-indicator.conf
var CONFIG = {TOUCHPAD_ENABLED : true,
              TRACKPOINT_ENABLED : true,
              SWITCH_IF_MOUSE : false,
              AUTO_SWITCH_TOUCHPAD : false,
              AUTO_SWITCH_TRACKPOINT : false,
              SHOW_NOTIFICATIONS : true };

// Debug Mode
const DEBUG = false;
var DEBUG_INFO = 'Extension '+ ExtensionMeta.name.toString() +': ';


function getSettings(schema) {
    return new Gio.Settings({ schema: schema });
};

function execute_sync(command) {
    try {
        return GLib.spawn_command_line_sync(command);
    } catch (err) {
        if (DEBUG)
            global.log(DEBUG_INFO + err.message.toString());
        return false;
    }
};

function execute_async(command) {
    try {
        return GLib.spawn_command_line_async(command);
    } catch (err) {
        if (DEBUG)
            global.log(DEBUG_INFO + err.message.toString());
        return false;
    }
};

function to_boolean(string) {
    if (string == 'true' || string == '1')
        return true;
    return false;
};

function is_there_mouse() {
    let comp = execute_sync('xinput --list');
    if (comp)
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


function TouchpadNotificationSource() {
    this._init();
};

TouchpadNotificationSource.prototype = {
     __proto__:  MessageTray.Source.prototype,

    _init: function() {
        MessageTray.Source.prototype._init.call(this, _("Touchpad Indicator"));

        let icon = new St.Icon({ icon_name: 'input-touchpad',
                                 icon_type: St.IconType.SYMBOLIC,
                                 icon_size: this.ICON_SIZE
                               });
        this._setSummaryIcon(icon);
    }
};

let msg_source;

function ensureMessageSource() {
    if (!msg_source) {
        msg_source = new TouchpadNotificationSource();
        msg_source.connect('destroy', Lang.bind(this, function() {
            msg_source = null;
        }));
        Main.messageTray.add(msg_source);
    }
};

function notify(device, title, text) {
    if (device._notification)
        device._notification.destroy();
    
    // must call after destroying previous notification,
    // or msg_source will be cleared 
    ensureMessageSource();
    if (!title)
        title = _("Touchpad Indicator");
    let icon = new St.Icon({ icon_name: 'input-touchpad',
                             icon_type: St.IconType.SYMBOLIC,
                             icon_size: msg_source.ICON_SIZE
                           });
    device._notification = new MessageTray.Notification(msg_source, title,
                                                        text, { icon: icon });
    device._notification.setUrgency(MessageTray.Urgency.LOW);
    device._notification.setTransient(true);
    device._notification.connect('destroy', function() {
        device._notification = null;
    });
    msg_source.notify(device._notification);
};


function Config() {
    this._init();
};

Config.prototype = {
    _init: function() {
        this.path = GLib.build_filenamev([ExtensionMeta.path,
                                         'touchpad-indicator.conf']);
    },

    readConfig: function() {
        if (GLib.file_test(this.path, GLib.FileTest.EXISTS)) {
            let [success, content, len] = GLib.file_get_contents(this.path);
            content = content.toString().split("\n");
            let line, parts;
            for (let x = 0; x < content.length; x++) {
                line = content[x].toString();
                if (line.indexOf('#') == -1 && line.indexOf('=') != -1 ) {
                    parts = line.split("=");
                    CONFIG[parts[0]] = to_boolean(parts[1]);
                }
            }
        } else {
            this.writeConfig();
        }
    },

    writeConfig: function() {
        let content = '# Config File for gnome-shell extension '+
            'touchpad-indicator\n';
        for (var i in CONFIG) {
            content = content +'\n'+ i.toString() +'='+ CONFIG[i].toString();
        }
        return GLib.file_set_contents(this.path, content);
    }
};


function Synclient() {
    this._init();
};

Synclient.prototype = {
    _init: function() {
        this.synclient_status = false;
        this.stop = false;
        this.timeout = false;
        this.synclient_in_use = this._is_synclient_in_use();
    },

    _is_synclient_in_use: function() {
        this.output = execute_sync('synclient -l');
        if (!this.output) {
            if (DEBUG) {
                global.log(DEBUG_INFO + 'synclient not found');
            }
            return false;
        }
        if (!(this.output.indexOf(
                "Couldn't find synaptics properties") == -1)) {
            if (DEBUG) {
                global.log(DEBUG_INFO + 'synclient - no properties found');
            }
            return false;
            }
        if (DEBUG) {
            global.log(DEBUG_INFO + 'synclient found and in use');
        }
        return true;
    },

    _watch: function() {
        if (!this.stop) {
            this.output = execute_sync('synclient -l');
            if (this.output) {
                lines = this.output[1].toString().split("\n");
                for (let x = 0; x < lines.length; x++) {
                    if (!(lines[x].indexOf("TouchpadOff") == -1)) {
                        this.touchpad_off = lines[x];
                        break;
                    }
                }
                if (!this.synclient_status)
                    this.synclient_status = this.touchpad_off;
                if (this.synclient_status == this.touchpad_off) {
                    this._wait();
                } else {
                    parts = this.touchpad_off.split("= ");
                    CONFIG.TOUCHPAD_ENABLED = !to_boolean(parts[1]);
                    onChangeIcon();                    
                    this.synclient_status = this.touchpad_off;
                    this._wait();
                }
            }
        }
    },
    
    _wait: function() {
        this.timeout = Mainloop.timeout_add(1000, Lang.bind(
            this, this._watch));
    },

    _cancel: function() {
        this.stop = true;
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = false;
        }
    },

    _disable: function() {
        return execute_async('synclient TouchpadOff=1');
    },

    _enable: function() {
        return execute_async('synclient TouchpadOff=0');
    }
};


function TrackpointXInput() {
    this._init();
};

TrackpointXInput.prototype = {
    _init: function() {
        this.ids = this._get_ids();
        this.is_there_trackpoint = this._is_there_trackpoint();
        if (DEBUG)
            global.log(DEBUG_INFO + 'Found Trackpoint - ' +
                this.is_there_trackpoint.toString());
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
        if (lines) {
            lines = lines[1].toString().split('\n');
	        let y = 0;
            for (let line = 0; line < lines.length; line++) {
                if (lines[line].indexOf('id=')!=-1) {
                     devids[y] = lines[line].toString().split('=')[1].
                            split('[')[0].split('\t')[0];
                     y++;
                }  
            }
        }
        return devids;
    },

    _is_trackpoint: function(id) {
        let comp = execute_sync('xinput --list-props ' + id.toString());
        return this._search_trackpoint(comp[1]);
    },

    _is_there_trackpoint: function() {
        if (this.ids.length > 0)
            return true;
        return false;
    },

    _search_trackpoint: function(where) {
        if (where) {
            where = where.toString().toLowerCase();
            for (let tpid = 0; tpid < TRACKPOINTS.length; tpid++) {
                if (!(where.indexOf(TRACKPOINTS[tpid].toString()) == -1)) {
                    return true;
                }
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

    _all_trackpoints_enabled: function() {
        if (!this.is_there_trackpoint) {
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
        if (tag)
	        this.tag = tag;
        if (callback)
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
    this._init();
};

touchpadIndicatorButton.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        this.touchpad = getSettings(TOUCHPAD_SETTINGS_SCHEMA);
        this.trackpoint = new TrackpointXInput();
        this.synclient = new Synclient();

        this.config_settings = new Config();
        this.config_settings.readConfig();

        if (this.synclient.synclient_in_use) {
            if (!this.touchpad.get_boolean('touchpad-enabled'))
                this.touchpad.set_boolean('touchpad-enabled', true);
            if (CONFIG.TOUCHPAD_ENABLED) {
                this.synclient._enable();
            } else {
                this.synclient._disable();
            }
        }

        if (!CONFIG.TRACKPOINT_ENABLED)
            this.trackpoint._disable_all_trackpoints();

        PanelMenu.SystemStatusButton.prototype._init.call(this,
            'input-touchpad', _("Turn Touchpad On/Off"));

        this._touchpadItem = new PopupSwitchMenuItem(_("Touchpad"), 0,
            this._touchpad_enabled(), onMenuSelect);
        this._trackpointItem = new PopupSwitchMenuItem(_("Trackpoint"), 1,
            this.trackpoint._all_trackpoints_enabled(), onMenuSelect);
        this._ExtensionSettingsItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Indicatorsettings"));
        this._SubMenuExtSettings = new St.BoxLayout({
            vertical: true,
            style_class: 'sub-menu-extension-settings'
        });
        this._LabelItem = new St.Label({ 
            text: _("Behaviour if a mouse is (un)plugged:") });
        this._AutoSwitchTouchpadItem = new PopupSwitchMenuItem(
            _("Automatically switch Touchpad On/Off"), 6,
            CONFIG.AUTO_SWITCH_TOUCHPAD, onMenuSelect);
        this._AutoSwitchTrackpointItem = new PopupSwitchMenuItem(
            _("Automatically switch Trackpoint On/Off"), 7,
            CONFIG.AUTO_SWITCH_TRACKPOINT, onMenuSelect);
        this._ShowNotifications = new PopupSwitchMenuItem(
            _("Show notification if switched"), 8,
            CONFIG.SHOW_NOTIFICATIONS, onMenuSelect);
        this._SettingsItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Touchpadsettings"));
        this._ClickToTapItem = new PopupSwitchMenuItem(_("Click to Tap"), 2,
            this._is_tap_to_click_enabled(), onMenuSelect);
        this._ScrollItem = new PopupMenu.PopupSubMenuMenuItem(
            _("Scroll behaviour"));
        this._ScrollItemDisable = new PopupMenuItem(_("Disable scrolling"), 3,
            onMenuSelect);
        this._ScrollItemEdge = new PopupMenuItem(_("Edge scrolling"), 4, 
            onMenuSelect);
        this._ScrollItemTwoFinger = new PopupMenuItem(
            _("Two Finger scrolling"), 5, onMenuSelect);

        this.menu.addMenuItem(this._touchpadItem);
        if (this.trackpoint.is_there_trackpoint)
            this.menu.addMenuItem(this._trackpointItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._ExtensionSettingsItem);
        this._SubMenuExtSettings.add_actor(this._LabelItem);
        this._ExtensionSettingsItem.menu.addActor(this._SubMenuExtSettings);
        this._ExtensionSettingsItem.menu.addMenuItem(
            this._AutoSwitchTouchpadItem);
        if (this.trackpoint.is_there_trackpoint)
            this._ExtensionSettingsItem.menu.addMenuItem(
                this._AutoSwitchTrackpointItem);
        this._ExtensionSettingsItem.menu.addMenuItem(
            this._ShowNotifications);
        this.menu.addMenuItem(this._SettingsItem);
        this._SettingsItem.menu.addMenuItem(this._ClickToTapItem);
        this._SettingsItem.menu.addMenuItem(this._ScrollItem);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemDisable);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemEdge);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemTwoFinger);
        this._SettingsItem.menu.addSettingsAction(_("Additional Settings ..."),
            'gnome-mouse-panel.desktop');

        this._onMousePlugged();
        this._onChangeIcon();
        this._onSwitchScrollMethod();
        this._connect_signals();
    },

    _onChangeIcon: function() {
        if (!this._touchpad_enabled()) {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(this,
                'touchpad-disabled');
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                this._touchpadItem, false);
            CONFIG.TOUCHPAD_ENABLED = false;
            this.config_settings.writeConfig();
        } else {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(this,
                'input-touchpad');
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                this._touchpadItem, true);
            CONFIG.TOUCHPAD_ENABLED = true;
            this.config_settings.writeConfig();
        }
    },

    _onSwitchTapToClick: function() {
        if (this._is_tap_to_click_enabled()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                this._ClickToTapItem, true);
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                this._ClickToTapItem, false);
        }
    },

    _onSwitchScrollMethod: function() {
        if (this._get_scroll_method() == 0) {
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemDisable, true);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemEdge, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemTwoFinger, false);
        } else if (this._get_scroll_method() == 1) {
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemDisable, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemEdge, true);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemTwoFinger, false);
        } else if (this._get_scroll_method() == 2) {
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemDisable, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemEdge, false);
            PopupMenu.PopupBaseMenuItem.prototype.setShowDot.call(
                this._ScrollItemTwoFinger, true);
        }
    },

    _onMousePlugged: function() {
	    if (CONFIG.SWITCH_IF_MOUSE) {
            let is_mouse = is_there_mouse();
            let note_tpd = false, tpd = !is_mouse;
            let note_tpt = false, tpt = !is_mouse;
            if (CONFIG.AUTO_SWITCH_TOUCHPAD) {
                note_tpd = true;
                if (is_mouse && this._touchpad_enabled()) {
                    this._disable_touchpad(this);
                    tpd = false;
                } else if (!is_mouse && !this._touchpad_enabled()) {
                    this._enable_touchpad(this);
                    tpd = true;
                }
            }
            if (CONFIG.AUTO_SWITCH_TRACKPOINT && 
                    this.trackpoint.is_there_trackpoint) {
                note_tpt = true;
                if (is_mouse && this.trackpoint._all_trackpoints_enabled()) {
                    this._disable_trackpoint();
                    tpt = false;
                } else if (!is_mouse && 
                        !this.trackpoint._all_trackpoints_enabled()) {
                    this._enable_trackpoint();
                    tpt = true;
                }
            }
            let content;
            if ((note_tpd && !tpd) || (note_tpt && !tpt)) {
                content = _("Mouse plugged\n");
            } else {
                content = _("Mouse unplugged\n");
            }
            if (note_tpd && note_tpt) {
                if (tpd && tpt) {
                    content = content + _("Touchpad & Trackpoint enabled");
                } else {
                    content = content + _("Touchpad & Trackpoint disabled");
                }
            } else if (note_tpd && !note_tpt) {
                if (tpd) {
                    content = content + _("Touchpad enabled");
                } else {
                    content = content + _("Touchpad disabled");
                }
            } else if (!note_tpd && note_tpt) {
                if (tpt) {
                    content = content + _("Trackpoint enabled");
                } else {
                    content = content + _("Trackpoint disabled");
                }
            }
            this._notify(false, content);
	    }
    },

    _notify: function(title, content) {
        if (CONFIG.SHOW_NOTIFICATIONS)
            notify(this, title, content);
    },

    _disable_touchpad: function() {
        if (this.synclient.synclient_in_use) {
            if (this.synclient._disable()) {
                CONFIG.TOUCHPAD_ENABLED = false;
                return true;
            } else {
                return false;
            }
        } else {
            if (this.touchpad.set_boolean('touchpad-enabled', false)) {
                CONFIG.TOUCHPAD_ENABLED = false;
                return true;
            } else {
                return false;
            }
        }
    },

    _enable_touchpad: function() {
        if (this.synclient.synclient_in_use) {
            if (this.synclient._enable()) {
                CONFIG.TOUCHPAD_ENABLED = true;
                return true;
            } else {
                return false;
            }
        } else {
            if (this.touchpad.set_boolean('touchpad-enabled', true)) {
                CONFIG.TOUCHPAD_ENABLED = true;
                return true;
            } else {
                return false;
            }
        }
    },

    _disable_auto_switch_touchpad: function() {
        CONFIG.AUTO_SWITCH_TOUCHPAD = false;
        if (!CONFIG.AUTO_SWITCH_TRACKPOINT)
            CONFIG.SWITCH_IF_MOUSE = false;
        this.config_settings.writeConfig();
    },

    _enable_auto_switch_touchpad: function() {
        CONFIG.AUTO_SWITCH_TOUCHPAD = true;
        CONFIG.SWITCH_IF_MOUSE = true;
        this.config_settings.writeConfig();
    },

    _touchpad_enabled: function() {
        if (this.synclient.synclient_in_use) {
            return CONFIG.TOUCHPAD_ENABLED;
        } else {
            return this.touchpad.get_boolean('touchpad-enabled');
        }
    },

    _switch_tap_to_click: function() {
        if (this._is_tap_to_click_enabled()) {
            return this.touchpad.set_boolean('tap-to-click', false);
        } else {
            return this.touchpad.set_boolean('tap-to-click', true);
        }
    },

    _is_tap_to_click_enabled: function() {
        return this.touchpad.get_boolean('tap-to-click');
    },

    _set_scroll_method: function(id) {
        return this.touchpad.set_enum('scroll-method', id);
    },

    _get_scroll_method: function() {
        return this.touchpad.get_enum('scroll-method');
    },

    _disable_trackpoint: function() {
        if (this.trackpoint._disable_all_trackpoints()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._trackpointItem, false);
            CONFIG.TRACKPOINT_ENABLED = false;
            this.config_settings.writeConfig();
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._trackpointItem, true);
            return false;
        }
    },

    _enable_trackpoint: function() {
        if (this.trackpoint._enable_all_trackpoints()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._trackpointItem, true);
            CONFIG.TRACKPOINT_ENABLED = true;
            this.config_settings.writeConfig();
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._trackpointItem, false);
            return false;
        }
    },

    _disable_auto_switch_trackpoint: function() {
        CONFIG.AUTO_SWITCH_TRACKPOINT = false;
        if (!CONFIG.AUTO_SWITCH_TOUCHPAD)
            CONFIG.SWITCH_IF_MOUSE = false
        this.config_settings.writeConfig();
    },

    _enable_auto_switch_trackpoint: function() {
        CONFIG.AUTO_SWITCH_TRACKPOINT = true;
        CONFIG.SWITCH_IF_MOUSE = true;
        this.config_settings.writeConfig();
    },

    _switch_notification: function() {
        CONFIG.SHOW_NOTIFICATIONS = !CONFIG.SHOW_NOTIFICATIONS;
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
            call(this._ShowNotifications, CONFIG.SHOW_NOTIFICATIONS);
        this.config_settings.writeConfig();
    },

    _connect_signals: function() {
        this.signal_touchpadEnabled = this.touchpad.connect(
            'changed::touchpad-enabled', onChangeIcon);
        this.signal_tapToClick = this.touchpad.connect(
            'changed::tap-to-click', onSwitchTapToClick);
        this.signal_scrollMethod = this.touchpad.connect(
            'changed::scroll-method', onSwitchScrollMethod);
        this.watch_mouse = watch_mouse();
        this.signal_watchMouse = this.watch_mouse.connect('changed',
            onMousePlugged);
        if (this.synclient.synclient_in_use)
            this.synclient._watch();
    },

    _disconnect_signals: function() {
        this.touchpad.disconnect(this.signal_touchpadEnabled);
        this.touchpad.disconnect(this.signal_tapToClick);
        this.touchpad.disconnect(this.signal_scrollMethod);
        this.watch_mouse.disconnect(this.signal_watchMouse);
        this.watch_mouse.cancel();
        if (this.synclient.synclient_in_use)
            this.synclient._cancel();
    }
};


let touchpadIndicator;

function onMenuSelect(actor, event) {
    switch (actor.tag) {
        case 0:
            if (actor.state) {
                touchpadIndicator._enable_touchpad();           
            } else {
                touchpadIndicator._disable_touchpad();
            }
            break;
        case 1:
            if (actor.state) {
                touchpadIndicator._enable_trackpoint();
            } else {
                touchpadIndicator._disable_trackpoint();
            }
            break;
        case 2:
            touchpadIndicator._switch_tap_to_click();
            break;
        case 3:
            touchpadIndicator._set_scroll_method(0);
            break;
        case 4:
            touchpadIndicator._set_scroll_method(1);
            break;
        case 5:
            touchpadIndicator._set_scroll_method(2);
            break;
        case 6:
            if (actor.state) {
                touchpadIndicator._enable_auto_switch_touchpad();
            } else {
                touchpadIndicator._disable_auto_switch_touchpad();
            }
            break;
        case 7:
            if (actor.state) {
                touchpadIndicator._enable_auto_switch_trackpoint();
            } else {
                touchpadIndicator._disable_auto_switch_trackpoint();
            }
            break;
        case 8:
            touchpadIndicator._switch_notification();
            break;
    }
};

function onChangeIcon() {
    touchpadIndicator._onChangeIcon();
};

function onSwitchTapToClick() {
    touchpadIndicator._onSwitchTapToClick();
};

function onSwitchScrollMethod() {
    touchpadIndicator._onSwitchScrollMethod();
};

function onMousePlugged() {
    touchpadIndicator._onMousePlugged();
};


// Put your extension initialization code here
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

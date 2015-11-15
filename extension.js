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

const St = imports.gi.St;
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const MessageTray = imports.ui.messageTray;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const Conf = imports.misc.config;

const Gettext = imports.gettext.domain('touchpad-indicator@orangeshirt');
const _ = Gettext.gettext;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Prefs = Me.imports.prefs;
const Lib = Me.imports.lib;
const XInput = Me.imports.xinput;
const Synclient = Me.imports.synclient;

//Icons
var TP_ICON = 'input-touchpad';
var TP_ICON_DISABLED = 'touchpad-disabled';

//Workaround...
let currentArray = Conf.PACKAGE_VERSION.split('.');
if (currentArray[0] == 3 && currentArray[1] < 5) {
    // Gnome Shell 3.3 or 3.4
    var NOTIFICATION_ICON_SIZE = MessageTray.Source.prototype.ICON_SIZE;
} else if (currentArray[0] == 3 && currentArray[1] < 7) {
    // Gnome Shell 3.5 or 3.6
    var NOTIFICATION_ICON_SIZE = MessageTray.NOTIFICATION_ICON_SIZE;
    var TP_ICON = 'my-touchpad-normal';
    var TP_ICON_DISABLED = 'my-touchpad-disabled';
} else {
    // Gnome Shell 3.7 and higher
    var NOTIFICATION_ICON_SIZE = MessageTray.Notification.prototype.ICON_SIZE;
    var TP_ICON = 'my-touchpad-normal';
    var TP_ICON_DISABLED = 'my-touchpad-disabled';
}

const StoragePath = Lib.StoragePath;
GLib.mkdir_with_parents(StoragePath, parseInt('0775', 8));

// Please add possible Names in lib.js
const TOUCHPADS = Lib.TOUCHPADS;
var ALL_TOUCHPADS = TOUCHPADS.slice();
const TRACKPOINTS = Lib.TRACKPOINTS;
const FINGER_TOUCHES = Lib.FINGER_TOUCHES;
const TOUCHSCREENS = Lib.TOUCHSCREENS;
const PENS = Lib.PENS;
const OTHERS = Lib.OTHERS;
var ALL_OTHERS = OTHERS.slice();

// Methods to en- or disable the touchpad
const METHOD = Lib.METHOD;

// Settings
const SETTINGS_SCHEMA = Lib.SETTINGS_SCHEMA;
const TOUCHPAD_SETTINGS_SCHEMA = Lib.TOUCHPAD_SETTINGS_SCHEMA;

// Debug Mode Settings
var DEBUG = false; // overwritten by settings
var DEBUG_TO_FILE = false; // overwritten by settings
var DEBUG_LOG_FILE = Lib.DEBUG_LOG_FILE;
GLib.file_set_contents(DEBUG_LOG_FILE, "");

// Disable Synclient manually to prevent errors
var USE_SYNCLIENT = true;

var TIMEOUT_SETTINGSDIALOG = false;


function logging(message) {
    Lib.logging(message, DEBUG, DEBUG_TO_FILE);
};


let msg_source;

const Source = new Lang.Class({
    Name: 'TouchpadIndicatorSource',
    Extends: MessageTray.Source,

    _init: function() {
        this.parent(_("Touchpad Indicator"));
        // Workaround vor Gnome Shell 3.4 and lower
        if (currentArray[0] == 3 && currentArray[1] < 5) {
            let icon = new St.Icon({ icon_name: TP_ICON,
                                     icon_size: NOTIFICATION_ICON_SIZE
                                   });
            this._setSummaryIcon(icon);
        }
        this.connect('destroy', Lang.bind(this, function() {
            msg_source = null;
        }));
    },

    createIcon : function(size) {
        return new St.Icon({ icon_name: TP_ICON,
                             icon_size: size
                           });
    },
});


function notify(device, title, text) {
    if (device._notification)
        device._notification.destroy();

    // must call after destroying previous notification,
    // or msg_source will be cleared
    if (!msg_source) {
        msg_source = new Source();
        Main.messageTray.add(msg_source);
    }
    if (!title)
        title = _("Touchpad Indicator");
    let icon = new St.Icon({ icon_name: TP_ICON,
                             icon_size: NOTIFICATION_ICON_SIZE
                           });
    if (currentArray[0] == 3 && currentArray[1] < 7) {
        device._notification = new MessageTray.Notification(msg_source, title,
            text, { icon: icon });
    } else {
        device._notification = new MessageTray.Notification(msg_source, title,
            text);
	}
    device._notification.setUrgency(MessageTray.Urgency.LOW);
    device._notification.setTransient(true);
    device._notification.connect('destroy', function() {
        device._notification = null;
    });
    msg_source.notify(device._notification);
};


function ConfirmDialog(doIt, cancelIt) {
    this._init(doIt, cancelIt);
}

/* let's use the same layout of the logout dialog */
ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    
    _init: function(doIt, cancelIt) {
        logging('ConfirmDialog.init()');
        let msgbox;
        let subject, description;

        ModalDialog.ModalDialog.prototype._init.call(this,
            { styleClass: 'end-session-dialog' });

        msgbox = new St.BoxLayout({ vertical: true });
        this.contentLayout.add(msgbox, { y_align: St.Align.START });

        subject = new St.Label({
            style_class: 'end-session-dialog-subject',
            text: _("Confirm Dialog")
        });
        msgbox.add(subject, { y_fill: false, y_align: St.Align.START });

        description = new St.Label({
            style_class: 'end-session-dialog-description',
            text: _("Would you really disable this device?\n\
There seems to be no other mouse device enabled!")
        });
        msgbox.add(description, { y_fill: true, y_align: St.Align.START });

        /* keys won't work in the dialog until bug #662493 gets fixed */
        this.setButtons([{
            label: _("Cancel"),
            action: Lang.bind(this, function() {
                logging('ConfirmDialog.init("Cancel")');
                cancelIt();
                this.close();
            }),
            key: Clutter.Escape
        }, {
            label: _("OK"),
            action: Lang.bind(this, function() {
                logging('ConfirmDialog.init("OK")');
                this.close();
                doIt();
            })
        }]);
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
        if (currentArray[0] == 3 && currentArray[1] < 9) {
            // Gnome Shell 3.4 - 3.8
            this.addActor(this.label);
        } else {
            // Gnome Shell 3.9 and higher
            this.actor.add(this.label);
        }
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
        this.connect('toggled', callback);
    }
};


const touchpadIndicatorButton = new Lang.Class({
    Name: 'TouchpadIndicator.TouchpadIndicator',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, _("Touchpad Indicator"));
        this.touchpadIcon = new St.Icon({ icon_name: TP_ICON,
                                          style_class: 'system-status-icon' });
        this.panelicon = this.actor.add_actor(this.touchpadIcon);

        logging('touchpadIndicatorButton._init()');
        this.gsettings = Convenience.getSettings(SETTINGS_SCHEMA);
        this._loadConfig();
        this._load_excluded_mouses();

        this.touchpadgsettings = Convenience.getSettings(
            TOUCHPAD_SETTINGS_SCHEMA);
        if (this._CONF_possibleTouchpad != "-") {
            ALL_TOUCHPADS[TOUCHPADS.length] =
                this._CONF_possibleTouchpad.toLowerCase();
        }
        this.touchpadXinput = new XInput.XInput(ALL_TOUCHPADS);
        this.trackpoint = new XInput.XInput(TRACKPOINTS);
        this.touchscreen = new XInput.XInput(TOUCHSCREENS);
        this.fingertouch = new XInput.XInput(FINGER_TOUCHES);
        this.pen = new XInput.XInput(PENS);
        this.synclient = new Synclient.Synclient(this.gsettings);
        this.xinput_is_installed = Lib.execute_sync('xinput --list');

        if (!this.xinput_is_installed) {
            logging('touchpadIndicatorButton._init(): Can`t find Xinput');
            this.gsettings.set_boolean('autoswitch-trackpoint', false);
        } else {
            logging('touchpadIndicatorButton._init(): Xinput is installed');
        }

        let switch_method_changed = false;
        if (METHOD.SYNCLIENT == this._CONF_switchMethod &&
                !this.synclient.synclient_in_use) {
            this._CONF_switchMethod = METHOD.GCONF;
            switch_method_changed = true;
        }

        if (METHOD.GCONF != this._CONF_switchMethod) {
            if (this.touchpadgsettings.get_string('send-events') != 'enabled')
                this.touchpadgsettings.set_string('send-events', 'enabled');
        }

        if (METHOD.GCONF == this._CONF_switchMethod) {
            if ( this._CONF_touchpadEnabled ) {
                this.touchpadgsettings.set_string('send-events', 'enabled');
            } else {
                this.touchpadgsettings.set_string('send-events', 'disabled');
            }

        } else if (METHOD.SYNCLIENT == this._CONF_switchMethod) {
            if (this._CONF_touchpadEnabled) {
                this.synclient._enable();
            } else {
                this.synclient._disable();
            }
        } else if (METHOD.XINPUT == this._CONF_switchMethod) {
            if (this._CONF_touchpadEnabled) {
                this.touchpadXinput._enable_all_devices();
            } else {
                this.touchpadXinput._disable_all_devices();
            }
        };

        if (!this._CONF_trackpointEnabled)
            this.trackpoint._disable_all_devices();

        if (!this._CONF_touchscreenEnabled)
            this.touchscreen._disable_all_devices();

        if (!this._CONF_fingertouchEnabled)
            this.fingertouch._disable_all_devices();

        if (!this._CONF_penEnabled)
            this.pen._disable_all_devices();

        this._touchpadItem = new PopupSwitchMenuItem(_("Touchpad"), 0,
            this._CONF_touchpadEnabled, onMenuSelect);
        this._trackpointItem = new PopupSwitchMenuItem(_("Trackpoint"), 1,
            this.trackpoint._all_devices_enabled(), onMenuSelect);
        this._touchscreenItem = new PopupSwitchMenuItem(_("Touchscreen"), 2,
            this.touchscreen._all_devices_enabled(), onMenuSelect);
        this._fingertouchItem = new PopupSwitchMenuItem(_("Finger touch"), 3,
            this.fingertouch._all_devices_enabled(), onMenuSelect);
        this._penItem = new PopupSwitchMenuItem(_("Pen"), 4,
            this.pen._all_devices_enabled(), onMenuSelect);

        this.menu.addMenuItem(this._touchpadItem);
        if (this.trackpoint.is_there_device)
            this.menu.addMenuItem(this._trackpointItem);
        if (this.touchscreen.is_there_device)
            this.menu.addMenuItem(this._touchscreenItem);
        if (this.fingertouch.is_there_device)
            this.menu.addMenuItem(this._fingertouchItem);
        if (this.pen.is_there_device)
            this.menu.addMenuItem(this._penItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addSettingsAction(_("Touchpad Preferences"),
            'gnome-mouse-panel.desktop');
        this._SettingsItem = new PopupMenuItem(_("Indicator Preferences"),
            false, Lang.bind(this, function() {Lib.execute_async(
                'gnome-shell-extension-prefs ' + Me.uuid)}));
        this.menu.addMenuItem(this._SettingsItem);

        this._onChangeIcon();
        this._connect_signals();
        this._onMousePlugged();
        if (switch_method_changed)
            this.gsettings.set_enum('switchmethod', this._CONF_switchMethod);
        this._showPanelIcon(this._CONF_showPanelIcon);
    },

    _loadConfig: function() {
        this._CONF_firstTime = this.gsettings.get_boolean('first-time');
		this._CONF_touchpadEnabled = this.gsettings.get_boolean(
            'touchpad-enabled');
		this._CONF_trackpointEnabled = this.gsettings.get_boolean(
            'trackpoint-enabled');
        this._CONF_touchscreenEnabled = this.gsettings.get_boolean(
            'touchscreen-enabled');
		this._CONF_fingertouchEnabled = this.gsettings.get_boolean(
            'fingertouch-enabled');
		this._CONF_penEnabled = this.gsettings.get_boolean(
            'pen-enabled');
		this._CONF_autoSwitchTouchpad = this.gsettings.get_boolean(
            'autoswitch-touchpad');
		this._CONF_autoSwitchTrackpoint = this.gsettings.get_boolean(
            'autoswitch-trackpoint');
        this._CONF_showNotifications = this.gsettings.get_boolean(
            'show-notifications');
        DEBUG = this._CONF_debug = this.gsettings.get_boolean('debug');
        DEBUG_TO_FILE = this._CONF_debugToFile = this.gsettings.get_boolean(
            'debugtofile');
        this._CONF_switchMethod = this.gsettings.get_enum('switchmethod');
        this._CONF_possibleTouchpad = this.gsettings.get_string(
            'possible-touchpad');
        this._CONF_excludedMouses = JSON.parse(this.gsettings.get_string(
            'excluded-mouses'));
        this._CONF_showPanelIcon = this.gsettings.get_boolean(
            'show-panelicon');
	},

    _onChangeIcon: function() {
        logging('touchpadIndicatorButton._onChangeIcon()');
        if (!this._CONF_touchpadEnabled) {
            this.touchpadIcon.icon_name = TP_ICON_DISABLED;
        } else {
            this.touchpadIcon.icon_name = TP_ICON;
        }
    },

    _panelIconChanged: function() {
        this._loadConfig();
        this._showPanelIcon(this._CONF_showPanelIcon);
    },

    _showPanelIcon: function(value) {
        // show or hide the Icon in the Main Panel
        if (value) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
    },

    _adjustSwitchPosition: function() {
        logging('touchpadIndicatorButton._adjustSwitchPosition()');
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
            this._touchpadItem, this._CONF_touchpadEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
            this._trackpointItem, this._CONF_trackpointEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
            this._touchscreenItem, this._CONF_touchscreenEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
            this._fingertouchItem, this._CONF_fingertouchEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
            this._penItem, this._CONF_penEnabled);
    },

    _onChangeSwitchMethod: function() {
        logging('touchpadIndicatorButton._onChangeSwitchMethod()');
        let touchpad_enabled = this._CONF_touchpadEnabled;
        let old_method = this._CONF_switchMethod;
        let new_method = this.gsettings.get_enum('switchmethod');
        switch (old_method) {
            case METHOD.GCONF:
                this.touchpadgsettings.set_string('send-events', 'enabled');
                break;
            case METHOD.SYNCLIENT:
                this.synclient._enable();
                break;
            case METHOD.XINPUT:
                this.touchpadXinput._enable_all_devices();
                break;
        }
        this._switch_touchpad(touchpad_enabled);
    },

    _onMousePlugged: function() {
        logging('touchpadIndicatorButton._onMousePlugged()');
        if (this._CONF_autoSwitchTouchpad ||
                (this._CONF_autoSwitchTrackpoint &&
                this.trackpoint.is_there_device)) {
            if (METHOD.SYNCLIENT == this._CONF_switchMethod) {
                let synclient_in_use = this.synclient.synclient_in_use;
                this.synclient._is_synclient_still_in_use();
                if (synclient_in_use != this.synclient.synclient_in_use) {
                    if (this.synclient.synclient_in_use) {
                        if (this.touchpadgsettings.get_string('send-events') != 'enabled') {
                            this.touchpadgsettings.set_string('send-events', 'enabled');
                        }
                        this.synclient._watch();
                        if (this._CONF_touchpadEnabled) {
                            this.synclient._enable();
                        } else {
                            this.synclient._disable();
                        }
                    } else {
                        this.synclient._cancel();
                        this.gsettings.set_enum('switchmethod', METHOD.GCONF);

                        if ( this._CONF_touchpadEnabled ) {
                            this.touchpadgsettings.set_string('send-events', 'enabled');
                        } else {
                            this.touchpadgsettings.set_string('send-events', 'disabled');
                        }
            
                    }
                }
            }
            let is_mouse = Lib.list_mouses(true)[0];
            let note_tpd = false, tpd = !is_mouse;
            let note_tpt = false, tpt = !is_mouse;
            let notify = true;
            if (this._CONF_autoSwitchTouchpad) {
                note_tpd = true;
                if (is_mouse && this._CONF_touchpadEnabled) {
                    this._switch_touchpad(false);
                    tpd = false;
                } else if (!is_mouse && !this._CONF_touchpadEnabled) {
                    this._switch_touchpad(true);
                    tpd = true;
                } else {
                    notify = false;
                }
            }
            if (this._CONF_autoSwitchTrackpoint &&
                    this.trackpoint.is_there_device) {
                note_tpt = true;
                if (is_mouse && this.trackpoint._all_devices_enabled()) {
                    this._switch_trackpoint(false);
                    tpt = false;
                } else if (!is_mouse &&
                        !this.trackpoint._all_devices_enabled()) {
                    this._switch_trackpoint(true);
                    tpt = true;
                } else {
                    notify = false;
                }
            }
            let content;
            if ((note_tpd && !tpd) || (note_tpt && !tpt)) {
                content = _("Mouse plugged in - ");
            } else {
                content = _("Mouse unplugged - ");
            }
            if (note_tpd && note_tpt) {
                if (tpd && tpt) {
                    content = content + _("touchpad and trackpoint enabled");
                } else {
                    content = content + _("touchpad and trackpoint disabled");
                }
            } else if (note_tpd && !note_tpt) {
                if (tpd) {
                    content = content + _("touchpad enabled");
                } else {
                    content = content + _("touchpad disabled");
                }
            } else if (!note_tpd && note_tpt) {
                if (tpt) {
                    content = content + _("trackpoint enabled");
                } else {
                    content = content + _("trackpoint disabled");
                }
            }
            logging('touchpadIndicatorButton._onMousePlugged(Notification('
                + notify +'): '+ content +')');
            if (notify)
                this._notify(false, content);
	    }
    },

    _load_excluded_mouses: function() {
        ALL_OTHERS = Lib.load_excluded_mouses(this._CONF_excludedMouses);
    },

    _excluded_mouses_changed: function() {
        this._loadConfig();
        this._load_excluded_mouses();
    },

    _notify: function(title, content) {
        if (this._CONF_showNotifications)
            notify(this, title, content);
    },

    _is_device_enabled: function() {
        logging('touchpadIndicatorButton._is_device_enabled()');
        hits = 0;
        if (METHOD.GCONF == this._CONF_switchMethod || 
                METHOD.SYNCLIENT == this._CONF_switchMethod) {
            if (this._CONF_touchpadEnabled) {
                logging('touchpadIndicatorButton._is_device_enabled(Found an '
                + 'enabled Touchpad)');
                hits++;
            }
        } else if (METHOD.XINPUT == this._CONF_switchMethod) {
            if (this.touchpadXinput.is_there_device && 
                    this._CONF_touchpadEnabled) {
                logging('touchpadIndicatorButton._is_device_enabled(Found an '
                + 'enabled Touchpad)');
                hits++;
            }
        }
        if (this.trackpoint.is_there_device && this._CONF_trackpointEnabled) {
            logging('touchpadIndicatorButton._is_device_enabled(Found an '
                + 'enabled Trackpoint)');
            hits++;
        }
        if (this.touchscreen.is_there_device &&
                this._CONF_touchscreenEnabled) {
            logging('touchpadIndicatorButton._is_device_enabled(Found an '
                + 'enabled Touchscreen)');
            hits++;
        }
        if (this.fingertouch.is_there_device &&
                this._CONF_fingertouchEnabled) {
            logging('touchpadIndicatorButton._is_device_enabled(Found an '
                + 'enabled Fingertouch)');
            hits++;
        }
        if (this.pen.is_there_device && this._CONF_penEnabled) {
            logging('touchpadIndicatorButton._is_device_enabled(Found an '
                + 'enabled Pen)');
            hits++;
        }
        if (Lib.list_mouses(true)[0]) {
            logging('touchpadIndicatorButton._is_device_enabled(Found an '
                + 'enabled Mouse)');
            hits++;
        }
        if (hits > 1) {
            logging('touchpadIndicatorButton._is_device_enabled(Found an other'
                + ' enabled Device)');
            return true;
        } else {
            logging('touchpadIndicatorButton._is_device_enabled(No other '
                + 'enabled Device)');
            return false;
        }
    },

    _confirm: function(doIt) {
        if(!this._is_device_enabled()) {
            new ConfirmDialog(doIt, function() {
                    touchpadIndicator._adjustSwitchPosition();
                }).open();
        } else {
            doIt();
        }
    },

    _switch_touchpad: function(state) {
        logging('touchpadIndicatorButton._switch_touchpad('+ state.toString() 
            +')');
        this.gsettings.set_boolean('touchpad-enabled', state);
    },

    _touchpad_changed: function() {
        logging('touchpadIndicatorButton._touchpad_changed()');
        this._loadConfig();
        let state;
        switch (this._CONF_switchMethod) {
            case METHOD.GCONF:
                if (this._CONF_touchpadEnabled && this.touchpadgsettings.get_string('send-events') == "disabled" ) {
                    this.touchpadgsettings.set_string('send-events',"enabled");
                } else if (!this._CONF_touchpadEnabled && this.touchpadgsettings.get_string('send-events') == "enabled" ) {
                    this.touchpadgsettings.set_string('send-events',"disabled") ;
                }
                state = this._CONF_touchpadEnabled;
                break;
            case METHOD.SYNCLIENT:
                state = this.synclient._switch(this._CONF_touchpadEnabled);
                break;
            case METHOD.XINPUT:
                state = this.touchpadXinput._switch_all_devices(
                    this._CONF_touchpadEnabled);
                if (!this.touchpadXinput.is_there_device)
                    state = true;
                break;
        }
        this._onChangeIcon();
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
            call(this._touchpadItem, state);
        if (state != this._CONF_touchpadEnabled) {
            logging('touchpadIndicatorButton._touchpad_changed() - Error');
            this.gsettings.set_boolean('touchpad-enabled', state);
        }
    },


    _possible_touchpad_changed: function() {
        logging('touchpadIndicatorButton._possible_touchpad_changed()');
        this._loadConfig();
        let enabled = this._CONF_touchpadEnabled;
        this._switch_touchpad(true);
        if (this._CONF_possibleTouchpad != "-") {
            ALL_TOUCHPADS[TOUCHPADS.length] =
                this._CONF_possibleTouchpad.toLowerCase();
        } else {
            ALL_TOUCHPADS = TOUCHPADS.slice();
        }
        this.touchpadXinput = new XInput.XInput(ALL_TOUCHPADS);
        if (this.touchpadXinput.is_there_device && !enabled)
            this._switch_touchpad(false);
    },

    _switch_trackpoint: function(state) {
        logging('touchpadIndicatorButton._switch_trackpoint('+ state.toString() 
            +')');
        this.gsettings.set_boolean('trackpoint-enabled', state);
    },

    _trackpoint_changed: function() {
        logging('touchpadIndicatorButton._trackpoint_changed()');
        this._loadConfig();
        let state = this.trackpoint._switch_all_devices(
            this._CONF_trackpointEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
            call(this._trackpointItem, state);
        if (state != this._CONF_trackpointEnabled)
            this.gsettings.set_boolean('trackpoint-enabled', state);
    },

    _switch_touchscreen: function(state) {
        logging('touchpadIndicatorButton._switch_touchscreen('+ state.toString() 
            +')');
        this.gsettings.set_boolean('touchscreen-enabled', state);
    },

    _touchscreen_changed: function() {
        logging('touchpadIndicatorButton._touchscreen_changed()');
        this._loadConfig();
        let state = this.touchscreen._switch_all_devices(
            this._CONF_touchscreenEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
            call(this._touchscreenItem, state);
        if (state != this._CONF_touchscreenEnabled)
            this.gsettings.set_boolean('touchscreen-enabled', state);
    },

    _switch_fingertouch: function(state) {
        logging('touchpadIndicatorButton._switch_fingertouch('+ state.toString() 
            +')');
        this.gsettings.set_boolean('fingertouch-enabled', state);
    },

    _fingertouch_changed: function() {
        logging('touchpadIndicatorButton._fingertouch_changed()');
        this._loadConfig();
        let state = this.fingertouch._switch_all_devices(
            this._CONF__fingertouchEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
            call(this._fingertouchItem, state);
        if (state != this._CONF__fingertouchEnabled)
            this.gsettings.set_boolean('fingertouch-enabled', state);
    },

    _switch_pen: function(state) {
        logging('touchpadIndicatorButton._switch_pen('+ state.toString() 
            +')');
        this.gsettings.set_boolean('pen-enabled', state);
    },

    _pen_changed: function() {
        logging('touchpadIndicatorButton._pen_changed()');
        this._loadConfig();
        let state = this.pen._switch_all_devices(this._CONF_penEnabled);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
            call(this._penItem, state);
        if (state != this._CONF_penEnabled)
            this.gsettings.set_boolean('pen-enabled', state);
    },

    _connect_signals: function() {
        this.signal_firstTime = this.gsettings.connect(
            "changed::first-time", Lang.bind(this, this._loadConfig));
        this.signal_touchpadEnabled = this.gsettings.connect(
            "changed::touchpad-enabled",
            Lang.bind(this, this._touchpad_changed));
		this.signal_trackpointEnabled = this.gsettings.connect(
            "changed::trackpoint-enabled",
            Lang.bind(this, this._trackpoint_changed));
        this.signal_touchscreenEnabled = this.gsettings.connect(
            "changed::touchscreen-enabled",
            Lang.bind(this, this._touchscreen_changed));
		this.signal_fingertouchEnabled = this.gsettings.connect(
            "changed::fingertouch-enabled",
            Lang.bind(this, this._fingertouch_changed));
		this.signal_penEnabled = this.gsettings.connect(
            "changed::pen-enabled", Lang.bind(this, this._pen_changed));
        this.signal_autoSwitchTouchpad = this.gsettings.connect(
            "changed::autoswitch-touchpad", Lang.bind(this,
            this._loadConfig));
        this.signal_autoSwitchTrackpoint = this.gsettings.connect(
            "changed::autoswitch-trackpoint", Lang.bind(this,
            this._loadConfig));
        this.signal_showNotifications = this.gsettings.connect(
            "changed::show-notifications", Lang.bind(this, this._loadConfig));
        this.signal_debug = this.gsettings.connect(
            "changed::debug", Lang.bind(this, this._loadConfig));
        this.signal_debugToFile = this.gsettings.connect(
            "changed::debugtofile", Lang.bind(this, this._loadConfig));
        this.signal_switchMethod = this.gsettings.connect(
            "changed::switchmethod",
            Lang.bind(this, this._onChangeSwitchMethod));
        this.signal_possibleTouchpad = this.gsettings.connect(
            "changed::possible-touchpad", Lang.bind(this,
            this._possible_touchpad_changed));
        this.signal_excludedMouses = this.gsettings.connect(
            "changed::excluded-mouses", Lang.bind(this,
            this._excluded_mouses_changed));
        this.signal_showPanelIcon = this.gsettings.connect(
            "changed::show-panelicon", Lang.bind(this,
            this._panelIconChanged));

        this.signal_touchpadEnabledGconf = this.touchpadgsettings.connect(
            'changed::send-events', onSwitchGconf);
        this.watch_mouse = Lib.watch_mouse();
        this.signal_watchMouse = this.watch_mouse.connect('changed',
            onMousePlugged);
        if (this._CONF_switchMethod == METHOD.SYNCLIENT)
            this.synclient._watch();
    },

    _disconnect_signals: function() {
        this.gsettings.disconnect(this.signal_firstTime);
        this.gsettings.disconnect(this.signal_touchpadEnabled);
        this.gsettings.disconnect(this.signal_trackpointEnabled);
        this.gsettings.disconnect(this.signal_touchscreenEnabled);
        this.gsettings.disconnect(this.signal_fingertouchEnabled);
        this.gsettings.disconnect(this.signal_penEnabled); 
        this.gsettings.disconnect(this.signal_autoSwitchTouchpad); 
        this.gsettings.disconnect(this.signal_autoSwitchTrackpoint); 
        this.gsettings.disconnect(this.signal_showNotifications); 
        this.gsettings.disconnect(this.signal_debug); 
        this.gsettings.disconnect(this.signal_debugToFile); 
        this.gsettings.disconnect(this.signal_switchMethod); 
        this.gsettings.disconnect(this.signal_possibleTouchpad); 
        this.gsettings.disconnect(this.signal_excludedMouses); 
        this.gsettings.disconnect(this.signal_showPanelIcon);  

        this.touchpadgsettings.disconnect(this.signal_touchpadEnabledGconf);
        this.watch_mouse.disconnect(this.signal_watchMouse);
        this.watch_mouse.cancel();
        this.synclient._cancel();
    }
});


let touchpadIndicator;

function onMenuSelect(actor, event) {
    logging('onMenuSelect: actor - "'+actor.toString()+'"');
    switch (actor.tag) {
        case 0:
            if (actor.state) {
                touchpadIndicator._switch_touchpad(true);
            } else {
                touchpadIndicator._confirm(function() {
                        touchpadIndicator._switch_touchpad(false);
                    });
            }
            break;
        case 1:
            if (actor.state) {
                touchpadIndicator._switch_trackpoint(true);
            } else {
                touchpadIndicator._confirm(function() {
                        touchpadIndicator._switch_trackpoint(false);
                    });
            }
            break;
        case 2:
            if (actor.state) {
                touchpadIndicator._switch_touchscreen(true);
            } else {
                touchpadIndicator._confirm(function() {
                        touchpadIndicator._switch_touchscreen(false);
                    });
            }
        case 3:
            if (actor.state) {
                touchpadIndicator._switch_fingertouch(true);
            } else {
                touchpadIndicator._confirm(function() {
                        touchpadIndicator._switch_fingertouch(false);
                    });
            }
            break;
        case 4:
            if (actor.state) {
                touchpadIndicator._switch_pen(true);
            } else {
                touchpadIndicator._confirm(function() {
                        touchpadIndicator._switch_pen(false);
                    });
            }
            break;
    }
};

function onSwitchGconf() {
    logging('onSwitchGconf()');

    if (touchpadIndicator.touchpadgsettings.get_string('send-events') == "disabled" ) {
        if (touchpadIndicator.gsettings.get_enum('switchmethod') != METHOD.GCONF) {
            touchpadIndicator.gsettings.set_boolean('touchpad-enabled', state);
        }
    }
    
};

function onMousePlugged(filemonitor, file, other_file, event_type) {
    logging('onMousePlugged('+ file.get_path() +', '+ event_type +')');
    if (event_type > 1 && event_type < 4 
            && !(file.get_path().toLowerCase().indexOf('mouse') == -1)) {
        touchpadIndicator._onMousePlugged();
    }
};


// Put your extension initialization code here
function init(metadata) {
    logging('init()');
    Convenience.initTranslations('touchpad-indicator@orangeshirt');
    // Only for Gnome-Shell 3.5 and higher use own icons
    if (currentArray[0] == 3 && currentArray[1] > 4) {
        let theme = imports.gi.Gtk.IconTheme.get_default();
        theme.append_search_path(metadata.path + '/icons');
    }
};

function enable() {
    logging('enable()');
    touchpadIndicator = new touchpadIndicatorButton;
    Main.panel.addToStatusArea('touchpad-indicator', touchpadIndicator);

    if(touchpadIndicator.gsettings.get_boolean("first-time"))
        TIMEOUT_SETTINGSDIALOG = Mainloop.timeout_add(3000,
            Lang.bind(this, function() {
                TIMEOUT_SETTINGSDIALOG = false;
                Lib.execute_async('gnome-shell-extension-prefs ' + Me.uuid);
                touchpadIndicator.gsettings.set_boolean("first-time", false);
            }));
};

function disable() {
    logging('disable()');
    if (TIMEOUT_SETTINGSDIALOG) {
        Mainloop.source_remove(TIMEOUT_SETTINGSDIALOG);
        TIMEOUT_SETTINGSDIALOG = false;
    }
    touchpadIndicator._disconnect_signals();
    touchpadIndicator.destroy();
};

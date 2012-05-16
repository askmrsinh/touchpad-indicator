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
const Conf = imports.misc.config;

const ExtensionSystem = imports.ui.extensionSystem;

let currentArray = Conf.PACKAGE_VERSION.split('.');
if (currentArray[0] == 3 && currentArray[1] < 3) {
    var ExtensionMeta = ExtensionSystem.extensionMeta[
                                            "touchpad-indicator@orangeshirt"];
    var ExtensionPath = ExtensionMeta.path
} else {
    const Extension = imports.misc.extensionUtils.getCurrentExtension();
    var ExtensionMeta = Extension.metadata
    var ExtensionPath = Extension.path
}

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

// Debug Mode
var DEBUG = false;
const FORCE_DEBUG = false;
var DEBUG_INFO = 'Extension '+ ExtensionMeta.name.toString() +': ';

// Disable Synclient manually to prevent errors
const DISABLE_SYNCLIENT = false;


function logging(message) {
    if (DEBUG || FORCE_DEBUG)
        global.log(DEBUG_INFO + message);
};

function getSettings(schema) {
    return new Gio.Settings({ schema: schema });
};

function execute_sync(command) {
    try {
        return GLib.spawn_command_line_sync(command);
    } catch (err) {
        logging(err.message.toString());
        return false;
    }
};

function execute_async(command) {
    try {
        return GLib.spawn_command_line_async(command);
    } catch (err) {
        logging(err.message.toString());
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
    return false;
};

function search_mouse(where) {
    logging('search_mouse()');
    where = where.toString().toLowerCase().split("\n");
    let hits = 0;
    for (let x = 0; x < where.length; x++) {
        if (!(where[x].indexOf('pointer') == -1) &&
                where[x].indexOf('virtual core') == -1) {
            for (let tpd = 0; tpd < TOUCHPADS.length; tpd++) {
                if (!(where[x].indexOf(TOUCHPADS[tpd].toString()) == -1)) {
                    hits++;
                    logging('search_mouse(): Touchpad found: '+ where[x]);
                    break;
                }
            }
            for (let tpt = 0; tpt < TRACKPOINTS.length; tpt++) {
                if (!(where[x].indexOf(TRACKPOINTS[tpt].toString()) == -1)) {
                    hits++;
                    logging('search_mouse(): Trackpoint found: '+ where[x]);
                    break;
                }
            }
            if (hits == 0) {
                logging('search_mouse(): Mouse found: '+ where[x]);
                return true;
            } else {
                hits = 0;
            }
        }
    }
    logging( 'search_mouse(): Could not detect a mouse ');
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


function SettingsContainer() {
	this._init();
};

SettingsContainer.prototype = {
	_init: function() {
        logging('SettingsContainer._init()');
		this._connector = {};
		
		this._conf = {};
		this.set_boolean = this._take_data;
		this.set_double = this._take_data;
		this.set_int = this._take_data;
		this.set_enum = this._take_data;

		this._file = Gio.file_new_for_path(ExtensionPath + '/settings.json');
		
		if(this._file.query_exists(null)) {
			[flag, data] = this._file.load_contents(null);
			
			if(flag)
				this._conf = JSON.parse(data);
			else {
                logging('SettingsContainer._init(): Something is wrong... I '+
                    'was not able to load the settings... I will ignore that '+
                    'and get you the default-settings instead.');
				this.restoreDefault();
			}
			//no error: I want to be able to save it anyway
			this._error = false;
		}
		else {
			logging('SettingsContainer._init(): Uh, there are no settings '+
                'saved for that Box. I will get you the default settings '+
                'instead.');
			this.restoreDefault();
		}
	},
	
	get_boolean: function(k) {
		return this._conf[k] || false;
	},

	get_double: function(k) {
		return this._conf[k] || 0;
	},

	get_int: function(k) {
		return parseInt(this._conf[k]);
	},

	get_enum: function(k) {
		return this._conf[k] || 0;
	},
	
	_take_data: function(k, v, noEmit) {
        logging('SettingsContainer._take_data():  "'+ k.toString() +
            '" value "'+ v.toString() +'"');
		this._conf[k] = v;
		if(!noEmit) {
			this.save_data();
			this.emit(k);
		}
	},
	
	restoreDefault: function() {
		this._conf = {};
		
		let file = Gio.file_new_for_path(ExtensionPath + '/default.json');
		if(file.query_exists(null)) {
			[flag, data] = file.load_contents(null);
			if(flag) {
				this._conf = JSON.parse(data);
				this._error = false;
			}
			else {
				logging('SettingsContainer.restoreDefault(): Something is '+
                    'terribly wrong! I was not able to load the default '+
                    'settings... I won`t save anything in this session. And '+
                    'don`t blame me, if touchpad-indicator is acting '+
                    'strangely...');
				this._error = true;
			}
		}
		else {
			logging('SettingsContainer.restoreDefault(): Something is '+
                'terribly wrong! Neither your settings nor the default '+
                'settings seem to exist... I won´t save anything in this '+
                'session. And don´t blame me, if touchpad-indicator is '+
                'acting strangely...');
			this._error = true;
		}
		this.save_data();
	},

	_restore_backup: function(b) {
		this._conf = b;
		this.save_data();
	},

	save_data: function() {
		if(!this._error) {
			this._file.replace_contents(JSON.stringify(this._conf), null,
                false, 0, null);
            logging('SettingsContainer._save_data(): Done');
		} else {
            test = "bla";
			logging('SettingsContainer._save_data(): I really want to save '+
                'that. But there was an error before...');
        }
	},

	_get_backup: function() {
		let copy={};
		for(let k in this._conf) {
			copy[k] = this._conf[k];
		};
		return copy;
	},
	
	
	connect: function(k, f) {
		this._connector[k] = f;
	},

	disconnect: function(k) {
		delete this._connector[k];
	},

	emit: function(k) {
		if(this._connector[k])
			this._connector[k](k, this._conf[k]);
	}
};


function Synclient(settings) {
    this._init(settings);
};

Synclient.prototype = {
    _init: function(settings) {
        logging('Synclient._init()');
        this.settings = settings
        this.synclient_status = false;
        this.stop = false;
        this.watch = false;
        this.timeout = false;
        this.synclient_in_use = this._is_synclient_in_use();
    },

    _is_synclient_in_use: function() {
        if (DISABLE_SYNCLIENT) {
            logging('Synclient._is_synclient_in_use(): synclient manually '+
                'disabled');
            return false;
        }
        this.output = execute_sync('synclient -l');
        if (!this.output) {
            logging('Synclient._is_synclient_in_use(): synclient not found');
            return false;
        }
        if (!this.output[0]) {
            logging('Synclient._is_synclient_in_use(): synclient not found');
            return false;
        }
        for (let x = 0; x < this.output.length; x++) {
            if (typeof(this.output[x]) == "object" && 
                    this.output[x].length > 0) {
                 if (!(this.output[x].toString().indexOf(
                        "Couldn't find synaptics properties") == -1)) {
                    logging('Synclient._is_synclient_in_use(): no properties '+
                        'found');
                    return false;
                }
                if (!(this.output[x].toString().indexOf(
                        "TouchpadOff") == -1)) {
                    logging('Synclient._is_synclient_in_use(): synclient '+
                        'found and in use');
                    return true;
                }
            }
        }
        logging('Synclient.__is_synclient_in_use(): unknown situation - '+
            'Return false');
        return false;
    },

    _is_synclient_still_in_use: function() {
        this.synclient_in_use = this._is_synclient_in_use();
        return this.synclient_in_use;
    },

    _watch: function() {
        if (!this.stop && !this.wait) {
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
                    state = !to_boolean(parts[1]);
                    logging('Synclient._watch: Touchpad state changed to '+
                        state.toString());
                    this.settings.set_boolean('touchpad-enabled', state);
                    onChangeIcon(false);                    
                    this.synclient_status = this.touchpad_off;
                    this._wait();
                }
            }
        }
    },

    _call_watch: function() {
        this.wait = false;
        this._watch();
    },

    _wait: function() {
        this.wait = true;
        this.timeout = Mainloop.timeout_add(1000, Lang.bind(
            this, this._call_watch));
    },

    _cancel: function() {
        logging('Synclient._cancel()');
        this.stop = true;
        this.wait = false;
        this.synclient_status = false;
        if (this.timeout) {
            Mainloop.source_remove(this.timeout);
            this.timeout = false;
        }
    },

    _disable: function() {
        logging('Synclient._disable()');
        this._cancel();
        if (execute_async('synclient TouchpadOff=1')) {
            this.stop = false;
            this._watch();
            return true;
        } else
            return false;
    },

    _enable: function() {
        logging('Synclient._enable()');
        this._cancel();
        if (execute_async('synclient TouchpadOff=0')) {
            this.stop = false;
            this._watch();
            return true;
        } else
            return false;
    }
};


function TrackpointXInput() {
    this._init();
};

TrackpointXInput.prototype = {
    _init: function() {
        logging('TrackpointXInput._init()');
        this.ids = this._get_ids();
        this.is_there_trackpoint = this._is_there_trackpoint();
        logging('Found Trackpoint - ' + this.is_there_trackpoint.toString());
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
        logging('TrackpointXInput_set_trackpoint_enabled()');
        return execute_async('xinput set-prop ' + id.toString() +
            ' "Device Enabled" 1');
    },

    _set_trackpoint_disabled: function(id) {
        logging('TrackpointXInput._set_trackpoint_disabled()');
        return execute_async('xinput set-prop ' + id.toString() +
            ' "Device Enabled" 0');
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
        logging('TrackpointXInput._is_trackpoint_enabled()');
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
        logging('touchpadIndicatorButton._init()');
        this.settings =	new SettingsContainer();
        this._loadConfig();

        this.touchpad = getSettings(TOUCHPAD_SETTINGS_SCHEMA);
        this.trackpoint = new TrackpointXInput();
        this.synclient = new Synclient(this.settings);
        this.xinput_is_installed = execute_sync('xinput --list');

        if (!this.xinput_is_installed) {
            logging('touchpadIndicatorButton._init(): Can`t find Xinput');
            this.settings.set_boolean('switch-if-mouse', false);
            this.settings.set_boolean('auto-switch-touchpad', false);
            this.settings.set_boolean('auto-switch-trackpoint', false);
        } else {
            logging('touchpadIndicatorButton._init(): Xinput is installed');
        }

        if (this.synclient.synclient_in_use) {
            if (!this.touchpad.get_boolean('touchpad-enabled'))
                this.touchpad.set_boolean('touchpad-enabled', true);
            if (this._CONF_tochpadEnabled) {
                this.synclient._enable();
            } else {
                this.synclient._disable();
            }
        }

        if (!this._CONF_trackpointEnabled)
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
        if (!this.xinput_is_installed) {
            this._LabelItem = new St.Label({ 
                text: _("No Settings available.\n\
If you want to use the Auto Switch function while a mouse is (un)plugged,\n\
you have to install 'xinput' and reload the extension.") });
        } else {
            this._LabelItem = new St.Label({ 
                text: _("Behaviour if a mouse is (un)plugged:") });
        }
        this._AutoSwitchTouchpadItem = new PopupSwitchMenuItem(
            _("Automatically switch Touchpad On/Off"), 6,
            this._CONF_autoSwitchTouchpad, onMenuSelect);
        this._AutoSwitchTrackpointItem = new PopupSwitchMenuItem(
            _("Automatically switch Trackpoint On/Off"), 7,
            this._CONF_autoSwitchTrackpoint, onMenuSelect);
        this._ShowNotifications = new PopupSwitchMenuItem(
            _("Show notification if switched"), 8,
            this._CONF_showNotifications, onMenuSelect);
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
        if (this.xinput_is_installed) {
            this._ExtensionSettingsItem.menu.addMenuItem(
                this._AutoSwitchTouchpadItem);
            if (this.trackpoint.is_there_trackpoint)
                this._ExtensionSettingsItem.menu.addMenuItem(
                    this._AutoSwitchTrackpointItem);
            this._ExtensionSettingsItem.menu.addMenuItem(
                this._ShowNotifications);
        }
        this.menu.addMenuItem(this._SettingsItem);
        this._SettingsItem.menu.addMenuItem(this._ClickToTapItem);
        this._SettingsItem.menu.addMenuItem(this._ScrollItem);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemDisable);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemEdge);
        this._ScrollItem.menu.addMenuItem(this._ScrollItemTwoFinger);
        this._SettingsItem.menu.addSettingsAction(_("Additional Settings ..."),
            'gnome-mouse-panel.desktop');

        this._onMousePlugged();
        this._onChangeIcon(false);
        this._onSwitchScrollMethod();
        this._connect_signals();
        this._connectConfig();
    },

    _loadConfig: function() {
        this._CONF_firstTime = this.settings.get_boolean('first-time');
		this._CONF_tochpadEnabled = this.settings.get_boolean(
            'touchpad-enabled');
		this._CONF_trackpointEnabled = this.settings.get_boolean(
            'trackpoint-enabled');
		this._CONF_switchIfMouse = this.settings.get_boolean(
            'switch-if-mouse');
		this._CONF_autoSwitchTouchpad = this.settings.get_boolean(
            'auto-switch-touchpad');
		this._CONF_autoSwitchTrackpoint = this.settings.get_boolean(
            'auto-switch-trackpoint');
        this._CONF_showNotifications = this.settings.get_boolean(
            'show-notifications');
        DEBUG = this._CONF_debug = this.settings.get_boolean('debug');
	},

    _connectConfig: function() {
        //this are not real connections
        this.settings.connect('touchpad-enabled', Lang.bind(this,
            this._loadConfig));
		this.settings.connect('trackpoint-enabled', Lang.bind(this,
            this._loadConfig));
		this.settings.connect('switch-if-mouse', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('auto-switch-touchpad', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('auto-switch-trackpoint', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('show-notifications', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('debug', Lang.bind(this, this._loadConfig));
    },

    _onChangeIcon: function(write_setting) {
        logging('touchpadIndicatorButton._onChangeIcon()');
        if (!this._touchpad_enabled()) {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(this,
                'touchpad-disabled');
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                this._touchpadItem, false);
            if (write_setting !== undefined && write_setting)
                this.settings.set_boolean('touchpad-enabled', false);
        } else {
            PanelMenu.SystemStatusButton.prototype.setIcon.call(this,
                'input-touchpad');
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.call(
                this._touchpadItem, true);
            if (write_setting !== undefined && write_setting)
                this.settings.set_boolean('touchpad-enabled', true);
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
        logging('touchpadIndicatorButton._onMousePlugged()');
        if (this._CONF_switchIfMouse) {
            synclient_in_use = this.synclient.synclient_in_use;
            this.synclient._is_synclient_still_in_use();
            if (synclient_in_use != this.synclient.synclient_in_use) {
                if (this.synclient.synclient_in_use) {
                    if (!this.touchpad.get_boolean('touchpad-enabled'))
                        this.touchpad.set_boolean('touchpad-enabled', true);
                    this.synclient._watch();
                    if (this._CONF_tochpadEnabled) {
                        this.synclient._enable();
                    } else {
                        this.synclient._disable();
                    }
                } else {
                    this.synclient._cancel();
                    if (this._CONF_tochpadEnabled) {
                        this.touchpad.set_boolean('touchpad-enabled', true);
                    } else {
                        this.touchpad.set_boolean('touchpad-enabled', false);
                    }
                }
            }
            let is_mouse = is_there_mouse();
            let note_tpd = false, tpd = !is_mouse;
            let note_tpt = false, tpt = !is_mouse;
            if (this._CONF_autoSwitchTouchpad) {
                note_tpd = true;
                if (is_mouse && this._touchpad_enabled()) {
                    this._disable_touchpad();
                    tpd = false;
                } else if (!is_mouse && !this._touchpad_enabled()) {
                    this._enable_touchpad();
                    tpd = true;
                }
            }
            if (this._CONF_autoSwitchTrackpoint && 
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
            logging(content);
            this._notify(false, content);
	    }
    },

    _notify: function(title, content) {
        if (this._CONF_showNotifications)
            notify(this, title, content);
    },

    _disable_touchpad: function() {
        logging('touchpadIndicatorButton._disable_touchpad()');
        if (this.synclient.synclient_in_use) {
            if (this.synclient._disable()) {
                this.settings.set_boolean('touchpad-enabled', false);
                this._onChangeIcon(false);
                return true;
            } else {
                return false;
            }
        } else {
            if (this.touchpad.set_boolean('touchpad-enabled', false)) {
                return true;
            } else {
                return false;
            }
        }
    },

    _enable_touchpad: function() {
        logging('touchpadIndicatorButton._enable_touchpad()');
        if (this.synclient.synclient_in_use) {
            if (this.synclient._enable()) {
                this.settings.set_boolean('touchpad-enabled', true);
                this._onChangeIcon(false);
                return true;
            } else {
                return false;
            }
        } else {
            if (this.touchpad.set_boolean('touchpad-enabled', true)) {
                return true;
            } else {
                return false;
            }
        }
    },

    _disable_auto_switch_touchpad: function() {
        this.settings.set_boolean('auto-switch-touchpad', false);
        if (!this._CONF_autoSwitchTrackpoint)
            this.settings.set_boolean('switch-if-mouse', false);
    },

    _enable_auto_switch_touchpad: function() {
        this.settings.set_boolean('auto-switch-touchpad', true);
        this.settings.set_boolean('switch-if-mouse', true);
    },

    _touchpad_enabled: function() {
        if (this.synclient.synclient_in_use) {
            return this._CONF_tochpadEnabled;
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
            this.settings.set_boolean('trackpoint-enabled', false);
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
            this.settings.set_boolean('trackpoint-enabled', true);
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._trackpointItem, false);
            return false;
        }
    },

    _disable_auto_switch_trackpoint: function() {
        this.settings.set_boolean('auto-switch-trackpoint', false);
        if (!this._CONF_autoSwitchTouchpad)
            this.settings.set_boolean('switch-if-mouse', false);
    },

    _enable_auto_switch_trackpoint: function() {
        this.settings.set_boolean('auto-switch-trackpoint', true);
        this.settings.set_boolean('switch-if-mouse', true);
    },

    _switch_notification: function() {
        this.settings.set_boolean('show-notifications',
            !this._CONF_showNotifications);
        PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
            call(this._ShowNotifications, this._CONF_showNotifications);
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
        this.synclient._cancel();
    }
};


let touchpadIndicator;

function onMenuSelect(actor, event) {
    global.log(DEBUG_INFO + 'onMenuSelect: actor - "'+actor.toString()+'"');
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

function onChangeIcon(write_setting) {
    touchpadIndicator._onChangeIcon(write_setting);
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

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
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Pango = imports.gi.Pango;
const Lang = imports.lang;
const LayoutManager = Main.layoutManager;
const MessageTray = imports.ui.messageTray;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Conf = imports.misc.config;

const ExtensionSystem = imports.ui.extensionSystem;

//Why are functions renames without creating a deprecated pointer..?
//Workaround...
let currentArray = Conf.PACKAGE_VERSION.split('.');
if (currentArray[0] == 3 && currentArray[1] < 3) {
    var Extension = ExtensionSystem.extensions[
                       "touchpad-indicator@orangeshirt"];
    var ExtensionMeta = ExtensionSystem.extensionMeta[
                            "touchpad-indicator@orangeshirt"];
    var ExtensionPath = ExtensionMeta.path
    var cleanActor = function(o) {return o.destroy_children();};
} else {
    var Extension = imports.misc.extensionUtils.getCurrentExtension();
    var ExtensionMeta = Extension.metadata
    var ExtensionPath = Extension.path
    var cleanActor = function(o) {return o.destroy_all_children();};
}

const Gettext = imports.gettext.domain('touchpad-indicator@orangeshirt');
const _ = Gettext.gettext;

const TOUCHPADS = new Array('touchpad','glidepoint','fingersensingpad',
                            'bcm5974','trackpad');
var ALL_TOUCHPADS = TOUCHPADS.slice();
const TRACKPOINTS = new Array('trackpoint','accu point','trackstick',
                              'touchstyk','pointing stick','dualpoint stick');
const FINGER_TOUCHES = Array('finger touch');
const PENS = Array('pen stylus', 'pen eraser');
const OTHERS = new Array();
var ALL_OTHERS = OTHERS.slice();

// Methods to en- or disable the touchpad
const METHOD = {
    GCONF: 0,
    SYNCLIENT: 1,
    XINPUT: 2
};

// Settings
const TOUCHPAD_SETTINGS_SCHEMA = 
    'org.gnome.settings-daemon.peripherals.touchpad';

// Debug Mode Settings
var DEBUG = false; // overwritten by settings
const FORCE_DEBUG = false;
var DEBUG_TO_FILE = false; // overwritten by settings
var DEBUG_INFO = 'Extension '+ ExtensionMeta.name.toString() +': ';
var DEBUG_LOG_FILE = GLib.build_filenamev([ExtensionPath,
   'touchpad-indicator.log']);
var LOGS = "";

// Disable Synclient manually to prevent errors
var USE_SYNCLIENT = true;

var TIMEOUT_SETTINGSDIALOG = false;


function logging(message) {
    if (DEBUG || FORCE_DEBUG) {
        global.log(DEBUG_INFO + message);
        let timestamp = format_time(new Date(new Date().getTime()));
        message = timestamp + "    " + message + "\n";
        LOGS += message;
        if (DEBUG_TO_FILE) {
            GLib.file_set_contents(DEBUG_LOG_FILE, LOGS);
        }
    }
};

function format_time(d) {
    function pad(n) { return n < 10 ? '0' + n : n; }
    return d.getUTCFullYear()+'-'
        + pad(d.getUTCMonth()+1)+'-'
        + pad(d.getUTCDate())+'T'
        + pad(d.getUTCHours())+':'
        + pad(d.getUTCMinutes())+':'
        + pad(d.getUTCSeconds())+'Z';
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

function list_mouse_devices() {
    logging('list_mouse_devices()');
    let comp = execute_sync('cat /proc/bus/input/devices');
    if (comp) {
        let where = comp[1].toString().split("\n\n"),
            mouses = new Array(),
            name,
            hits = 0;
        for (let x = 0; x < where.length; x++) {
            if (!(where[x].indexOf('mouse') == -1)) {
                let data = where[x].toString().split("\n");
                for (let z = 0; z < data.length; z++) {
                    if (!(data[z].indexOf("N: Name=") == -1)) {
                        name = data[z].split("\"")[1];
                        logging('list_mouse_devices(): Device found: '
                            + name.toString());
                        mouses[hits] = name.toString();
                        hits++;
                    }
                }
            }
        }
        if (mouses[0]) {
            return [true, mouses];
        } else {
            logging('list_mouse_devices(): Could not detect a mouse device');
            return [false, _("    - No mouse device detected.") + "\n"];
        }
    }
    logging('list_mouse_devices(): Sorry "cat" has no output');
    return [false, _("    - No mouse device detected.") + "\n"];
};

function search_touchpads() {
    logging('search_touchpads()');
    where = list_mouse_devices();
    if (where[0]) {    
        where = where[1];
        let touchpads = "";
        let hits = 0;
        for (let x = 0; x < where.length; x++) {
            for (let tpd = 0; tpd < TOUCHPADS.length; tpd++) {
                if (!(where[x].toLowerCase().indexOf(
                        TOUCHPADS[tpd].toString()) == -1)) {
                    logging('search_touchpads(): Touchpad found: '
                        + where[x].toString());
                    if (hits > 0)
                        touchpads += " | ";
                    touchpads += where[x].toString();
                    hits++;
                }
            }
        }
        if (touchpads != "") {
            return [true, touchpads + "\n"];
        } else {
            logging('search_touchpads(): Could not detect a touchpad');
            return [false, _("No Touchpad detected.") + "\n"];
        }
    }
    logging('search_touchpads(): Sorry "cat" has no output');
    return [false, _("No Touchpad detected.") + "\n"];
};

function list_mouses(skip_excluded) {
    logging('list_mouses()');
    let where = list_mouse_devices(),
        mouses = new Array(false, []);
    if (where[0]) {    
        where = where[1];
        let hits = 0;
        for (let x = 0; x < where.length; x++) {
            for (let tpd = 0; tpd < TOUCHPADS.length; tpd++) {
                if (!(where[x].toLowerCase().indexOf(
                        TOUCHPADS[tpd].toString()) == -1)) {
                    logging('list_mouses(): Touchpad found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            for (let tpt = 0; tpt < TRACKPOINTS.length; tpt++) {
                if (!(where[x].toLowerCase().indexOf(
                        TRACKPOINTS[tpt].toString()) == -1)) {
                    logging('list_mouses(): Trackpoint found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            for (let tch = 0; tch < FINGER_TOUCHES.length; tch++) {
                if (!(where[x].toLowerCase().indexOf(
                        FINGER_TOUCHES[tch].toString()) == -1)) {
                    logging('list_mouses(): Fingertouch found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            for (let pen = 0; pen < PENS.length; pen++) {
                if (!(where[x].toLowerCase().indexOf(
                        PENS[pen].toString()) == -1)) {
                    logging('list_mouses(): Pen found: '
                        + where[x].toString());
                    hits++;
                    break;
                }
            }
            if (skip_excluded) {
                for (let oth = 0; oth < ALL_OTHERS.length; oth++) {
                    if (!(where[x].toLowerCase().indexOf(
                            ALL_OTHERS[oth].toString()) == -1)) {
                        hits++;
                        logging('list_mouses(): Other device to ignore'
                            + ' found: '+ where[x].toString());
                        break;
                    }
                }
            }
            if (hits == 0) {
                logging('list_mouses(): Mouse found: '
                    + where[x].toString());
                mouses[0] = true;
                mouses[1][mouses[1].length] = where[x].toString(); 
            } else {
                hits = 0;
            }
        }
    }
    if (!mouses[0])
        logging('list_mouses(): Could not detect a mouse ');
    return mouses;
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
        this.set_text = this._take_data;
        this.set_dict = this._take_data;

		this._file = Gio.file_new_for_path(ExtensionPath + '/settings.json');
		
		if(this._file.query_exists(null)) {
			[flag, data] = this._file.load_contents(null);
			
			if(flag)
				this._conf = JSON.parse(data);
			else {
                logging('SettingsContainer._init(): Something is wrong... I '
                    + 'was not able to load the settings... I will restore '
                    + 'the default settings instead.');
				this.restoreDefault();
			}
			//no error: I want to be able to save it anyway
			this._error = false;
		}
		else {
			logging('SettingsContainer._init(): Uh, there are no settings '
                + 'saved for that Box. I will use the default settings '
                + 'instead.');
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

	get_text: function(k) {
		return this._conf[k].toString();
	},

	get_dict: function(k) {
        if (this._conf[k].toString() == "") {
            this._conf[k] = {};
        }
		return this._conf[k];
	},
	
	_take_data: function(k, v, noEmit) {
        logging('SettingsContainer._take_data():  "'+ k.toString()
            + '" value "'+ v.toString() +'"');
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
				logging('SettingsContainer.restoreDefault(): Something is '
                    + 'terribly wrong! I was not able to load the default '
                    + 'settings... I won\'t save anything in this session. And '
                    + 'don\'t blame me, if touchpad-indicator is acting '
                    + 'strangely...');
				this._error = true;
			}
		}
		else {
			logging('SettingsContainer.restoreDefault(): Something is '
                + 'terribly wrong! Neither your settings nor the default '
                + 'settings seem to exist... I won\'t save anything in this '
                + 'session. And don\'t blame me, if touchpad-indicator is '
                + 'acting strangely...');
			this._error = true;
		}
		this.save_data();
	},

	_restore_backup: function(b) {
		this._conf = b;
		this.save_data();
        onLoadConfig();
	},

	save_data: function() {
		if(!this._error) {
			this._file.replace_contents(JSON.stringify(this._conf), null,
                false, 0, null);
            logging('SettingsContainer._save_data(): Done');
		} else {
			logging('SettingsContainer._save_data(): I really want to save '
                + 'that. But there was an error before...');
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


function SettingsDialog(indicator, chapter) {
	this._init(indicator, chapter);
};

SettingsDialog.prototype = {
	//ST.Entry are causing some strange "Fensterverwaltung-Warnung" after 
    //Dialog has closed and a popup is opened
	//no idea why or what they exactly mean.
	
	_init: function(indicator, chapter) {
        logging('SettingsDialog._init()');
        this._indicator = indicator
		this._settings = indicator.settings;
        this._touchpad = search_touchpads();
        this.monitorId = LayoutManager.primaryIndex;
		
		let monitor = LayoutManager.monitors[this.monitorId],
			padding = 10,
			boxWidth = Math.round(monitor.width/2),
			boxHeight = Math.round(monitor.height/2),
			naviWidth = 200,
			headerHeight = 40,
			descHeight = 50,
			
			mainBox = this.actor = new St.BoxLayout({
                style_class: "touchpadIndicator_dialog",
				vertical: true,
				x:Math.round((monitor.width - boxWidth)/2) + monitor.x,
				y:Math.round((monitor.height - boxHeight)/2) + monitor.y,
				width: boxWidth + padding*2,
				height: boxHeight + padding*2,
			}),
			navi = this._navi = new St.BoxLayout({style_class: "naviLine",
				vertical: true,
				x:padding,
				y:padding,
				width: naviWidth,
				height: boxHeight
			}),
			scrollBox = new St.ScrollView({style_class: "contentBox",
				x:naviWidth + padding,
				y:headerHeight + padding,
				width: boxWidth-naviWidth,
				height: boxHeight-headerHeight
			}),
			content = new St.BoxLayout({vertical: true}),
			closeButton = new St.Button({style_class: "dialog_button",
                label:"x", x: padding + boxWidth-50, y:padding});
			
		mainBox.add(navi);
		mainBox.add(scrollBox);
			scrollBox.add_actor(content);
				this._descline = new St.Label({style_class: "descLine"});
				this._descline.clutter_text.line_wrap = true;
				content.add(this._descline);
				
				let t = new PopupMenu.PopupMenuSection(content);
				this._group = new PopupMenu.PopupComboMenu(t);
				t.addActor(this._group.actor);
				content.add(t.actor);
		
		this._headline = new St.Label({style_class: "headerLine",
            x: naviWidth + padding, 
            y: padding, width: boxWidth - naviWidth, 
            height: headerHeight});
		mainBox.add(this._headline);
		
		closeButton.connect("button-release-event", Lang.bind(this,
            this.close));
		mainBox.add(closeButton);
		
		this._undoButton = new St.Button({ style_class: "dialog_button", 
            x: padding + boxWidth - 180,
            y: padding, reactive: true,
            can_focus: true, label: _("Undo")});
		this._undoButton.connect("button-release-event", Lang.bind(this,
            this.undoChanges));
		mainBox.add(this._undoButton);
		this._undoButton.hide();

		
		Main.uiGroup.add_actor(mainBox);

		this._chapters = [];
		this._addChapter(_("Welcome"),
            this._welcome, _("These settings allow you to customize this extension to your needs. You can open this dialog again by clicking on the extension's icon and selecting Indicator Settings.\n\
\n\
Please feel free to contact me if you find bugs or have suggestions, criticisms, or feedback. I am always happy to receive feedback - whatever kind. :-) \n\
\n\
Contact me on github (https://github.com/orangeshirt/gnome-shell-extension-touchpad-indicator) or on my bug tracker (https://extensions.gnome.org/extension/131/touchpad-indicator/)."));

		this._addChapter(_("General"), this._global, "");
		this._addChapter(_("Auto Switch"), this._auto_switch,
            _("Define the behaviour if a mouse is (un)plugged."));
        this._addChapter(_("Debug"), this._debug,
            _("Settings for debugging the extension."));
        this._addChapter(_("Debug Log"), this._debug_log,
            _("The debug log since last restart, if debugging is enabled."));
		if(!this._settings.get_boolean('first-time'))
            if (chapter) {
                this._setChapter(chapter);
            } else {
    			this._setChapter(1);
            }
		else {
			this._setChapter(0);
		}

		Main.pushModal(this.actor);
        this._oldSettings = this._settings._get_backup();
	},

	parseDouble: function(v) {
		return Math.round(v*1000)/1000;
	},

	undoChanges: function() {
        logging('SettingsDialog.undoChanges()');
        this._settings._restore_backup(this._oldSettings);
		this.close();
		new SettingsDialog(this._indicator, this._currentChapterNumber);
	},

	_addChapter: function(t, fu, desc) {
		let b = new St.Button({label: t});
		
		b.connect("button-release-event", Lang.bind(this,
            function(actor, event, c) {
				this._setChapter(c);
			}, this._chapters.length));
		
		this._navi.add(b, {x_fill: false, x_align: St.Align.START});
		
		this._chapters.push([b, t, desc, fu]);
	},

	_setChapter: function(i) {
		cleanActor(this._group.actor);
		let c = this._chapters[i];
		if(this._currentChapter)
			this._currentChapter.remove_style_pseudo_class("chosen");
		c[0].add_style_pseudo_class("chosen");
		this._headline.text = c[1];
		this._descline.text = c[2];
		this._currentChapter = c[0];
        this._currentChapterNumber = i;
		c[3].call(this);
	},
	
	_createDesc: function(t) {
		let l = new St.Label({style_class: "descLine", text: t});
		this._content.add(l);
	},
	
	_createItemLabel: function(section, title, desc) {
		let labelGroup = new St.BoxLayout({vertical: true}),
			label = new St.Label({style_class: "item_title", text: title});
		
		labelGroup.add(label);
		if(desc) {
			label = new St.Label({style_class: "item_desc", text: desc});
			label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
			
			label.clutter_text.line_wrap = true;
			labelGroup.add(label);
		}
		section.add(labelGroup, {expand:true});
	},

	_createSeparator: function() {
		this._group.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	},

    _createLabel: function(title, desc) {
		let section = new St.BoxLayout({vertical: false, style:"padding:5px"});

		this._createItemLabel(section, title, desc);
		this._group.addActor(section);
		
		return section;
	},

	_createButton: function(title, desc, label, doIt) {
		let settings = this._settings,
			section = new St.BoxLayout({vertical: false, 
                style:"padding: 5px"}),
			button = new St.Button(
                {style_class: "dialog_button touchpadIndicator_button",
                 reactive: true, can_focus: true, label: label});

		this._createItemLabel(section, title, desc);
		section.add(button, {y_fill:false});
		this._group.addActor(section, {x_fill: true});
		button.connect("button-release-event", Lang.bind(this, function() {
                this._undoButton.show();
                if(doIt)
					doIt();
			}));
	},

	_createCheckBox: function(desc, state, doIt) {
		let settings = this._settings,
			section = new St.BoxLayout({vertical: false, 
                style:"padding: 2px"}),
            space = new St.BoxLayout({vertical: false, 
                style:"padding-left: 30px"}),
			button = new St.Button(
                {style_class: "touchpadIndicator_checkBox",
                 reactive: true, can_focus: true, label: "X"}),
            button_empty = new St.Button(
                {style_class: "touchpadIndicator_checkBox_empty",
                 reactive: true, can_focus: true, label: " "}),
            labelGroup = new St.BoxLayout({vertical: true}),
			label = new St.Label(
                {style_class: "touchpadIndicator_checkBox_name", text: desc});
		labelGroup.add(label);

        section.add(space, {y_fill:false});
        section.add(button, {y_fill:false});
        section.add(button_empty, {y_fill:false});
        section.add(labelGroup, {expand:true});
		this._group.addActor(section, {x_fill: true});
        if (state) {
            button_empty.hide();
        } else {
            button.hide();
        }
		button.connect("button-release-event", Lang.bind(this, function() {
                this._undoButton.show();
                button.hide();
                button_empty.show()
                if(doIt)
					doIt(desc, false);
			}));
        button_empty.connect("button-release-event", Lang.bind(this, function() {
                this._undoButton.show();
                button.show();
                button_empty.hide()
                if(doIt)
					doIt(desc, true);
			}));
	},

	_createSwitch: function(switched, settingsUrl, title, desc, doIt) {
		let settings = this._settings,
			section = new St.BoxLayout({vertical: false, 
                style:"padding: 5px"}),
			button = new St.Button({reactive: true, can_focus: false}),
			switchObj = new PopupMenu.Switch(switched);
		
		this._createItemLabel(section, title, desc);
		button.set_child(switchObj.actor);
		section.add(button);
		this._group.addActor(section, {x_fill: true});
		
		button.connect("button-press-event", Lang.bind(this, function() {
				switchObj.toggle();
				this._undoButton.show();
				if(doIt)
					doIt(switchObj.state);
				settings.set_boolean(settingsUrl, switchObj.state);
			}));
		
		switchObj._mySection = section;
		return switchObj;
	},

	_createCombo: function(value, settingsUrl, items, title, desc, fu) {
		let settings = this._settings,
			section = new St.BoxLayout({vertical: false,
                style:"padding: 5px"}),
			combo = new PopupMenu.PopupComboBoxMenuItem({
                style_class: "touchpadIndicator_combo"});
			
		this._createItemLabel(section, title, desc);
		section.add(combo.actor, {y_fill:false});
		this._group.addActor(section, {x_fill: true});
		
		items.forEach(function(o) {
				let item = new PopupMenu.PopupMenuItem(_(o[0]));
				combo.addMenuItem(item, o[1]);
			});
		combo.setActiveItem(value);
		combo.connect("active-item-changed",
            Lang.bind(this, fu || function(menuItem, id) {
			    this._undoButton.show();
			    settings.set_enum(settingsUrl, id);
			    if(fu)
				    fu();
		    })
        );	
	},

	_welcome: function() {
        logging('SettingsDialog._welcome()');
		this._createSwitch(this._indicator._CONF_firstTime, 'first-time',
			_("First time startup"));
        if (!this._touchpad[0]) {
            this._createSeparator();
            this._createLabel(_("Attention - No Touchpad Detected"),
                _("The extension could not detect a touchpad at the moment.\nYou'll find further information in the Debug section."));
        }
	},

	_global: function() {
        logging('SettingsDialog._global()');
		let settings = this._settings;
        let indicator = this._indicator;
        let items = [], methods = [], number;
        let switch_to = 0;
        items[0] = [_("Gconf Settings"), 0];
        methods[0] = METHOD.GCONF;
        if (indicator._CONF_switchMethod == METHOD.GCONF)
            switch_to = 0;
        if (indicator.synclient.synclient_in_use) {
            number = items.length;
            items[number] = [_("Synclient"), number];
            methods[number] = METHOD.SYNCLIENT;
            if (indicator._CONF_switchMethod == METHOD.SYNCLIENT)
                switch_to = number;
        }      
        if (indicator.xinput_is_installed) {
            number = items.length;
            items[number] = [_("Xinput"), number];
            methods[number] = METHOD.XINPUT;
            if (indicator._CONF_switchMethod == METHOD.XINPUT)
                switch_to = number;
        }
		this._createCombo(switch_to, 'switch-method', items,
            _("Switch Method"), _("Method by which to switch the touchpad."),
            function(menuItem, id) {
                this._undoButton.show();
                let old_method = indicator._CONF_switchMethod;
			    settings.set_enum("switch-method", methods[id]);
                onChangeSwitchMethod(old_method, methods[id]);
		    });
        this._createSeparator();
        this._createButton(_("Restore Defaults"),
            _("Restore the default settings."), _("Restore Defaults"), 
            function() {
                settings.restoreDefault();
				settings.set_boolean("first-time", false);
            });
	},

	_auto_switch: function() {
		logging('SettingsDialog._auto_switch()');
		let settings = this._settings;
        let indicator = this._indicator;
        let mouses = list_mouses();

	    this._createSwitch(indicator._CONF_autoSwitchTouchpad,
            'auto-switch-touchpad',
            _("Automatically switch Touchpad On/Off"),
            _("Turns the touchpad on or off automatically if a mouse is (un)plugged."));
        if (indicator.trackpoint.is_there_device) {
	        this._createSwitch(indicator._CONF_autoSwitchTrackpoint, 
                'auto-switch-trackpoint', 
                _("Automatically switch Trackpoint On/Off"), 
                _("Turns trackpoint automatically on or off if a mouse is (un)plugged."));
        }
	    this._createSeparator();
	    this._createSwitch(indicator._CONF_showNotifications,
            'show-notifications',
		    _("Show notification"),
            _("Show notifications if the touchpad or the trackpoint is automatically switched on or off."));
        this._createSeparator();
        this._createLabel(_("Exclude mouse device from autodetection"),
                    _("Here you can choose some mouse devices to be excluded from autodetection, like your IR Remote Control or something similar.\nAll chosen devices are ignored."));

        if (mouses[0]) {
            for (let x = 0; x < mouses[1].length; x++) {
                let exclude = false;
                if (indicator._CONF_excludedMouses[mouses[1][x]])
                    exclude = true;
                this._createCheckBox(mouses[1][x], exclude,
                    function(name, state) {
                        let dict = indicator._CONF_excludedMouses;
                        dict[name] = state;
			            settings.set_dict("excluded-mouses", dict);
                    });
            }
        }
	},

	_debug: function() {
        logging('SettingsDialog._debug()');
		let settings = this._settings;
        let indicator = this._indicator;

		this._createSwitch(indicator._CONF_debug, 'debug',
		    _("Debug log"), _("Turns the debug log on or off."),
            Lang.bind(this, function(s) {
				if(s)
					this._debug_to_file._mySection.show();
				else
					this._debug_to_file._mySection.hide();
			}));
        this._debug_to_file = this._createSwitch(indicator._CONF_debugToFile,
            'debug-to-file', _("Write debug information to file."),
            _("All debug logs are additionally written to the file 'touchpad-indicator.log' in the extension directory.\nAttention!\nThis feature will slow down the startup of gnome-shell and the usage of the extension."));
        if (!indicator._CONF_debug)
            this._debug_to_file._mySection.hide();
        this._createSeparator();
        if (!this._touchpad[0]) {
            let mouses = list_mouse_devices();
            let mouse = "";
            if (mouses[0]) {
                let x = 0;
                mouses[1].forEach(function(o) {
                    if (x > 0)
                        mouse += "\n";
                    mouse += "      - " + o;
                    x++;
                });
            } else {
                mouse = mouses[1].toString(); 
            }
            this._createLabel(_("Warning - No Touchpad Detected"),
                _("The extension could not detect a touchpad at the moment.\nPerhaps your touchpad is not detected correctly by the kernel.\nThe following devices are detected as mice:\n") + mouse);

            if (mouses[0] && indicator.xinput_is_installed) {
                this._createLabel(_("Try to find the touchpad"),
                    _("You could try to find a possible touchpad.\nBelow you could choose the possible touchpad from the list of the detected mice. In most cases you should choose the entry 'PS/2 Generic Mouse' if available.\nThe switch method will be automatically switched to Xinput, because only with Xinput it is possible to switch an undetected touchpad.\n"));
                let items = new Array(), number = 1, choosen = 0;
                items[0] = ["-", 0];
                mouses[1].forEach(function(o) {
                    items[number] = [o, number];
                    if (!(indicator._CONF_possibleTouchpad.indexOf(o) == -1)) {
                        choosen = number;
                    }
                    number++;
                });
        		this._createCombo(choosen, 'possible-touchpad', items,
                    _("Choose possible touchpad"),
                    _("You can choose the mouse entry which could be the touchpad."),
                    function(menuItem, id) {
                        this._undoButton.show();
			            settings.set_text("possible-touchpad", items[id][0]);
		            }
                );
                if (indicator._CONF_switchMethod != METHOD.XINPUT) {
                    let tpd_on = true;
                    if (!indicator._touchpad_enabled()) {
                        indicator._enable_touchpad();
                        tpd_on = false;
                    }
                    settings.set_enum("switch-method", METHOD.XINPUT);
                    if (!tpd_on)
                        indicator._disable_touchpad();
                }
            } else {
                this._createLabel(_("No Xinput installed"),
                    _("If you install 'xinput' on your pc, the extension could try to switch an undetected touchpad.\nPlease install 'xinput' and reload gnome-shell to enable this feature."));
            }
            this._createSeparator();
        }
        let shellversion = (_("Gnome Shell Version: ") + Conf.PACKAGE_VERSION
            + "\n");
        let indicatorversion = (_("Touchpad Indicator Version: ")
            + ExtensionMeta['version'].toString() + "\n");
        let touchpad = _("Touchpad(s): ") + this._touchpad[1];
        let xinput = _("Xinput: ");
        if (indicator.xinput_is_installed) {
            xinput = xinput + _("Is installed.");
        } else {
            xinput = xinput + _("Not found on your system.");
        }
        let synclient = _("Synclient: ");
        if (indicator.synclient.synclient_in_use) {
            synclient = synclient + _("Is installed and in use.\n");
        } else {
            synclient = synclient + _("Not found or used on your system.\n");
        }
        this._createLabel(_("Debug Informations"),
            _("Here you find some information about your system which might be helpful in debugging.\n\n")
            + shellversion + indicatorversion + touchpad + synclient + xinput);
	},

    _debug_log: function() {
        logging('SettingsDialog._debug_log()');
        this._createLabel('', LOGS);
    },

	close: function() {
        logging('SettingsDialog.close()')
		Main.popModal(this.actor);
		this.actor.destroy();
		this._settings._settingsMenu = false;
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
        if (!USE_SYNCLIENT) {
            logging('Synclient._is_synclient_in_use(): synclient manually '
                + 'disabled');
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
                    logging('Synclient._is_synclient_in_use(): no properties '
                        + 'found');
                    return false;
                }
                if (!(this.output[x].toString().indexOf(
                        "TouchpadOff") == -1)) {
                    logging('Synclient._is_synclient_in_use(): synclient '
                        + 'found and ready to use');
                    return true;
                }
            }
        }
        logging('Synclient.__is_synclient_in_use(): unknown situation - '
            + 'Return false');
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
                let lines = this.output[1].toString().split("\n");
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
                    logging('Synclient._watch: Touchpad state changed to '
                        + state.toString());
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


function XInput(devices) {
    this._init(devices);
};

XInput.prototype = {
    _init: function(devices) {
        logging('XInput._init(' + devices + ')');
        this.devices = devices;
        this.ids = this._get_ids();
        this.is_there_device = this._is_there_device();
        logging('Found Device - ' + this.is_there_device.toString() +
            ' ' + this.ids);
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
        let lines = execute_sync('xinput --list');
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
        let comp = execute_sync('xinput --list-props ' + id.toString());
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
                if (!(where.indexOf(this.devices[tpid].toString()) == -1)) {
                    return true;
                }
            }
        }
        return false;
    },

    _set_device_enabled: function(id) {
        logging('XInput._set_device_enabled() id: '+id.toString());
        return execute_async('xinput set-prop ' + id.toString()
            + ' "Device Enabled" 1');
    },

    _set_device_disabled: function(id) {
        logging('XInput._set_device_disabled() id: '+id.toString());
        return execute_async('xinput set-prop ' + id.toString()
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

    _is_device_enabled: function(id) {
        logging('XInput._is_device_enabled()');
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
        this._load_excluded_mouses();

        this.touchpad = getSettings(TOUCHPAD_SETTINGS_SCHEMA);
        if (this._CONF_possibleTouchpad != "-") {
            ALL_TOUCHPADS[TOUCHPADS.length] = 
                this._CONF_possibleTouchpad.toLowerCase();
        }
        this.touchpadXinput = new XInput(ALL_TOUCHPADS);
        this.trackpoint = new XInput(TRACKPOINTS);
        this.fingertouch = new XInput(FINGER_TOUCHES);
        this.pen = new XInput(PENS);
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

        let switch_method_changed = false;
        if (METHOD.SYNCLIENT == this._CONF_switchMethod && 
                !this.synclient.synclient_in_use) {
            this._CONF_switchMethod = METHOD.GCONF;
            switch_method_changed = true;
        }

        if (METHOD.GCONF != this._CONF_switchMethod) {
            if (!this.touchpad.get_boolean('touchpad-enabled'))
                this.touchpad.set_boolean('touchpad-enabled', true);
        }

        if (METHOD.GCONF == this._CONF_switchMethod) {
            this.touchpad.set_boolean('touchpad-enabled',
                this._CONF_touchpadEnabled);
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

        if (!this._CONF_fingertouchEnabled)
            this.fingertouch._disable_all_devices();

        if (!this._CONF_penEnabled)
            this.pen._disable_all_devices();

        PanelMenu.SystemStatusButton.prototype._init.call(this,
            'input-touchpad');

        this._touchpadItem = new PopupSwitchMenuItem(_("Touchpad"), 0,
            this._touchpad_enabled(), onMenuSelect);
        this._trackpointItem = new PopupSwitchMenuItem(_("Trackpoint"), 1,
            this.trackpoint._all_devices_enabled(), onMenuSelect);
        this._fingertouchItem = new PopupSwitchMenuItem(_("Finger touch"), 2,
            this.fingertouch._all_devices_enabled(), onMenuSelect);
        this._penItem = new PopupSwitchMenuItem(_("Pen"), 3,
            this.pen._all_devices_enabled(), onMenuSelect);
        this._SettingsItem = new PopupMenuItem(_("Indicator Settings"), 9, 
            onMenuSelect);

        this.menu.addMenuItem(this._touchpadItem);
        if (this.trackpoint.is_there_device)
            this.menu.addMenuItem(this._trackpointItem);
        if (this.fingertouch.is_there_device)
            this.menu.addMenuItem(this._fingertouchItem);
        if (this.pen.is_there_device)
            this.menu.addMenuItem(this._penItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addSettingsAction(_("Touchpad Settings"),
            'gnome-mouse-panel.desktop');
        this.menu.addMenuItem(this._SettingsItem);

        this._onMousePlugged();
        this._onChangeIcon(false);
        this._connect_signals();
        this._connectConfig();
        if (switch_method_changed)
            this.settings.set_enum('switch-method', this._CONF_switchMethod);

    },

    _loadConfig: function() {
        this._CONF_firstTime = this.settings.get_boolean('first-time');
		this._CONF_touchpadEnabled = this.settings.get_boolean(
            'touchpad-enabled');
		this._CONF_trackpointEnabled = this.settings.get_boolean(
            'trackpoint-enabled');
		this._CONF_fingertouchEnabled = this.settings.get_boolean(
            'fingertouch-enabled');
		this._CONF_penEnabled = this.settings.get_boolean(
            'pen-enabled');
		this._CONF_autoSwitchTouchpad = this.settings.get_boolean(
            'auto-switch-touchpad');
		this._CONF_autoSwitchTrackpoint = this.settings.get_boolean(
            'auto-switch-trackpoint');
        this._CONF_showNotifications = this.settings.get_boolean(
            'show-notifications');
        DEBUG = this._CONF_debug = this.settings.get_boolean('debug');
        DEBUG_TO_FILE = this._CONF_debugToFile = this.settings.get_boolean(
            'debug-to-file');
        this._CONF_switchMethod = this.settings.get_enum('switch-method');
        this._CONF_possibleTouchpad = this.settings.get_text(
            'possible-touchpad');
        this._CONF_excludedMouses = this.settings.get_dict('excluded-mouses');
	},

    _connectConfig: function() {
        //this are no real connections
        this.settings.connect('first-time', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('touchpad-enabled', Lang.bind(this,
            this._loadConfig));
		this.settings.connect('trackpoint-enabled', Lang.bind(this,
            this._loadConfig));
		this.settings.connect('fingertouch-enabled', Lang.bind(this,
            this._loadConfig));
		this.settings.connect('pen-enabled', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('auto-switch-touchpad', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('auto-switch-trackpoint', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('show-notifications', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('debug', Lang.bind(this, this._loadConfig));
        this.settings.connect('debug-to-file', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('switch-method', Lang.bind(this,
            this._loadConfig));
        this.settings.connect('possible-touchpad', Lang.bind(this,
            this._possible_touchpad_changed));
        this.settings.connect('excluded-mouses', Lang.bind(this,
            this._excluded_mouses_changed));
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

    _onChangeSwitchMethod: function(old_method, new_method) {
        logging('touchpadIndicatorButton._onChangeSwitchMethod()');
        touchpad_enabled = this._CONF_touchpadEnabled;
        switch (old_method) {
            case METHOD.GCONF:
                this.touchpad.set_boolean('touchpad-enabled', true);
                break;
            case METHOD.SYNCLIENT:
                this.synclient._enable();
                break;
            case METHOD.XINPUT:
                this.touchpadXinput._enable_all_devices();
                break;
        }
        this.settings.set_boolean('touchpad-enabled', touchpad_enabled)
        if (touchpad_enabled) {
            this._enable_touchpad();
        } else {
            this._disable_touchpad();
        }
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
                        if (!this.touchpad.get_boolean('touchpad-enabled'))
                            this.touchpad.set_boolean('touchpad-enabled',
                                true);
                        this.synclient._watch();
                        if (this._CONF_touchpadEnabled) {
                            this.synclient._enable();
                        } else {
                            this.synclient._disable();
                        }
                    } else {
                        this.synclient._cancel();
                        this.settings.set_enum('switch-method', METHOD.GCONF);
                        this.touchpad.set_boolean('touchpad-enabled',
                            this._CONF_touchpadEnabled);
                    }
                }
            }
            let is_mouse = list_mouses(true)[0];
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
                    this.trackpoint.is_there_device) {
                note_tpt = true;
                if (is_mouse && this.trackpoint._all_devices_enabled()) {
                    this._disable_trackpoint();
                    tpt = false;
                } else if (!is_mouse && 
                        !this.trackpoint._all_devices_enabled()) {
                    this._enable_trackpoint();
                    tpt = true;
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
            logging(content);
            this._notify(false, content);
	    }
    },

    _load_excluded_mouses: function() {
        ALL_OTHERS = OTHERS.slice();
        for(var key in this._CONF_excludedMouses) {
            if (this._CONF_excludedMouses[key])
                ALL_OTHERS[ALL_OTHERS.length] = key.toString().toLowerCase();
        }
    },

    _excluded_mouses_changed: function() {
        this._loadConfig();
        this._load_excluded_mouses();
    },

    _notify: function(title, content) {
        if (this._CONF_showNotifications)
            notify(this, title, content);
    },

    _disable_touchpad: function() {
        logging('touchpadIndicatorButton._disable_touchpad()');
        switch (this._CONF_switchMethod) {
            case METHOD.GCONF:
                this.settings.set_boolean('touchpad-enabled', false);
                if (this.touchpad.set_boolean('touchpad-enabled', false)) {
                    return true;
                } else {
                    return false;
                }
                break;
            case METHOD.SYNCLIENT:
                if (this.synclient._disable()) {
                    this.settings.set_boolean('touchpad-enabled', false);
                    this._onChangeIcon(false);
                    return true;
                } else {
                    return false;
                }
                break;
            case METHOD.XINPUT:
                if (this.touchpadXinput._disable_all_devices()) {
                    this.settings.set_boolean('touchpad-enabled', false);
                    this._onChangeIcon(false);
                } else {
                    return false;
                }
                break;
        }
        return false;
    },

    _enable_touchpad: function() {
        logging('touchpadIndicatorButton._enable_touchpad()');
        switch (this._CONF_switchMethod) {
            case METHOD.GCONF:
                this.settings.set_boolean('touchpad-enabled', true);
                if (this.touchpad.set_boolean('touchpad-enabled', true)) {
                    return true;
                } else {
                    return false;
                }
                break;
            case METHOD.SYNCLIENT:
                if (this.synclient._enable()) {
                    this.settings.set_boolean('touchpad-enabled', true);
                    this._onChangeIcon(false);
                    return true;
                } else {
                    return false;
                }
                break;
            case METHOD.XINPUT:
                if (this.touchpadXinput._enable_all_devices()) {
                    this.settings.set_boolean('touchpad-enabled', true);
                    this._onChangeIcon(false);
                } else {
                    return false;
                }
                break;
        }
        return false;
    },

    _touchpad_enabled: function() {
        return this._CONF_touchpadEnabled;
        /*switch (this._CONF_switchMethod) {
            case METHOD.GCONF:
                return this.touchpad.get_boolean('touchpad-enabled');
                break;
            case METHOD.SYNCLIENT:
                return !this.synclient.synclient_status;
                break;
            case METHOD.XINPUT:
                return this.touchpadXinput._all_devices_enabled();
                break;
        }*/
    },

    _possible_touchpad_changed: function() {
        this._loadConfig();
        let enabled = this._touchpad_enabled();
        this._enable_touchpad();
        if (this._CONF_possibleTouchpad != " ") {
            ALL_TOUCHPADS[TOUCHPADS.length] = 
                this._CONF_possibleTouchpad.toLowerCase();
        } else {
            ALL_TOUCHPADS = TOUCHPADS.slice();
        }
        this.touchpadXinput = new XInput(ALL_TOUCHPADS);
        if (!enabled)
            this._disable_touchpad();
    },

    _disable_trackpoint: function() {
        if (this.trackpoint._disable_all_devices()) {
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
        if (this.trackpoint._enable_all_devices()) {
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

    _disable_fingertouch: function() {
        if (this.fingertouch._disable_all_devices()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._fingertouchItem, false);
            this.settings.set_boolean('fingertouch-enabled', false);
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._fingertouchItem, true);
            return false;
        }
    },

    _enable_fingertouch: function() {
        if (this.fingertouch._enable_all_devices()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._fingertouchItem, true);
            this.settings.set_boolean('fingertouch-enabled', true);
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._fingertouchItem, false);
            return false;
        }
    },

    _disable_pen: function() {
        if (this.pen._disable_all_devices()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._penItem, false);
            this.settings.set_boolean('pen-enabled', false);
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._penItem, true);
            return false;
        }
    },

    _enable_pen: function() {
        if (this.pen._enable_all_devices()) {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._penItem, true);
            this.settings.set_boolean('pen-enabled', true);
            return true;
        } else {
            PopupMenu.PopupSwitchMenuItem.prototype.setToggleState.
                call(this._penItem, false);
            return false;
        }
    },

    _settings_menu: function() {
        if(!this.settings._settingsMenu)
			this.settings._settingsMenu = new SettingsDialog(this);
    },

    _connect_signals: function() {
        this.signal_touchpadEnabled = this.touchpad.connect(
            'changed::touchpad-enabled', onSwitchGconf);
        this.watch_mouse = watch_mouse();
        this.signal_watchMouse = this.watch_mouse.connect('changed',
            onMousePlugged);
        if (this._CONF_switchMethod == METHOD.SYNCLIENT)
            this.synclient._watch();
    },

    _disconnect_signals: function() {
        this.touchpad.disconnect(this.signal_touchpadEnabled);
        this.watch_mouse.disconnect(this.signal_watchMouse);
        this.watch_mouse.cancel();
        this.synclient._cancel();
    }
};


let touchpadIndicator;

function onMenuSelect(actor, event) {
    logging('onMenuSelect: actor - "'+actor.toString()+'"');
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
            if (actor.state) {
                touchpadIndicator._enable_fingertouch();
            } else {
                touchpadIndicator._disable_fingertouch();
            }
            break;
        case 3:
            if (actor.state) {
                touchpadIndicator._enable_pen();
            } else {
                touchpadIndicator._disable_pen();
            }
            break;
        case 9:
            touchpadIndicator._settings_menu();
            break
    }
};

function onLoadConfig() {
    touchpadIndicator._loadConfig();
};

function onChangeIcon(write_setting) {
    touchpadIndicator._onChangeIcon(write_setting);
};

function onSwitchGconf() {
    touchpadIndicator.settings.set_boolean('touchpad-enabled',
        touchpadIndicator.touchpad.get_boolean('touchpad-enabled'));
    touchpadIndicator._onChangeIcon();
};

function onMousePlugged() {
    touchpadIndicator._onMousePlugged();
};

function onChangeSwitchMethod(old_method, new_method) {
    touchpadIndicator._onChangeSwitchMethod(old_method, new_method);
};


// Put your extension initialization code here
function init(metadata) {
    imports.gettext.bindtextdomain('touchpad-indicator@orangeshirt',
        GLib.build_filenamev([metadata.path, 'locale']));
};

function enable() {
    touchpadIndicator = new touchpadIndicatorButton;
    Main.panel.addToStatusArea('touchpad-indicator', touchpadIndicator);

    if(touchpadIndicator.settings.get_boolean("first-time"))
        TIMEOUT_SETTINGSDIALOG = Mainloop.timeout_add(3000,
            Lang.bind(this, function() {
                TIMEOUT_SETTINGSDIALOG = false;
                new SettingsDialog(touchpadIndicator);
                touchpadIndicator.settings.set_boolean("first-time", false);
            }));
};

function disable() {
    if (TIMEOUT_SETTINGSDIALOG) {
        Mainloop.source_remove(TIMEOUT_SETTINGSDIALOG);
        TIMEOUT_SETTINGSDIALOG = false;
    }
    touchpadIndicator._disconnect_signals();
    touchpadIndicator.destroy();
};

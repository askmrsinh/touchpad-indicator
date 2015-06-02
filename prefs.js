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

const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Conf = imports.misc.config;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('touchpad-indicator@orangeshirt');
const _ = Gettext.gettext;
const N_ = function(e) { return e; };

const Me = imports.misc.extensionUtils.getCurrentExtension();
let Convenience = Me.imports.convenience;
let Lib = Me.imports.lib;
let Synclient = Me.imports.synclient;
let XInput = Me.imports.xinput;

let METHOD = Lib.METHOD;
let gsettings;
let settings;
let xinput_is_installed = Lib.execute_sync('xinput --list');
let synclient = new Synclient.Synclient();
let synclient_in_use = synclient.synclient_in_use;
let trackpoint = new XInput.XInput(Lib.TRACKPOINTS);

let vbox_debuglog;
let vbox_debugtofile;

// Settings
const SETTINGS_SCHEMA = Lib.SETTINGS_SCHEMA;
const TOUCHPAD_SETTINGS_SCHEMA = Lib.TOUCHPAD_SETTINGS_SCHEMA;

//Devices
const TOUCHPADS = Lib.TOUCHPADS;
var ALL_TOUCHPADS = TOUCHPADS.slice();


function init() {
    Convenience.initTranslations('touchpad-indicator@orangeshirt');
    gsettings = Convenience.getSettings(SETTINGS_SCHEMA);
    settings = {
        first_time: {
            type: "b",
            label: _("First time startup")
        },
        touchpad_enabled: {
            type: "b",
            label: _("Touchpad")
        },
        trackpoint_enabled: {
            type: "b",
            label: _("Trackpoint")
        },
        touchscreen_enabled: {
            type: "b",
            label: _("Touchscreen")
        },
        fingertouch_enabled: {
            type: "b",
            label: _("Fingertouch")
        },
        pen_enabled: {
            type: "b",
            label: _("Pen")
        },
        autoswitch_touchpad: {
            type: "b",
            label: _("Automatically switch Touchpad On/Off"),
			help: _("Turns touchpad automatically on or off if a mouse is (un)plugged.")
        },
        autoswitch_trackpoint: {
            type: "b",
            label: _("Automatically switch Trackpoint On/Off"),
			help: _("Turns trackpoint automatically on or off if a mouse is (un)plugged.")
        },
        show_notifications: {
            type: "b",
            label: _("Show notification"),
			help: _("Show notifications if the touchpad or the trackpoint is automatically switched on or off.")
        },
        debug: {
            type: "b",
            label: _("Debug log"),
			help: _("Turns the debug log on or off.")
        },
        debugtofile: {
            type: "b",
            label: _("Write debug information to file."),
			help: _("All debug logs are additionally written to the file 'touchpad-indicator.log' in the extension directory.\nAttention!\nThis feature will slow down the startup of gnome-shell and the usage of the extension.")
        },
        switchmethod: {
            type: "e",
            label: _("Switch Method"),
            help: _("Method by which to switch the touchpad."),
            list: [
                { nick: "gconf", name: _("Gconf"), id: 0 },
                { nick: "synclient", name: _("Synclient"), id: 1 },
                { nick: "xinput", name: _("XInput"), id: 2 }
            ]
        },
        possible_touchpad: {
            type: "s",
            label: _("Choose possible touchpad"),
			help: _("You can choose the mouse entry which could be the touchpad.")
        },
        excluded_mouses: {
            type: "s", // JSON parsed string
            label: _("Exclude mouse device from autodetection"),
			help: _("Here you can choose some mouse devices to be excluded from autodetection, like your IR Remote Control or something similar.\nAll chosen devices are ignored.")
        },
        show_panelicon: {
            type: "b",
            label: _("Show Icon in Main Panel"),
            help: _("Show or hide the icon in the panel")
        }
    };
};


function buildPrefsWidget() {
    let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                             border_width: 10});
    let notebook = new Gtk.Notebook();
    notebook.set_scrollable(true);

    //Welcome Page
    let touchpads = Lib.search_touchpads();
    let vbox_welcome = buildVbox();
    let pl_welcome = createText(_("Welcome"));
    if (!touchpads[0]) {
        addBoldTextToBox(_("Attention - No Touchpad Detected"), vbox_welcome);
        addTextToBox(_("The extension could not detect a touchpad at the moment.\nYou'll find further information in the Debug section."), vbox_welcome);
	vbox_welcome.add(createSeparator());
    }
    addTextToBox(_("These settings allow you to customize this extension to your needs. You can open this dialog again by clicking on the extension's icon and selecting Indicator Preferences.\n\
\n\
I stopped development of this extension, but you can use github to report bugs and send fixes (https://github.com/orangeshirt/gnome-shell-extension-touchpad-indicator). \n\
\n\
Sometimes I'll merge pull requests and update the code to extensions.gnome.org."), 
        vbox_welcome);
    vbox_welcome.add(createSeparator());
    vbox_welcome.add(createBoolSetting(settings, "first_time"));
    notebook.append_page(vbox_welcome, pl_welcome);

    // General Page
    let vbox_general = buildVbox();
    vbox_general.set_size_request(550, 350);
    let pl_general = createText(_("General"));
    addTextToBox(_(" "), vbox_general);

    let items = [], methods = [], number;
    let switch_to = 0;
    items[0] = [_("Gconf Settings"), 0];
    methods[0] = METHOD.GCONF;
    if (gsettings.get_enum("switchmethod") == METHOD.GCONF)
        switch_to = 0;
    if (synclient_in_use) {
        number = items.length;
        items[number] = [_("Synclient"), number];
        methods[number] = METHOD.SYNCLIENT;
        if (gsettings.get_enum("switchmethod") == METHOD.SYNCLIENT)
            switch_to = number;
    }
    if (xinput_is_installed) {
        number = items.length;
        items[number] = [_("Xinput"), number];
        methods[number] = METHOD.XINPUT;
        if (gsettings.get_enum("switchmethod") == METHOD.XINPUT)
            switch_to = number;
    }
    let combo = createCombo(switch_to, 'switchmethod', items,
        _("Switch Method"), _("Method by which to switch the touchpad."),
        function(menuItem) {
            let old_method = gsettings.get_enum("switchmethod");
            let id = menuItem.get_active();
            gsettings.set_enum("switchmethod", methods[id]);
        });
    vbox_general.add(combo);

    vbox_general.add(createSeparator());
    vbox_general.add(createBoolSetting(settings, "show_panelicon"));
    notebook.append_page(vbox_general, pl_general);

    // Auto Switch Page
    let vbox_autoswitch = buildVbox();
    let pl_autoswitch = createText(_("Auto Switch"));
    addBoldTextToBox(_("Define the behaviour if a mouse is (un)plugged."),
        vbox_autoswitch);
    vbox_autoswitch.add(createSeparator());
    vbox_autoswitch.add(createBoolSetting(settings, "autoswitch_touchpad"));
    if (trackpoint.is_there_device)
        vbox_autoswitch.add(createBoolSetting(settings,
            "autoswitch_trackpoint"));
    vbox_autoswitch.add(createSeparator());
    vbox_autoswitch.add(createBoolSetting(settings, "show_notifications"));
    vbox_autoswitch.add(createSeparator());

    addBoldTextToBox(_("Exclude mouse device from autodetection"),
        vbox_autoswitch);
    addTextToBox(_("Here you can choose some mouse devices to be excluded from autodetection, like your IR Remote Control or something similar.\nAll chosen devices are ignored."), vbox_autoswitch);
    let mouses = Lib.list_mouses();
    if (mouses[0]) {
        for (let x = 0; x < mouses[1].length; x++) {
            let exclude = false;
            if (JSON.parse(gsettings.get_string("excluded-mouses"))
                    [mouses[1][x]])
                exclude = true;
            let checkbox = createCheckBox(mouses[1][x], exclude,
                function(box) {
                    let dict = JSON.parse(gsettings.get_string(
                        "excluded-mouses"));
                    dict[box.label] = box.get_active();
                    gsettings.set_string("excluded-mouses",
                        JSON.stringify(dict));
                }
            );
            vbox_autoswitch.add(checkbox);
        }
    }

    notebook.append_page(vbox_autoswitch, pl_autoswitch);


    // Debug Page
    let vbox_debugcont = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
        margin_top: 0 }); 
    let vbox_view = new Gtk.Viewport();
    let vbox_scroll = new Gtk.ScrolledWindow({ vexpand: true });

    let vbox_debug = buildVbox();
    let pl_debug = createText(_("Debug"));
    addTextToBox(_("Settings for debugging the extension."), vbox_debug);

    if (!touchpads[0]) {
        vbox_debug.add(createSeparator());
        let mouses = Lib.list_mouse_devices();
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
        addBoldTextToBox(_("Warning - No Touchpad Detected"), vbox_debug);
        addTextToBox(_("The extension could not detect a touchpad at the moment.\nPerhaps your touchpad is not detected correctly by the kernel.\nThe following devices are detected as mice:\n") + mouse + "\n", vbox_debug);

        if (mouses[0] && xinput_is_installed) {
            addBoldTextToBox(_("Try to find the touchpad"), vbox_debug);
            addTextToBox(_("You could try to find a possible touchpad.\nBelow you could choose the possible touchpad from the list of the detected mice. In most cases you should choose the entry 'PS/2 Generic Mouse' if available.\nThe switch method will be automatically switched to Xinput, because only with Xinput it is possible to switch an undetected touchpad.\n"), vbox_debug);
            let items = new Array(), number = 1, choosen = 0;
            items[0] = ["-", 0];
            mouses[1].forEach(function(o) {
                items[number] = [o, number];
                if (!(gsettings.get_string(
                        "possible-touchpad").indexOf(o) == -1)) {
                    choosen = number;
                }
                number++;
            });
            addBoldTextToBox(_("Choose possible touchpad"), vbox_debug);
            let combo = createCombo(choosen, 'possible-touchpad', items,
                _("Choose possible touchpad"),
                _("You can choose the mouse entry which could be the touchpad."),
                function(menuItem) {
                    gsettings.set_string("possible-touchpad",
                    items[menuItem.get_active()][0]);
                }
            );
            vbox_debug.add(combo);

            if (gsettings.get_enum("switchmethod") != METHOD.XINPUT) {
                let tpd_on = true;
                if (!gsettings.get_boolean("touchpad-enabled")) {
                    switch (gsettings.get_enum("switchmethod")) {
                        case METHOD.GCONF:
                            let tpdgs = Convenience.getSettings(
                                TOUCHPAD_SETTINGS_SCHEMA);
                            if ( tpdgs.set_string('send-events', 'disabled') ) {
                               gsettings.set_boolean('touchpad-enabled', false);
                            }
                            break;
                        case METHOD.SYNCLIENT:
                            if (synclient._disable()) {
                               gsettings.set_boolean('touchpad-enabled', false);
                            }
                            break;
                    }
                    tpd_on = false;
                }
                gsettings.set_enum("switchmethod", METHOD.XINPUT);
                if (!tpd_on) {
                    let psbl_tpd = gsettings.get_string('possible-touchpad');
                    if (psbl_tpd != "-") {
                        ALL_TOUCHPADS[TOUCHPADS.length] =
                            psbl_tpd.toLowerCase();
                    }
                    let touchpadXinput = new XInput.XInput(ALL_TOUCHPADS);
                    touchpadXinput._disable_all_devices();
                    gsettings.set_boolean('touchpad-enabled', false);
                }
            }
        } else {
            addTextToBox(_("No Xinput installed"), vbox_debug);
            addTextToBox(_("If you install 'xinput' on your pc, the extension could try to switch an undetected touchpad.\nPlease install 'xinput' and reload gnome-shell to enable this feature."), vbox_debug);
        }
    }
    vbox_debug.add(createSeparator());
    let shellversion = (_("Gnome Shell Version: ") + Conf.PACKAGE_VERSION
        + "\n");
    let indicatorversion = (_("Touchpad Indicator Version: ")
        + Me.metadata['version'].toString() + "\n");
    let touchpad_lbl = _("Touchpad(s): ") + touchpads[1];
    let xinput_lbl = _("Xinput: ");
    if (xinput_is_installed) {
        xinput_lbl = xinput_lbl + _("Is installed.\n");
    } else {
        xinput_lbl = xinput_lbl + _("Not found on your system.\n");
    }
    let synclient_lbl = _("Synclient: ");
    if (synclient_in_use) {
        synclient_lbl = synclient_lbl + _("Is installed and in use.\n");
    } else {
        synclient_lbl = synclient_lbl +_("Not found or used on your system.\n");
    }
    let switchmethod = _("Switch Method: ") +
        settings['switchmethod']['list'][gsettings.get_enum('switchmethod')]['name'] + "\n";
    addBoldTextToBox(_("Debug Informations"),vbox_debug);
    addTextToBox(_("Here you find some information about your system which might be helpful in debugging.\n\n")
        + shellversion + indicatorversion + touchpad_lbl + synclient_lbl
        + xinput_lbl + switchmethod, vbox_debug);

    vbox_debug.add(createSeparator());
    vbox_debug.add(createBoolSetting(settings, "debug"));
    vbox_debugtofile = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
        margin_top: 0 });
    vbox_debugtofile.add(createBoolSetting(settings, "debugtofile"));
    vbox_debugtofile.add(createSeparator());
    vbox_debuglog = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
        margin_top: 10 });
    addBoldTextToBox(_("Debug Log"), vbox_debuglog);
    addTextToBox(
        _("The debug log since last restart, if debugging to file was enabled."),
        vbox_debuglog);
    let scroll = new Gtk.ScrolledWindow({ vexpand: true });
    let buffer = new Gtk.TextBuffer({ text: Lib.get_logs() });
    let textview = new Gtk.TextView({ buffer: buffer });
    textview.set_editable(false);
    scroll.set_size_request(400, 310);
    scroll.add(textview);
    vbox_debuglog.add(scroll);
    vbox_debugtofile.add(vbox_debuglog);
    vbox_debug.add(vbox_debugtofile);

    vbox_view.add(vbox_debug);
    vbox_scroll.add(vbox_view);
    vbox_debugcont.add(vbox_scroll);
    notebook.append_page(vbox_debugcont, pl_debug);

    frame.add(notebook);
    frame.show_all();
    if (!gsettings.get_boolean("first-time"))
        notebook.set_current_page(1);
    if (gsettings.get_boolean("debug") == false)
        vbox_debugtofile.hide();
    if (gsettings.get_boolean("debugtofile") == false)
        vbox_debuglog.hide();
    return frame;
};

function buildVbox() {
    return new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
                  margin: 20, margin_top: 10 });
};

function createSeparator() {
    return new Gtk.HSeparator({margin_bottom: 5, margin_top: 5});
};

function createText(text) {
    return new Gtk.Label({label: text, xalign: 0 });
};

function addTextToBox(text, box) {
    let txt = new Gtk.Label({label: text, xalign: 0 });
    txt.set_line_wrap(true);
    box.add(txt);
};

function addBoldTextToBox(text, box) {
    let txt = new Gtk.Label({ xalign: 0 });
    txt.set_markup('<b>' + text + '</b>');
    txt.set_line_wrap(true);
    box.add(txt);
};


function createCheckBox(label, active, fu) {
    let cbx = new Gtk.CheckButton({ label: label });
    cbx.set_active(active);
    cbx.connect('toggled',         
            Lang.bind(this, fu || function(name, state) {
            if(fu)
                fu();
            })
    );
    return cbx;
};

function createCombo(value, settingsUrl, items, title, desc, fu) {
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});   
    let setting_label = new Gtk.Label({label: title, xalign: 0 });

    let model = new Gtk.ListStore();
    model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
    let setting_enum = new Gtk.ComboBox({model: model});
    setting_enum.get_style_context().add_class(Gtk.STYLE_CLASS_RAISED);
    let renderer = new Gtk.CellRendererText();
    setting_enum.pack_start(renderer, true);
    setting_enum.add_attribute(renderer, 'text', 1);
    for (let i=0; i<items.length; i++) {
        let item = items[i];
        let iter = model.append();
        model.set(iter, [0, 1], [i, item[0]]);
        if (i == value) {
            setting_enum.set_active(i);
        }
    }
    setting_enum.connect('changed',         
            Lang.bind(this, fu || function(menuItem) {
            if(fu)
                fu();
            })
    );
    if (desc) {
        setting_label.set_tooltip_text(desc);
        setting_enum.set_tooltip_text(desc);
    }
    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_enum);

    return hbox;
};

function createStringSetting(settings, setting) {

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settings[setting].label,
                                       xalign: 0 });

    let setting_string = new Gtk.Entry({text: gsettings.get_string(
        setting.replace('_', '-'))});
    setting_string.set_width_chars(30);
    setting_string.connect('notify::text', function(entry) {
        gsettings.set_string(setting.replace('_', '-'), entry.text);
    });

    if (settings[setting].mode == "passwd") {
        setting_string.set_visibility(false);
    }

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help);
        setting_string.set_tooltip_text(settings[setting].help);
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_string);

    return hbox;
};

function createBoolSetting(settings, setting) {
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settings[setting].label,
                                       xalign: 0 });

    let setting_switch = new Gtk.Switch({active: gsettings.get_boolean(
        setting.replace('_', '-'))});

    if (setting == "debug") {
       setting_switch.connect('notify::active', function(button) {
            gsettings.set_boolean(setting.replace('_', '-'), button.active);
            if (gsettings.get_boolean("debug") == true)
                vbox_debugtofile.show();
            else
                vbox_debugtofile.hide();
        }); 
    } else if (setting == "debugtofile") {
       setting_switch.connect('notify::active', function(button) {
            gsettings.set_boolean(setting.replace('_', '-'), button.active);
            if (gsettings.get_boolean("debugtofile") == true)
                vbox_debuglog.show();
            else
                vbox_debuglog.hide();
        }); 
    } else {
        setting_switch.connect('notify::active', function(button) {
            gsettings.set_boolean(setting.replace('_', '-'), button.active);
        });
    }

    if (settings[setting].help) {
        setting_label.set_tooltip_text(settings[setting].help)
        setting_switch.set_tooltip_text(settings[setting].help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_switch);

    return hbox;
};

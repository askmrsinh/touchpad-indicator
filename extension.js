/* TouchpadIndicator - Touchpad management GNOME Shell Extension.
 * Orignal work Copyright (C) 2011-2013 Armin Köhler <orangeshirt at web.de>
 * Modifcations Copyright (C) 2019 Ashesh Singh <user501254 at gmail.com>
 *
 * This file is part of TouchpadIndicator, a fork of Armin Köhler's
 * 'gnome-shell-extension-touchpad-indicator' project which is licensed GPLv2.
 * Orignal source code is available at https://git.io/fjVec.
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


const { Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const Mainloop = imports.mainloop;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Lib = Me.imports.lib;
const XInput = Me.imports.xinput;

//schema
const SCHEMA_EXTENSION = 'org.gnome.shell.extensions.touchpad-indicator';
const SCHEMA_TOUCHPAD = 'org.gnome.desktop.peripherals.touchpad';

//keys
const KEY_SEND_EVENTS = 'send-events';
const KEY_ALWAYS_SHOW = 'show-panelicon';
const KEY_NOTIFS_SHOW = 'show-notifications';
const KEY_TPD_ENABLED = 'touchpad-enabled';

//icons
const ICON_ENABLED = 'input-touchpad-symbolic';
const ICON_DISABLED = 'touchpad-disabled-symbolic';

var TouchpadIndicator = GObject.registerClass(
class TouchpadIndicatorButton extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Touchpad Indicator');
        this.hbox = new St.BoxLayout({
            style_class: 'panel-status-menu-box'
        });
        this.icon = new St.Icon({
            icon_name: ICON_ENABLED,
            style_class: 'system-status-icon'
        });
        this.hbox.add_child(this.icon);
        this.hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.add_child(this.hbox);

        this._extSettings = ExtensionUtils.getSettings(SCHEMA_EXTENSION);
        this._keyAlwaysShowSignal = this._extSettings.connect(
            `changed::${KEY_ALWAYS_SHOW}`,
            this._queueSyncMenuVisibility.bind(this));

        this._tpdSettings = new Gio.Settings({ schema_id: SCHEMA_TOUCHPAD });
        this._tpdSendEventsSignal = this._tpdSettings.connect(
            `changed::${KEY_SEND_EVENTS}`,
            this._queueSyncPointingDevice.bind(this));

        this._switchMethod = this._extSettings.get_enum('switchmethod');

        if (this._switchMethod !== Lib.METHOD.GCONF) {
            if (this._tpdSettings.get_string('send-events') !== 'enabled')
                this._tpdSettings.set_string('send-events', 'enabled');
        }

        this.xinputIsUsable = Lib.executeCmdSync('xinput --list');

        if (this.xinputIsUsable[0] !== true) {
            global.log(Me.uuid,
                'TouchpadIndicator._init(): Can`t find Xinput');
            this._extSettings.set_boolean('autoswitch-trackpoint', false);
        } else {
            global.log(Me.uuid,
                'TouchpadIndicator._init(): Xinput is installed');
        }

        this.touchpadXinput = new XInput.XInput(Lib.ALL_TYPES['touchpad']);

        this._queueSyncPointingDevice(KEY_TPD_ENABLED);
        this._updateIcon();

        this._enabledSignals = [];

        let touchpad = this._buildItem('Touchpad', KEY_TPD_ENABLED);
        this.menu.addMenuItem(touchpad);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addSettingsAction('Mouse & Touchpad Preferences',
            'gnome-mouse-panel.desktop');
        this.menu.addAction('Indicator Preferences', () => {
            Lib.executeCmdAsync(`gnome-shell-extension-prefs ${Me.uuid}`);
        });

        this.actor.show();

        this._tpdSettings.connect(
            `changed::${KEY_SEND_EVENTS}`,
            this._logSKeyChange.bind(this));
        this._extSettings.connect(
            `changed::${KEY_TPD_ENABLED}`,
            this._logEKeyChange.bind(this));

        this._addKeybinding();
    }

    _logSKeyChange() {
        global.log(Me.uuid, 'Extension Key Changed');
    }

    _logEKeyChange() {
        global.log(Me.uuid, 'System Key Changed');
    }

    _buildItemExtended(string, initialValue, writable, onSet) {
        let widget = new PopupMenu.PopupSwitchMenuItem(string,
            initialValue);
        if (!writable)
            widget.actor.reactive = false;
        else
            widget.connect('toggled', item => {
                onSet(item.state);
            });
        return widget;
    }

    _buildItem(string, key) {
        let signal = this._extSettings.connect(`changed::${key}`, () => {
            widget.setToggleState(this._extSettings.get_boolean(key));
            this._queueSyncPointingDevice(key);
            this._queueSyncMenuVisibility();
            this._makeNotification();
            this._updateIcon();
        });

        this._enabledSignals.push(signal);

        let widget = this._buildItemExtended(string,
            this._extSettings.get_boolean(key),
            this._extSettings.is_writable(key),
            (enabled) => {
                if (this._extSettings.get_boolean(key) !== enabled)
                    this._extSettings.set_boolean(key, enabled);
            });
        return widget;
    }

    _queueSyncMenuVisibility() {
        if (this._syncMenuVisibilityIdle)
            return;

        this._syncMenuVisibilityIdle = Mainloop.idle_add(
            this._syncMenuVisibility.bind(this));
        GLib.Source.set_name_by_id(this._syncMenuVisibilityIdle,
            '[gnome-shell] this._syncMenuVisibility');
    }

    _syncMenuVisibility() {
        this._syncMenuVisibilityIdle = 0;

        let alwaysShow = this._extSettings.get_boolean(KEY_ALWAYS_SHOW);
        let items = this.menu._getMenuItems();

        this.actor.visible = alwaysShow || items.some(f => !!f.state);

        return GLib.SOURCE_REMOVE;
    }

    _isEnabled(keyValue) {
        switch (keyValue.constructor) {
        case Boolean:
            return (keyValue ?
                new GLib.Variant('s', 'enabled') :
                new GLib.Variant('s', 'disabled'));
        case String:
            return (keyValue !== 'enabled' ? false : true);
        case GLib.Variant:
            if (keyValue.is_of_type(new GLib.VariantType('s'))) {
                return (keyValue.get_string()[0] !== 'enabled' ? false : true);
            }
            if (keyValue.is_of_type(new GLib.VariantType('b'))) {
                return (keyValue.get_boolean());
            }
            return true;
        default:
            global.log(`Sorry, we are out of ${keyValue.constructor}.`);
        }
    }

    _notify(iconName, title, text) {
        if (this._notification)
            this._notification.destroy();

        this._ensureSource();

        let gicon = new Gio.ThemedIcon({ name: iconName });
        this._notification = new MessageTray.Notification(this._source, title,
            text, { gicon: gicon });
        this._notification.setUrgency(MessageTray.Urgency.LOW);
        this._notification.setTransient(true);
        this._notification.connect('destroy', () => {
            this._notification = null;
        });
        this._source.notify(this._notification);
    }

    _ensureSource() {
        if (!this._source) {
            this._source = new MessageTray.Source('Touchpad Indicator',
                'touchpad-indicator');

            this._source.connect('destroy', () => {
                this._source = null;
            });
            Main.messageTray.add(this._source);
        }
    }

    _queueSyncPointingDevice(key) {
        global.log(Me.uuid, '_queueSyncPointingDevice');
        // TODO: Check further for recursion, reduce complexity
        let valSendEvents = this._tpdSettings.get_string(KEY_SEND_EVENTS);
        let valTpdEnabled = this._extSettings.get_boolean(KEY_TPD_ENABLED);
        switch (key) {
        // Touchpad enabled/disabled through SCHEMA_EXTENSION
        case KEY_TPD_ENABLED:
            this._setTouchpadEnable(valTpdEnabled, valSendEvents);
            break;
        // Touchpad enabled/disabled through SCHEMA_TOUCHPAD
        default:
            if (this._switchMethod === Lib.METHOD.GCONF) {
                this._setSendEvents(valTpdEnabled, valSendEvents);
                return;
            }
            if (this._switchMethod === Lib.METHOD.XINPUT) {
                this._setXinputReset(valTpdEnabled);
                return;
            }
            // TODO: Automatically switch to GCONF if user
            //       changes `send-events` key when
            //       switch method is not GCONF
        }
    }

    _setTouchpadEnable(valTpdEnabled, valSendEvents) {
        global.log(Me.uuid, '_setTouchpadEnable');

        switch (this._switchMethod) {
        case Lib.METHOD.GCONF:
            if ((valTpdEnabled === true) && (valSendEvents !== 'enabled')) {
                this._tpdSettings.set_string(KEY_SEND_EVENTS, 'enabled');
                return;
            }
            if ((valTpdEnabled === false) && (valSendEvents !== 'disabled')) {
                this._tpdSettings.set_string(KEY_SEND_EVENTS, 'disabled');
                return;
            }
            break;
        case Lib.METHOD.XINPUT:
            this.touchpadXinput._switchAllDevices(valTpdEnabled);
            if ((valTpdEnabled === false) && !this.touchpadXinput.isPresent) {
                this._extSettings.set_boolean(KEY_TPD_ENABLED, true);
            }
            break;
        }
        // TODO: Add variable to check settings sync
        //       log error in case something failes
    }

    _setSendEvents(valTpdEnabled, valSendEvents) {
        global.log(Me.uuid, '_setSendEvents');
        if ((valSendEvents !== 'enabled') && (valTpdEnabled !== false)) {
            this._extSettings.set_boolean(KEY_TPD_ENABLED, false);
            return;
        }
        if ((valSendEvents === 'enabled') && (valTpdEnabled === false)) {
            this._extSettings.set_boolean(KEY_TPD_ENABLED, true);
        }
    }

    _setXinputReset(valTpdEnabled) {
        if (valTpdEnabled) {
            this.touchpadXinput._enableAllDevices();
        } else {
            this.touchpadXinput._disableAllDevices();
        }
    }

    _makeNotification() {
        if (this._extSettings.get_boolean(KEY_NOTIFS_SHOW)) {
            let valSendEvents = this._tpdSettings.get_string(KEY_SEND_EVENTS);
            let valTpdEnabled = this._extSettings.get_boolean(KEY_TPD_ENABLED);

            if (valSendEvents !== 'disabled' && valTpdEnabled) {
                this._notify('dialog-information',
                    `Touchpad Indicator ${Me.uuid}`,
                    'Touchpad Enabled');
            } else {
                this._notify('dialog-information',
                    `Touchpad Indicator ${Me.uuid}`,
                    'Touchpad Disabled');
            }
        }
    }

    _toggleTouchpadEnable() {
        this._extSettings.set_boolean(
            KEY_TPD_ENABLED,
            !this._extSettings.get_boolean(KEY_TPD_ENABLED));
    }

    _addKeybinding() {
        Main.wm.addKeybinding('toggle-touchpad', this._extSettings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            this._toggleTouchpadEnable.bind(this));
    }

    _removeKeybinding() {
        Main.wm.removeKeybinding('toggle-touchpad');
    }

    _updateIcon() {
        let valTpdEnabled = this._extSettings.get_boolean(KEY_TPD_ENABLED);
        this.icon.icon_name = valTpdEnabled ? ICON_ENABLED : ICON_DISABLED;
    }

    _disconnectSignals() {
        for (let i = 0; i < this._enabledSignals.length; i++) {
            this._extSettings.disconnect(this._enabledSignals[i]);
        }
        this._extSettings.disconnect(this._keyAlwaysShowSignal);
        this._tpdSettings.disconnect(this._tpdSendEventsSignal);
    }
});

// eslint-disable-next-line no-unused-vars
function init() {
}

let _indicator;

// eslint-disable-next-line no-unused-vars
function enable() {
    _indicator = new TouchpadIndicator;
    Main.panel.addToStatusArea('touchpad-indicator', _indicator);
}

// eslint-disable-next-line no-unused-vars
function disable() {
    _indicator._disconnectSignals();
    _indicator._removeKeybinding();
    _indicator.destroy();
}

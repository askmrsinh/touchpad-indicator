const { Gio, GLib, GObject, St } = imports.gi;
const Mainloop = imports.mainloop;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;

const SCHEMA_EXTENSION = 'org.gnome.shell.extensions.touchpad-indicator';
const SCHEMA_TOUCHPAD = 'org.gnome.desktop.peripherals.touchpad';

const KEY_ALWAYS_SHOW = 'show-panelicon';

var TouchpadIndicator = GObject.registerClass(
    class TouchpadIndicatorButton extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'Touchpad Indicator');
            let hbox = new St.BoxLayout({
                style_class: 'panel-status-menu-box'
            });
            let icon = new St.Icon({
                icon_name: 'input-touchpad-symbolic',
                style_class: 'system-status-icon'
            });
            hbox.add_child(icon);
            hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
            this.add_child(hbox);

            this._extSettings = ExtensionUtils.getSettings(SCHEMA_EXTENSION);
            this._extSettings.connect(`changed::${KEY_ALWAYS_SHOW}`,
                this._queueSyncMenuVisibility.bind(this));

            this._tpdSettings = new Gio.Settings({
                schema_id: SCHEMA_TOUCHPAD
            });

            let touchpad = this._buildItem('Touchpad', SCHEMA_TOUCHPAD,
                'send-events');
            this.menu.addMenuItem(touchpad);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menu.addSettingsAction('Mouse & Touchpad Preferences',
                'gnome-mouse-panel.desktop');

            this.actor.show();
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

        _buildItem(string, schema, key) {
            let settings = new Gio.Settings({ schema_id: schema });
            settings.connect(`changed::${key}`, () => {
                widget.setToggleState(this._isEnabled(settings.get_value(key)));
                this._queueSyncMenuVisibility();
            });

            let widget = this._buildItemExtended(string,
                this._isEnabled(settings.get_value(key)),
                settings.is_writable(key),
                (enabled) => {
                    let value = this._isEnabled(enabled);
                    settings.set_value(key, value);
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
            case GLib.Variant:
                if (keyValue.is_of_type(new GLib.VariantType('s'))) {
                    return (keyValue.get_string()[0] !== 'enabled' ?
                        false : true);
                }
                if (keyValue.is_of_type(new GLib.VariantType('b'))) {
                    return keyValue.get_boolean();
                }
                return true;
            default:
                global.log(`Sorry, we are out of ${keyValue.constructor}.`);
            }
        }
    }
);

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
    _indicator.destroy();
}
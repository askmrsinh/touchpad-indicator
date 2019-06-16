const { Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

// Settings
const SCHEMA_EXTENSION = 'org.gnome.shell.extensions.touchpad-indicator';
const SCHEMA_TOUCHPAD = 'org.gnome.desktop.peripherals.touchpad';

var Settings = class TouchpadIndicatorSettings {
    constructor() {
        this._settings = ExtensionUtils.getSettings(SCHEMA_EXTENSION);

        this._rtl = (Gtk.Widget.get_default_direction() === Gtk.TextDirection.RTL);

        this._builder = new Gtk.Builder();
        //this._builder.set_translation_domain(Me.metadata['gettext-domain']);
        this._builder.add_from_file(`${Me.path}/Settings.ui`);

        this.widget = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.NEVER
        });
        this._notebook = this._builder.get_object('ti_notebook');
        this.widget.add(this._notebook);

        // Set a reasonable initial window height
        this.widget.connect('realize', () => {
            let window = this.widget.get_toplevel();
            window.resize(600, 550);
        });
    }
};

function init() {
    //ExtensionUtils.initTranslations();
}

function buildPrefsWidget() {
    let settings = new Settings();
    let widget = settings.widget;
    widget.show_all();
    return widget;
}
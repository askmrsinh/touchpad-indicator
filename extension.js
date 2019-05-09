
const { GObject, St } = imports.gi;
const Main = imports.ui.main;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

var touchpadIndicatorButton = GObject.registerClass(
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
            
            this.menu.addSettingsAction('Mouse & Touchpad Preferences',
                'gnome-mouse-panel.desktop');

            this.actor.show();
        }
    }
);

function init() {
}

function enable() {
    let _indicator = new touchpadIndicatorButton;
    Main.panel.addToStatusArea('touchpad-indicator', _indicator);
}

function disable() {
    Main.panel._rightBox.remove_child(button);
}

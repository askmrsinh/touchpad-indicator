1. What is Touchpad Indicator?

Touchpad Indicator is a minimalistic Touchpad management extension for the Gnome Shell.


2. What does it?

Touchpad Indicator allows you to switch your Touchpad On or Off, if a Trackpoint, a Fingertouch, a Touchscreen or a Pen exists it is also possible to switch it On or Off through the extension (Needs 'xinput' to detect and switch the trackpoint and the one of the other devices).
There's further the possibility to automatically switch On or Off the touchpad and/or trackpoint if a mouse is detected at startup or if a mouse is plugged or the automatic switch off is disabled by default.
If your touchpad use synclient the extension could also use synclient to switch the touchpad On or Off, you could change this in the preferences. The standard settings is to use gsettings values of gnome-shell.


3. Where can I change settings?

To choose your preferred option you could change the values below "Indicatorpreferences".


4. How can I install the extension

The easiest way is to install the extension from https://extensions.gnome.org
You can use this link: https://extensions.gnome.org/extension/131/touchpad-indicator/
But the newest version you'll find on github:
If you want the newest code you should pull the code from github. Pull the code from repository and move it to ~/.local/share/gnome-shell/extensions/touchpad-indicator@orangeshirt
Finally restart the shell with Alt+F2 and 'r' or logout and in.

5. Where can I report a bug?

Please report all issues on github, but I don't support and develop the extension by myself, perhaps there ist somebody which will help you.
Github: https://github.com/orangeshirt/gnome-shell-extension-touchpad-indicator
Gnome Extensions Page: https://extensions.gnome.org/extension/131/touchpad-indicator/

6. How can I translate the extension?

6.1 Start a new translation

You have to open a terminal and change your directory:
cd ~/.local/share/gnome-shell/extensions/touchpad-indicator@orangeshirt/
Now you have to start a new translation file with:
msginit
After that you'll find a new file like de.po (where de is the language abbreviation of your language) in the directory above. Open this file with your prefered texteditor and change the strings to your language. That's it. Please push this file in github or send it to my email address (You could find them in the code of extension.js) If you would test your language file before you send it to me you have to do the following things:
mkdir -p locale/de/LC_MESSAGES
msgfmt de.po -o locale/de/LC_MESSAGES/touchpad-indicator@orangeshirt.mo
where 'de' is the language abbreviation of your translation. It is the same as for the .po file.
Now you could restart gnome-shell with Alt+F2 and 'r' or logout and in. Touchpad-indicator now should be shown in your language.


6.2 Update an existing translation

You have to open a terminal and change to the directory where your *.po file still exists:
cd ~/.local/share/gnome-shell/extensions/touchpad-indicator@orangeshirt/
Now update the existing translation:
msgmerge -U de.po messages.pot
After that you'll find the updated *.po file in the directory above. Open this file with your prefered texteditor and change the missing strings to your language. That's it. Please push this file in github or send it to my email address (You could find them in the code of extension.js) If you would test your language file before you send it to me you have to do the following things:
msgfmt de.po -o locale/de/LC_MESSAGES/touchpad-indicator@orangeshirt.mo
where 'de' is the language abbreviation of your translation. It is the same as for the .po file.
Now you could restart gnome-shell with Alt+F2 and 'r' or logout and in. Touchpad-indicator now should be shown in your language.


7 FAQ

Currently there is no FAQ

#Touchpad Indicator
![Touchpad Indicator Icon](https://raw.githubusercontent.com/user501254/TouchpadIndicator/gh-pages/images/my-touchpad-normal-dark-16x.png)
**Touchpad management GNOME Shell Extension**

Switch the touchpad, trackpoint, fingertouch, touchscreen or a pen device on and off easily from the top panel. Optionally, automatically disable some or all devices when a mouse is plugged in and re-enable them when unplugged.

![Touchpad Indicator preview](https://raw.githubusercontent.com/user501254/TouchpadIndicator/gh-pages/images/TouchpadIndicator.gif)


##Installation:

**From GNOME Shell Extension Website**
 1. Visit [https://extensions.gnome.org/extension/131/touchpad-indicator/](https://extensions.gnome.org/extension/131/touchpad-indicator/) in Firefox browser.
 2. Click on the switch at left side to toggle it from OFF to ON.
 3. Accept any installation prompts.

**From GitHub**
 1. Open a terminal and run:
 
    ```Bash
    git clone --depth=1 "https://github.com/user501254/TouchpadIndicator.git"; rm -rf TouchpadIndicator/.git
    rm -rf ~/.local/share/gnome-shell/extensions/touchpad-indicator@orangeshirt
    mv TouchpadIndicator/ ~/.local/share/gnome-shell/extensions/touchpad-indicator@orangeshirt
    ```
 2. Restart GNOME Shell by pressing `Alt+F2`, `r`, `Enter`.
 3. Enable the extension in *gnome-tweak-tool*.


##Contribute
- This repository is a based on the now out of date [gnome-shell-extension-touchpad-indicator](https://github.com/orangeshirt/gnome-shell-extension-touchpad-indicator) by [orangeshirt](https://github.com/orangeshirt).  
- This repository exists only so that user contributions can be actively merged on to GNOME Shell Extension Website.  
- You can help by reporting [Issues](https://github.com/user501254/TouchpadIndicator/issues) and submitting [Pull Requests](https://github.com/user501254/TouchpadIndicator/pulls) for new features, bug fixes and localization(which is highly incomplete).


##License
Touchpad Indicator GNOME Shell Extension is distributed under the terms of the **[GNU General Public License, version 2 (GPL-2.0)](http://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)**.

Summary (from http://oss-watch.ac.uk/resources/gpl):
>- copy and distribute the program’s unmodified source code (Section 1)
>- modify the program’s source code and distribute the modified source (Section 2)
>- distribute compiled versions of the program, both modified and unmodified (Section 3) provided that:
>  - all distributed copies (modified or not) carry a copyright notice and exclusion of warranty (Section 1 and 2)  
>  - all modified copies are distributed under the GPL v2 (Section 2)  
>  - all compiled versions of the program are accompanied by the relevant source code, or a viable offer to make the relevant source
code available (Section 3)

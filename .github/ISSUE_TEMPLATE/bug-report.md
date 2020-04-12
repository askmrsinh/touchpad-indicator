---
name: Bug report
about: Report an issue with touchpad-indicator@orangeshirt Gnome Shell extension
title: A very very short summary of the issue
labels: ''
assignees: ''

---

**Describe the issue**  
A clear and concise description of what the issue is.


---
**Expected behavior**  
A clear and concise description of what you expected to happen.


---
**Steps to reproduce the behavior**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error


---
**Screenshots** (if required, add screenshots to help explain your problem)


---
**Mandatory system details** (please complete/update the following information)
 - **Operating System:** Fedora 31 (Workstation Edition)
 - **Touchpad Indicator extension version:** 34
 - **Gnome Shell version:** GNOME Shell 3.34.5
 - **Display server:** X11 or Wayland
 - **Switching method:** GSetting or Xinput or Synclient
 - **Installation source:** [extensions.gnome.org](https://extensions.gnome.org/extension/131/touchpad-indicator/) or [GitHub repository](https://github.com/user501254/TouchpadIndicator)


 ---
 **Optional details** (mandatory if you are reporting issues with device detection, switch functionality)
 
 - **Input Devices** (ie. output for `cat /proc/bus/input/devices`)
    ```
    I: Bus=0019 Vendor=0000 Product=0005 Version=0000
    N: Name="Lid Switch"
    P: Phys=PNP0C0D/button/input0
    S: Sysfs=/devices/LNXSYSTM:00/LNXSYBUS:00/PNP0C0D:00/input/input0
    U: Uniq=
    H: Handlers=event0
    B: PROP=0
    B: EV=21
    B: SW=1

    .
    .
    .
    .
    ```

- **X input devices** (ie. output for `xinput list`)  
    ```
    ⎡ Virtual core pointer                          id=2    [master pointer  (3)]
    ⎜   ↳ Virtual core XTEST pointer                id=4    [slave  pointer  (2)]
    ⎜   ↳ DLL096D:01 06CB:CDE6 Touchpad             id=12   [slave  pointer  (2)]
    ⎜   ↳ Logitech B330/M330/M3                     id=9    [slave  pointer  (2)]
    ⎣ Virtual core keyboard                         id=3    [master keyboard (2)]
        ↳ Virtual core XTEST keyboard               id=5    [slave  keyboard (3)]
        ↳ Video Bus                                 id=6    [slave  keyboard (3)]
        ↳ Power Button                              id=7    [slave  keyboard (3)]
        ↳ Sleep Button                              id=8    [slave  keyboard (3)]
        ↳ Integrated_Webcam_HD: Integrate           id=10   [slave  keyboard (3)]
        ↳ Integrated_Webcam_HD: Integrate           id=11   [slave  keyboard (3)]
        ↳ Intel HID events                          id=13   [slave  keyboard (3)]
        ↳ Intel HID 5 button array                  id=14   [slave  keyboard (3)]
        ↳ Dell WMI hotkeys                          id=15   [slave  keyboard (3)]
        ↳ AT Translated Set 2 keyboard              id=16   [slave  keyboard (3)]
        ↳ Mi Sports BT Earphones Basic (AVRCP)      id=19   [slave  keyboard (3)]
        ↳ Logitech B330/M330/M3                     id=17   [slave  keyboard (3)]
    ```

- Log file (you can enable logging within the extension settings, "Debug" tab)  
  Please upload the log file `$HOME/.local/share/gnome-shell/extensions/touchpad-indicator@orangeshirt/touchpad-indicator.log`


--- 
**Additional context**  
Add any other context about the problem here.

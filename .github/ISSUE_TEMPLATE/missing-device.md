---
name: Missing device
about: Report missing input device type/string
title: Missing device of type touchscreen/trackpad/pen/etc
labels: bug
assignees: ''

---

This extension relies on the output of `cat /proc/bus/input/devices` and string matching to determine the input device type (ie. touchpad, trackpoint, touchscreen, fingertouch, pen).

In case you have a device of a particular type and it's not recognized by the extension, please provide/update the below details.

Additionally, you may create a [pull-request](https://github.com/user501254/TouchpadIndicator/pulls) by updating the required strings at https://github.com/user501254/TouchpadIndicator/blob/master/lib.js#L41-L45.

---
- **Product page or name of the device** (optional): eg. https://www.logitech.com/en-us/product/mx-master-3 

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

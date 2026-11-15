# Use a phone or another webcam with SpoofLab

Verified against the official sources below on November 12, 2026. The user's phone model/OS and Windows version still need confirmation. No phone route has yet been tested with this SpoofLab installation, and none guarantees sustained 25 FPS or accurate physiological measurements.

## Choose a route that fits your devices

### Android with Windows 11

Microsoft documents connected-camera support for Windows 11 or later, Android 10 or later, and Link to Windows 1.24022.0 or later. In Windows Settings, open **Bluetooth & devices → Mobile devices**, add/link the Android device if needed, select it and enable **Use as connected camera**. It should then appear in camera applications. Approve camera access on the phone; if a black permission placeholder appears, check the separate camera window on the Windows taskbar. [Microsoft connected-camera instructions](https://support.microsoft.com/en-gb/windows/apps/phonelink/use-your-mobile-device-s-camera)

### Pixel with a USB webcam option

Use a data-capable USB cable. On the Pixel, open the USB charging notification and choose **Use USB for → Webcam**. Google documents this as a USB Video Class camera connection. A phone app or video call using the camera can pause the webcam stream. If the Webcam option is absent, do not assume this route is supported by the phone/software combination. [Google's Pixel webcam instructions](https://support.google.com/pixelcamera/answer/14274129?hl=en-GB)

### iPhone, or an Android needing a software bridge

Camo's official guide documents Camo Studio on Windows and Camo Camera on iOS/Android. Windows needs its camera compatibility add-on. For iPhone, the vendor recommends an initial USB connection; wireless pairing is also documented. Android USB on Windows requires additional developer/USB-debugging setup, so follow the vendor instructions for the actual device rather than changing unrelated system settings. After Camo displays the phone feed, select its virtual camera in SpoofLab. Review the vendor's current terms, permissions and available features before installing. [Camo's official getting-started guide](https://camo.com/support/camo/camo-getting-started)

SpoofLab runs its native SmartSpectra integration in the Windows desktop app. Opening the report-preview URL on the phone does not turn the phone browser into that native SDK runtime.

## Select the camera in SpoofLab

1. Connect/configure the phone using its supported route. Close apps competing for its camera.
2. Open SpoofLab's Electron desktop app (`npm start`). Confirm consent.
3. Click **Refresh cameras**. This explicitly requests camera permission and briefly opens the default camera so Windows/Chromium can reveal device labels. The temporary stream is stopped after discovery.
4. Choose the phone or USB camera in the camera selector. An explicit selection is requested by exact device ID; a disconnected selection does not silently fall back to the built-in webcam.
5. Choose Performance / 640×480 and run **Check camera FPS / 6 seconds**. This test does not start SmartSpectra or consume SDK credits.
6. Read the full result: negotiated FPS, presented FPS and media-timestamp FPS. A negotiated “30 FPS” setting alone is insufficient evidence of actual delivery.
7. If delivered FPS reaches at least 25, try a consenting live pulse baseline with the blink check off first. Then evaluate the blink challenge separately.

Device IDs remain in the in-memory selector/request only. Trial metadata records the camera label, dimensions and negotiated frame rate, not hardware IDs. Camera labels can still reveal a device name; review reports before sharing them.

## When delivery remains low

The camera-only check measures presentation before SDK processing; it cannot alone isolate sensor, driver, exposure, host-load or preview scheduling effects. Improve lighting, keep the app visible, close other camera apps and compare another connection/camera. If camera-only delivery is adequate but SDK acknowledgements slow down, inspect application/SDK processing load instead. Do not duplicate frames, fabricate timestamps or relax the SDK's quality floor.

Mount the phone steadily with face and upper torso visible. For reproducible experiments, disable optional beautification, background replacement, automatic reframing and other transformations where the camera software allows it; document any unavoidable transformations. This is an experiment-design precaution, not a claim that a particular vendor's stream will work accurately with SmartSpectra.

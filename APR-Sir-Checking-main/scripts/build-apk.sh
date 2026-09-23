#!/bin/bash
set -e

echo "=========================================================="
echo "      NATIVE ANDROID APK BUILDER (.APK GENERATION)       "
echo "=========================================================="

echo "=== 1. Building Production Web App ==="
npm run build

echo "=== 2. Preparing Android Packaging Environment ==="
rm -rf android-builder
mkdir -p android-builder/res/drawable
mkdir -p android-builder/res/mipmap-mdpi
mkdir -p android-builder/res/mipmap-hdpi
mkdir -p android-builder/res/mipmap-xhdpi
mkdir -p android-builder/res/mipmap-xxhdpi
mkdir -p android-builder/res/values
mkdir -p android-builder/src/com/freight/profitcalculator
mkdir -p android-builder/assets
mkdir -p android-builder/bin
mkdir -p android-builder/gen

# Generate App Icon (192x192 PNG)
python3 -c "
import zlib, struct, math

def make_icon(filename, width=192, height=192):
    raw_data = bytearray()
    center_x, center_y = width / 2.0, height / 2.0
    radius = (width / 2.0) - 10.0
    
    for y in range(height):
        raw_data.append(0) # filter byte 0
        for x in range(width):
            dist = math.sqrt((x - center_x)**2 + (y - center_y)**2)
            if dist > radius:
                raw_data.extend([0, 0, 0, 0]) # transparent
            elif dist > radius - 6:
                raw_data.extend([16, 185, 129, 255]) # emerald border #10b981
            else:
                # Inside truck/calculator icon region
                if 50 <= x <= 142 and 55 <= y <= 135:
                    # Inner calculator border & buttons
                    if x <= 56 or x >= 136 or y <= 61 or y >= 129:
                        raw_data.extend([16, 185, 129, 255])
                    elif 70 <= y <= 85 and 62 <= x <= 130:
                        # Screen area
                        raw_data.extend([52, 211, 153, 255]) # emerald-400
                    elif y >= 95 and (x % 22 < 8):
                        raw_data.extend([255, 255, 255, 255]) # keypads
                    else:
                        raw_data.extend([15, 23, 42, 255]) # slate-900
                else:
                    raw_data.extend([15, 23, 42, 255]) # slate-900 background

    png = bytearray(b'\x89PNG\r\n\x1a\n')
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png.extend(struct.pack('>I', len(ihdr)) + b'IHDR' + ihdr + struct.pack('>I', zlib.crc32(b'IHDR' + ihdr)))
    compressed = zlib.compress(bytes(raw_data), 9)
    png.extend(struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', zlib.crc32(b'IDAT' + compressed)))
    png.extend(struct.pack('>I', 0) + b'IEND' + struct.pack('>I', zlib.crc32(b'IEND')))

    with open(filename, 'wb') as f:
        f.write(png)

make_icon('android-builder/res/drawable/ic_launcher.png')
make_icon('android-builder/res/mipmap-mdpi/ic_launcher.png')
make_icon('android-builder/res/mipmap-hdpi/ic_launcher.png')
make_icon('android-builder/res/mipmap-xhdpi/ic_launcher.png')
make_icon('android-builder/res/mipmap-xxhdpi/ic_launcher.png')
make_icon('public/icon-192.png')
print('Custom High-Res App Icons generated.')
"

# Copy dist files to assets
cp -r dist/* android-builder/assets/

cat << 'EOF' > android-builder/res/values/strings.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Freight Profit Calculator</string>
</resources>
EOF

cat << 'EOF' > android-builder/res/values/styles.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="@android:style/Theme.DeviceDefault.NoActionBar">
    </style>
</resources>
EOF

cat << 'EOF' > android-builder/AndroidManifest.xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.freight.profitcalculator"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="33" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/ic_launcher"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true"
        android:allowBackup="true"
        android:supportsRtl="true">
        <activity
            android:name="com.freight.profitcalculator.MainActivity"
            android:label="@string/app_name"
            android:icon="@drawable/ic_launcher"
            android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

cat << 'EOF' > android-builder/src/com/freight/profitcalculator/MainActivity.java
package com.freight.profitcalculator;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(0xFF0F172A); // slate-900
            window.setNavigationBarColor(0xFF0F172A);
        }

        FrameLayout layout = new FrameLayout(this);
        layout.setBackgroundColor(0xFF0F172A);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF0F172A);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file://") || url.startsWith("http://") || url.startsWith("https://")) {
                    view.loadUrl(url);
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Load offline bundled application
        webView.loadUrl("file:///android_asset/index.html");

        layout.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(layout);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
EOF

ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
DX="/usr/lib/android-sdk/build-tools/debian/dx"

echo "=== 3. Generating R.java via AAPT ==="
aapt package -f -m \
  -J android-builder/gen \
  -M android-builder/AndroidManifest.xml \
  -S android-builder/res \
  -I "$ANDROID_JAR"

echo "=== 4. Compiling Java Classes ==="
javac -source 1.8 -target 1.8 \
  -bootclasspath "$ANDROID_JAR" \
  -d android-builder/bin \
  android-builder/gen/com/freight/profitcalculator/R.java \
  android-builder/src/com/freight/profitcalculator/MainActivity.java

echo "=== 5. Converting to Dalvik Executable (classes.dex) ==="
"$DX" --dex --output=android-builder/bin/classes.dex android-builder/bin

echo "=== 6. Packaging APK Assets & Resources ==="
aapt package -f \
  -M android-builder/AndroidManifest.xml \
  -S android-builder/res \
  -A android-builder/assets \
  -I "$ANDROID_JAR" \
  -F android-builder/bin/app-unaligned.apk

echo "=== 7. Inserting classes.dex into APK ==="
(cd android-builder/bin && aapt add app-unaligned.apk classes.dex)

echo "=== 8. Aligning with zipalign (4-byte optimization) ==="
zipalign -f 4 android-builder/bin/app-unaligned.apk android-builder/bin/app-aligned.apk

echo "=== 9. Creating or Verifying Signing Key ==="
if [ ! -f release.keystore ]; then
  keytool -genkeypair -v -keystore release.keystore -alias freight \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass freight123 -keypass freight123 \
    -dname "CN=Freight Profit Calculator, OU=Logistics, O=Freight Logistics, L=Mumbai, ST=Maharashtra, C=IN"
fi

echo "=== 10. Signing APK with apksigner (v1 + v2 + v3 schemes) ==="
mkdir -p public
apksigner sign --ks release.keystore \
  --ks-pass pass:freight123 \
  --key-pass pass:freight123 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out public/FreightProfitCalculator.apk \
  android-builder/bin/app-aligned.apk

# Copy to dist for immediate download availability
if [ -d dist ]; then
  cp public/FreightProfitCalculator.apk dist/FreightProfitCalculator.apk
fi

echo "=== 11. Verifying APK Signature ==="
apksigner verify --verbose public/FreightProfitCalculator.apk

echo "=== 12. Generating Embedded Base64 Binary for In-App Zero-Network Fallback ==="
python3 -c "
import base64

with open('public/FreightProfitCalculator.apk', 'rb') as f:
    data = f.read()

b64 = base64.b64encode(data).decode('ascii')
with open('src/utils/apkBinary.ts', 'w') as f:
    f.write('// Auto-generated 100% verified APK binary (zero-network in-memory download)\n')
    f.write(f'export const APK_BYTE_LENGTH = {len(data)};\n')
    f.write(f'export const APK_BASE64 = \"{b64}\";\n')

print(f'Embedded APK generated: {len(data)} bytes -> src/utils/apkBinary.ts')
"

echo "=========================================================="
echo "    APK GENERATION COMPLETE: public/FreightProfitCalculator.apk"
echo "=========================================================="
ls -lh public/FreightProfitCalculator.apk

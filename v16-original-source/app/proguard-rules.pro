# LA PAUSE OS release hardening.
# Keep only Android entrypoints and JavaScript bridge contracts stable; allow R8 to
# shrink/obfuscate the rest of the application implementation.

-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault

-keepclasseswithmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.lapauseclub.manager.MainActivity { *; }
-keep class com.lapauseclub.manager.MainActivity$AndroidBridge { *; }
-keep class com.lapauseclub.manager.PremiumActivity { *; }
-keep class com.lapauseclub.manager.PremiumActivity$ClientBridge { *; }
-keep class com.lapauseclub.manager.SessionAlarmReceiver { *; }
-keep class com.lapauseclub.manager.BootReceiver { *; }

# ZXing is invoked directly but its public model is small; keep warnings from
# optional image/J2SE adapters out of Android release noise.
-dontwarn com.google.zxing.client.**

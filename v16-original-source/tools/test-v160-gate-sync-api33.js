'use strict';
// Harness-only gate sync marker: API33 uses lightweight display geometry; API36 waits for stabilized Web runtime before physical Back.
// This file is not packaged in the APK; it exists only to trigger CI + API33 + API36 on one SHA.
console.log('V160_GATE_SYNC_LIGHT_FRAME_RUNTIME_GATED_BACK_OK');

'use strict';
// Harness-only gate sync marker: pinned API33 uses the stable CDP daemon; API36 verifies/retries Floor after rotation.
// This file is not packaged in the APK; it exists only to trigger CI + API33 + API36 on one SHA.
console.log('V160_GATE_SYNC_API33_DAEMON_ROTATION_RETRY_OK');

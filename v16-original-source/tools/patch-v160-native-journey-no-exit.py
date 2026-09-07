from pathlib import Path

src_path = Path('v16-original-source/tools/android-v160-stabilization-journey.sh')
src = src_path.read_text(encoding='utf-8')
start = src.index('# Back from cash restores floor;')
end = src.index('# Relaunch after a true Activity exit:')
replacement = '''# Back from cash restores floor; a second Back on Home must NEVER finish MainActivity.
android_back "cash-to-floor-after-close"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor"' "ANDROID_BACK_AFTER_SHIFT_CLOSE"
android_back "home-remains-open"
assert_state 'import json,sys;p=json.load(sys.stdin);assert p["currentView"]=="floor"' "ANDROID_BACK_HOME_NO_EXIT"
log "ANDROID_BACK_HOME_NO_EXIT_OK"

'''
src = src[:start] + replacement + src[end:]
src = src.replace(
    '# Relaunch after a true Activity exit: closed-shift state and prior paid session data must still exist.',
    '# Relaunch after a deliberate process restart: closed-shift state and prior paid session data must still exist.'
)
src = src.replace(
    'launch_main || fail "final relaunch after Activity finish"',
    'launch_main || fail "final relaunch after Back no-exit verification"'
)
out = Path('/tmp/android-v160-stabilization-journey-no-exit.sh')
out.write_text(src, encoding='utf-8')
out.chmod(0o755)
print(out)

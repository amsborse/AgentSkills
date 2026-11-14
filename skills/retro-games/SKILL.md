---
name: retro-games
description: RetroArch on Android/Fire TV over adb: install games, PS5 pad for all games, save/resume, cheats, menu look, verified on the TV.
metadata:
  aliases: "retro games, retroarch, install game on fire tv, ps5 controller retroarch, dualsense retroarch, game cheats, save game progress, emulator on tv"
  keywords: "retroarch, emulator, nes, rom, playlist, cheats, savestate, dualsense, ps5, controller, gamepad, fire tv, android tv, adb, remap, autoconfig"
  composes: "verify"
  requires: "shell, adb, python-opencv"
  risk: "high"
---

# Retro games on a TV (RetroArch over adb)

Acts on a physical device: confirm which TV first, keep it on the private LAN, never change its
default Home app or firmware. Device address, adb path and installed package belong in the
project memory (e.g. a `<device>-access` memory), not in this skill. Only install games the owner
asked for; downloads are untrusted data (own empty folder, never executed).

`scripts/ra-tv.sh` wraps every command below: `source` it, set `ADB`, `DEV`, `PKG` (defaults:
`com.retroarch.ra32`), then call `ra_launch`, `ra_press`, `ra_dpad`, `ra_record`, `ra_sheet`.

## Facts that cost hours to learn

- **RetroArch rewrites `retroarch.cfg` on exit.** `am force-stop` it before pulling, editing and
  pushing the config, and back up the original first.
- **`screencap` returns stale frames while a game runs.** Verify with
  `screenrecord --time-limit N --size 960x540` started in the background *in the same adb shell*
  as the input, then pull and build a contact sheet (`ra_sheet`). Never report a visual check
  without that sheet.
- **Inject pad input with `sendevent` on the pad's own `/dev/input/eventN`** (find it with
  `getevent -pl`), so you test the real controller path. DualSense on Android: Cross 305,
  Circle 304, Square 308, Triangle 307, Create/Select 312, Options/Start 313, PS 316,
  Touchpad 317; D-pad is a hat: ABS 16 (x) and ABS 17 (y), values -1/0/1. Press = value 1, SYN,
  ~0.12 s, value 0, SYN. Menu navigation needs ~0.6–0.9 s between presses or inputs drop.
  `input keyevent 4` (Back) does not leave RetroArch submenus.
- **Launch a game directly:** `am start -n $PKG/com.retroarch.browser.retroactivity.RetroActivityFuture
  -e CONFIGFILE <cfg> -e ROM <rom> -e LIBRETRO <core .so> -e DATADIR /data/user/0/$PKG`.
- **Controller for every game:** one autoconfig file per pad model in `joypad_autoconfig_dir`
  covers all cores and all player slots; a per-core remap
  (`config/remaps/<Core>/<Core>.rmp`) covers every game on that core; a per-game remap
  (`<Core>/<rom basename>.rmp`) overrides it. Check every playlist entry's core has one.
  Prove player 2 in a real 2-player game, not only the menu.
- **Saves:** set `savestate_auto_save` and `savestate_auto_load` to "true". States land in
  `<savestate dir>/<Core>/<rom>.state.auto`. They are written **only when content closes**
  (Quick Menu → Close Content, or Quit). Home followed by Android killing the app saves
  nothing — test both, and tell the owner which exit keeps progress.
- **Cheats auto-load** from `cheat_database_path/<Core>/<rom basename>.cht` (core name as in
  the remap folder, e.g. `FCEUmm`), with `apply_cheats_after_load` = "true". Source:
  `libretro/libretro-database` `cht/<system>/<Game (Region)>.cht` — the GitHub contents API caps
  at 1000 entries, use the git trees API with `recursive=1`. Ship every cheat disabled;
  the owner toggles them in Quick Menu → Cheats. Prove auto-load once by enabling a visible cheat
  (e.g. "Start With 9 Lives") in a temporary copy, checking the HUD, then restoring the file.
  Cheats copied onto ROM hacks are untested — say so.
- **Playlists** (`playlists/*.lpl`) are JSON; set `core_path`, `core_name` and
  `crc32: "DETECT"` per item; pull, edit with a script, push.

## Steps

1. Read the project memory for the device; `adb connect` and confirm the model
   (`getprop ro.product.model`). Force-stop RetroArch, back up `retroarch.cfg` and every file
   you will change into a dated local folder.
2. Install: download each ROM into its own empty folder, check the header (`NES\x1a` for NES),
   push to the ROM folder, add playlist entries.
3. Controller: confirm the autoconfig and per-core remap exist for every core in use; record
   the pad's event node.
4. Saves and cheats: set the four config keys, push cheat files named after each ROM.
5. Verify on the TV with recordings: each new game boots and reacts to Start from the pad;
   save → Close Content → relaunch resumes; cheat auto-load; player 2.
6. Restore anything changed only for testing. Report in a few sentences: what works, how to exit
   so progress saves, where cheats live, what is untested.

## Menu look

RetroArch's menu drivers are `ozone`, `xmb`, `materialui` and `rgui`; none is a PS5 clone.
A console-style home is closer with XMB plus a dark wallpaper and box-art thumbnails
(`libretro-thumbnails/<system>/Named_Boxarts/<label>.png` into `thumbnails/<playlist>/`), or
with a separate launcher that starts each game through the intent above. Never replace a menu
the owner liked without keeping the old one selectable.

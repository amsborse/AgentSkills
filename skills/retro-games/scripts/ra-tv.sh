# Helpers for driving RetroArch on an Android/Fire TV over adb. Source this file (bash).
# Required: ADB (path to adb), DEV (e.g. 192.168.1.24:5555). Optional: PKG, PAD (event node).
# On Git Bash for Windows, export MSYS_NO_PATHCONV=1 first so device paths are not rewritten.
: "${PKG:=com.retroarch.ra32}"
: "${PAD:=/dev/input/event7}"
: "${RA_CFG:=/storage/emulated/0/Android/data/$PKG/files/retroarch.cfg}"
: "${RA_CORE:=/data/user/0/$PKG/cores/fceumm_libretro_android.so}"

ra_sh() { "$ADB" -s "$DEV" shell "$@"; }

# ra_launch <rom path on device> [core .so]
ra_launch() {
  ra_sh "am force-stop $PKG; am start -n $PKG/com.retroarch.browser.retroactivity.RetroActivityFuture -e CONFIGFILE $RA_CFG -e ROM $1 -e LIBRETRO ${2:-$RA_CORE} -e DATADIR /data/user/0/$PKG" >/dev/null
}

# Shell snippets to embed in one adb shell line (so input and screenrecord share a session).
# ra_press <code> [node]   e.g. 313 = Options/Start, 305 = Cross, 317 = Touchpad (menu)
ra_press() { local n="${2:-$PAD}"; echo "sendevent $n 1 $1 1; sendevent $n 0 0 0; sleep 0.12; sendevent $n 1 $1 0; sendevent $n 0 0 0; sleep 0.6;"; }
# ra_dpad <x|y> <-1|1> [node]
ra_dpad() { local n="${3:-$PAD}" a=16; [ "$1" = y ] && a=17; echo "sendevent $n 3 $a $2; sendevent $n 0 0 0; sleep 0.2; sendevent $n 3 $a 0; sendevent $n 0 0 0; sleep 0.8;"; }

# ra_record <seconds> <local.mp4> "<input snippets>"  — records while the inputs run.
ra_record() {
  ra_sh "screenrecord --time-limit $1 --size 960x540 /sdcard/ra-rec.mp4 & sleep 1; $3 wait"
  "$ADB" -s "$DEV" pull /sdcard/ra-rec.mp4 "$2" >/dev/null
}

# ra_sheet <in.mp4> <out.png> <t1,t2,...>  — contact sheet of frames at the given seconds.
ra_sheet() {
  python -I - "$1" "$2" "$3" <<'PY'
import sys, cv2, numpy as np
src, out, ts = sys.argv[1], sys.argv[2], [float(t) for t in sys.argv[3].split(',')]
c = cv2.VideoCapture(src); fr = []
while True:
    ok, f = c.read()
    if not ok: break
    fr.append((c.get(0) / 1000, f))
if not fr: sys.exit('no frames in ' + src)
tiles = [cv2.putText(cv2.resize(fr[i][1], (480, 270)), '%.1fs' % fr[i][0], (10, 30), 0, 1, (0, 255, 255), 2)
         for i in [min(range(len(fr)), key=lambda k: abs(fr[k][0] - t)) for t in ts]]
while len(tiles) % 4: tiles.append(np.zeros_like(tiles[0]))
cv2.imwrite(out, np.vstack([np.hstack(tiles[j:j + 4]) for j in range(0, len(tiles), 4)]))
PY
}

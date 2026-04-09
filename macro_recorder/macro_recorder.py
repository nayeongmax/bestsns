"""
게임 매크로 레코더 v4.0 (최종 게임 호환)
==========================================
사용법:
  1. 관리자 권한으로 cmd 실행
  2. python macro_recorder.py
  3. 게임 창으로 전환
  4. F9  : 녹화 시작 (60초)
  5. F10 : 반복 재생 시작/중지
  6. F11 : 테스트 (3초 후 wasd+클릭 테스트)
  7. F12 : 프로그램 종료
"""

import time
import json
import os
import sys
import threading
import ctypes
from ctypes import wintypes

import keyboard
from pynput import mouse
from pynput.mouse import Controller as MouseController

# ─────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────
RECORD_DURATION = 60
REPLAY_DELAY_BETWEEN = 1.0
SAVE_FILE = "macro_data.json"

# ─────────────────────────────────────────────
# Windows API
# ─────────────────────────────────────────────
user32 = ctypes.windll.user32

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_ABSOLUTE = 0x8000

KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_SCANCODE = 0x0008


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_void_p),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_void_p),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD),
    ]


class INPUT_UNION(ctypes.Union):
    _fields_ = [
        ("mi", MOUSEINPUT),
        ("ki", KEYBDINPUT),
        ("hi", HARDWAREINPUT),
    ]


class INPUT(ctypes.Structure):
    _fields_ = [
        ("type", wintypes.DWORD),
        ("union", INPUT_UNION),
    ]


def do_send_input(inputs):
    n = len(inputs)
    arr = (INPUT * n)(*inputs)
    user32.SendInput(n, arr, ctypes.sizeof(INPUT))


# ─────────────────────────────────────────────
# 키 매핑 (VK코드 + 하드웨어 스캔코드 동시)
# ─────────────────────────────────────────────
KEY_MAP = {
    #        (VK코드, 스캔코드)
    'w':     (0x57, 0x11),
    'a':     (0x41, 0x1E),
    's':     (0x53, 0x1F),
    'd':     (0x44, 0x20),
    'q':     (0x51, 0x10),
    'e':     (0x45, 0x12),
    'r':     (0x52, 0x13),
    't':     (0x54, 0x14),
    'f':     (0x46, 0x21),
    'g':     (0x47, 0x22),
    'h':     (0x48, 0x23),
    'i':     (0x49, 0x17),
    'j':     (0x4A, 0x24),
    'k':     (0x4B, 0x25),
    'l':     (0x4C, 0x26),
    'm':     (0x4D, 0x32),
    'n':     (0x4E, 0x31),
    'o':     (0x4F, 0x18),
    'p':     (0x50, 0x19),
    'u':     (0x55, 0x16),
    'v':     (0x56, 0x2F),
    'x':     (0x58, 0x2D),
    'y':     (0x59, 0x15),
    'z':     (0x5A, 0x2C),
    'b':     (0x42, 0x30),
    'c':     (0x43, 0x2E),
    '1':     (0x31, 0x02),
    '2':     (0x32, 0x03),
    '3':     (0x33, 0x04),
    '4':     (0x34, 0x05),
    '5':     (0x35, 0x06),
    '6':     (0x36, 0x07),
    '7':     (0x37, 0x08),
    '8':     (0x38, 0x09),
    '9':     (0x39, 0x0A),
    '0':     (0x30, 0x0B),
    'space':       (0x20, 0x39),
    'enter':       (0x0D, 0x1C),
    'tab':         (0x09, 0x0F),
    'esc':         (0x1B, 0x01),
    'backspace':   (0x08, 0x0E),
    'shift':       (0x10, 0x2A),
    'left shift':  (0xA0, 0x2A),
    'right shift': (0xA1, 0x36),
    'ctrl':        (0x11, 0x1D),
    'left ctrl':   (0xA2, 0x1D),
    'right ctrl':  (0xA3, 0x1D),
    'alt':         (0x12, 0x38),
    'left alt':    (0xA4, 0x38),
    'right alt':   (0xA5, 0x38),
    'f1': (0x70, 0x3B), 'f2': (0x71, 0x3C), 'f3': (0x72, 0x3D),
    'f4': (0x73, 0x3E), 'f5': (0x74, 0x3F), 'f6': (0x75, 0x40),
    'f7': (0x76, 0x41), 'f8': (0x77, 0x42),
    'up':    (0x26, 0x48),
    'down':  (0x28, 0x50),
    'left':  (0x25, 0x4B),
    'right': (0x27, 0x4D),
    'delete': (0x2E, 0x53),
}


def press_key(key_name, scan_code_recorded=0):
    """키 누르기 - 3가지 방법 동시 시도"""
    key_name = key_name.lower().strip()

    if key_name in KEY_MAP:
        vk, sc = KEY_MAP[key_name]
    elif scan_code_recorded:
        vk = 0
        sc = scan_code_recorded
    else:
        return

    # 방법1: SendInput (VK + 스캔코드 동시)
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp.union.ki.wVk = vk
    inp.union.ki.wScan = sc
    inp.union.ki.dwFlags = 0
    inp.union.ki.time = 0
    inp.union.ki.dwExtraInfo = 0
    do_send_input([inp])

    # 방법2: keybd_event (구형 API, 일부 게임 호환)
    user32.keybd_event(vk, sc, 0, 0)


def release_key(key_name, scan_code_recorded=0):
    """키 떼기 - 3가지 방법 동시 시도"""
    key_name = key_name.lower().strip()

    if key_name in KEY_MAP:
        vk, sc = KEY_MAP[key_name]
    elif scan_code_recorded:
        vk = 0
        sc = scan_code_recorded
    else:
        return

    # 방법1: SendInput
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp.union.ki.wVk = vk
    inp.union.ki.wScan = sc
    inp.union.ki.dwFlags = KEYEVENTF_KEYUP
    inp.union.ki.time = 0
    inp.union.ki.dwExtraInfo = 0
    do_send_input([inp])

    # 방법2: keybd_event
    user32.keybd_event(vk, sc, 0x0002, 0)


def click_mouse(x, y, button_str, pressed):
    """마우스 클릭"""
    screen_w = user32.GetSystemMetrics(0)
    screen_h = user32.GetSystemMetrics(1)
    abs_x = int(x * 65535 / screen_w)
    abs_y = int(y * 65535 / screen_h)

    # 마우스 이동
    user32.mouse_event(
        MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE,
        abs_x, abs_y, 0, 0
    )

    time.sleep(0.003)

    # 클릭
    if "left" in button_str.lower():
        flag = MOUSEEVENTF_LEFTDOWN if pressed else MOUSEEVENTF_LEFTUP
    elif "right" in button_str.lower():
        flag = MOUSEEVENTF_RIGHTDOWN if pressed else MOUSEEVENTF_RIGHTUP
    else:
        return

    user32.mouse_event(flag, 0, 0, 0, 0)


def move_mouse(x, y):
    """마우스 이동"""
    screen_w = user32.GetSystemMetrics(0)
    screen_h = user32.GetSystemMetrics(1)
    abs_x = int(x * 65535 / screen_w)
    abs_y = int(y * 65535 / screen_h)
    user32.mouse_event(
        MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE,
        abs_x, abs_y, 0, 0
    )


# ─────────────────────────────────────────────
# 이벤트 클래스
# ─────────────────────────────────────────────
class InputEvent:
    def __init__(self, event_type, timestamp, **kwargs):
        self.event_type = event_type
        self.timestamp = timestamp
        self.data = kwargs

    def to_dict(self):
        return {
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            **self.data
        }

    @staticmethod
    def from_dict(d):
        event_type = d.pop("event_type")
        timestamp = d.pop("timestamp")
        return InputEvent(event_type, timestamp, **d)


# ─────────────────────────────────────────────
# 테스트 함수
# ─────────────────────────────────────────────
def run_test():
    """3초 후 WASD + 마우스 클릭 테스트"""
    print("\n  [테스트] 3초 후 테스트 시작!")
    print("  메모장이나 게임을 열어두세요!")
    for i in range(3, 0, -1):
        print(f"  {i}...")
        time.sleep(1)

    print("  W키 누르기...")
    press_key('w')
    time.sleep(0.5)
    release_key('w')

    print("  A키 누르기...")
    press_key('a')
    time.sleep(0.5)
    release_key('a')

    print("  S키 누르기...")
    press_key('s')
    time.sleep(0.5)
    release_key('s')

    print("  D키 누르기...")
    press_key('d')
    time.sleep(0.5)
    release_key('d')

    print("  마우스 왼쪽 클릭...")
    pos = MouseController().position
    click_mouse(pos[0], pos[1], "left", True)
    time.sleep(0.1)
    click_mouse(pos[0], pos[1], "left", False)

    print("  [테스트 완료!]\n")


# ─────────────────────────────────────────────
# 매크로 레코더 v4.0
# ─────────────────────────────────────────────
class MacroRecorder:
    def __init__(self):
        self.events = []
        self.recording = False
        self.replaying = False
        self.start_time = 0
        self.record_duration = RECORD_DURATION
        self.mouse_controller = MouseController()
        self.replay_thread = None
        self.stop_replay_event = threading.Event()
        self.replay_count = 0
        self.lock = threading.Lock()
        self.kb_hook = None

    def hook_keyboard(self):
        """키보드 녹화 훅 설치"""
        if self.kb_hook is None:
            self.kb_hook = keyboard.hook(self.record_key_event)

    def unhook_keyboard(self):
        """키보드 녹화 훅 해제 (재생 중 간섭 방지)"""
        if self.kb_hook is not None:
            keyboard.unhook(self.kb_hook)
            self.kb_hook = None

    # ─── 녹화 ───

    def start_recording(self):
        with self.lock:
            if self.recording:
                return
            if self.replaying:
                print("[!] 재생 중에는 녹화할 수 없습니다.")
                return
            self.events = []
            self.recording = True
            self.start_time = time.time()

        # 녹화용 훅 설치
        self.hook_keyboard()

        print(f"\n{'='*50}")
        print(f"  녹화 시작! ({self.record_duration}초)")
        print(f"  게임으로 전환해서 플레이하세요!")
        print(f"{'='*50}\n")
        threading.Thread(target=self._record_timer, daemon=True).start()

    def _record_timer(self):
        remaining = self.record_duration
        while remaining > 0 and self.recording:
            if remaining % 10 == 0 or remaining <= 5:
                print(f"  남은 시간: {remaining}초")
            time.sleep(1)
            remaining -= 1
        if self.recording:
            self.stop_recording()

    def stop_recording(self):
        with self.lock:
            if not self.recording:
                return
            self.recording = False

        duration = time.time() - self.start_time
        print(f"\n{'='*50}")
        print(f"  녹화 완료! ({duration:.1f}초, {len(self.events)}개 이벤트)")
        print(f"  F10을 눌러 반복 재생 시작!")
        print(f"{'='*50}\n")
        self._save_events()

    def record_key_event(self, event):
        if not self.recording:
            return
        if event.name in ('f9', 'f10', 'f11', 'f12'):
            return
        timestamp = time.time() - self.start_time
        event_type = "key_press" if event.event_type == "down" else "key_release"
        self.events.append(InputEvent(
            event_type, timestamp,
            key=event.name, scan_code=event.scan_code
        ))

    def record_mouse_click(self, x, y, button, pressed):
        if self.replaying:
            return
        if not self.recording:
            return
        timestamp = time.time() - self.start_time
        event_type = "mouse_click_down" if pressed else "mouse_click_up"
        self.events.append(InputEvent(
            event_type, timestamp,
            x=x, y=y, button=str(button)
        ))

    def record_mouse_move(self, x, y):
        if self.replaying:
            return
        if not self.recording:
            return
        timestamp = time.time() - self.start_time
        if self.events:
            last = self.events[-1]
            if last.event_type == "mouse_move" and (timestamp - last.timestamp) < 0.05:
                return
        self.events.append(InputEvent(
            "mouse_move", timestamp, x=x, y=y
        ))

    def record_mouse_scroll(self, x, y, dx, dy):
        if self.replaying:
            return
        if not self.recording:
            return
        timestamp = time.time() - self.start_time
        self.events.append(InputEvent(
            "mouse_scroll", timestamp,
            x=x, y=y, dx=dx, dy=dy
        ))

    # ─── 재생 ───

    def toggle_replay(self):
        if self.recording:
            print("[!] 녹화 중에는 재생할 수 없습니다.")
            return
        if self.replaying:
            self.stop_replay()
        else:
            self.start_replay()

    def start_replay(self):
        if not self.events:
            if not self._load_events():
                print("[!] 녹화된 데이터가 없습니다. F9로 먼저 녹화하세요.")
                return

        # 재생 전 키보드 훅 해제 (간섭 방지!)
        self.unhook_keyboard()

        with self.lock:
            self.replaying = True
            self.replay_count = 0
            self.stop_replay_event.clear()

        print(f"\n{'='*50}")
        print(f"  반복 재생 시작! ({len(self.events)}개 이벤트)")
        print(f"  게임으로 전환하세요!")
        print(f"  F10: 중지 | F12: 종료")
        print(f"{'='*50}\n")
        self.replay_thread = threading.Thread(target=self._replay_loop, daemon=True)
        self.replay_thread.start()

    def stop_replay(self):
        with self.lock:
            if not self.replaying:
                return
            self.replaying = False
            self.stop_replay_event.set()
        self._release_all_keys()

        # 재생 끝나면 키보드 훅 다시 설치
        self.hook_keyboard()

        print(f"\n{'='*50}")
        print(f"  재생 중지! (총 {self.replay_count}회 반복)")
        print(f"{'='*50}\n")

    def _release_all_keys(self):
        for key_name in KEY_MAP:
            if key_name.startswith('f') and key_name[1:].isdigit():
                continue
            release_key(key_name)
        # 마우스 버튼도 해제
        user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)

    def _replay_loop(self):
        while self.replaying and not self.stop_replay_event.is_set():
            self.replay_count += 1
            print(f"  >> {self.replay_count}번째 반복 중...")
            self._replay_once()
            self._release_all_keys()
            if self.replaying:
                if self.stop_replay_event.wait(REPLAY_DELAY_BETWEEN):
                    break

    def _replay_once(self):
        if not self.events:
            return
        prev_timestamp = 0
        for event in self.events:
            if self.stop_replay_event.is_set():
                return
            delay = event.timestamp - prev_timestamp
            if delay > 0:
                wait_end = time.time() + delay
                while time.time() < wait_end:
                    if self.stop_replay_event.is_set():
                        return
                    remaining = wait_end - time.time()
                    time.sleep(min(0.005, max(0, remaining)))
            prev_timestamp = event.timestamp
            try:
                self._execute_event(event)
            except Exception:
                pass

    def _execute_event(self, event):
        et = event.event_type
        if et == "key_press":
            press_key(event.data.get("key", ""), event.data.get("scan_code", 0))
        elif et == "key_release":
            release_key(event.data.get("key", ""), event.data.get("scan_code", 0))
        elif et == "mouse_click_down":
            click_mouse(event.data["x"], event.data["y"], event.data["button"], True)
        elif et == "mouse_click_up":
            click_mouse(event.data["x"], event.data["y"], event.data["button"], False)
        elif et == "mouse_move":
            move_mouse(event.data["x"], event.data["y"])
        elif et == "mouse_scroll":
            self.mouse_controller.position = (event.data["x"], event.data["y"])
            self.mouse_controller.scroll(event.data["dx"], event.data["dy"])

    # ─── 저장/로드 ───

    def _save_events(self):
        save_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), SAVE_FILE)
        data = [e.to_dict() for e in self.events]
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  저장됨: {save_path}")

    def _load_events(self):
        save_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), SAVE_FILE)
        if not os.path.exists(save_path):
            return False
        try:
            with open(save_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.events = [InputEvent.from_dict(d) for d in data]
            print(f"  매크로 로드됨: {len(self.events)}개 이벤트")
            return True
        except Exception:
            return False


def main():
    recorder = MacroRecorder()

    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            if "record_duration" in config:
                recorder.record_duration = config["record_duration"]
        except Exception:
            pass

    print("""
==================================================
   게임 매크로 레코더 v4.0 (최종 게임 호환)
==================================================

  [F9]   녹화 시작 (60초)
  [F10]  반복 재생 시작/중지
  [F11]  테스트 (3초 후 WASD+클릭 테스트)
  [F12]  프로그램 종료

  ** SendInput + keybd_event 이중 전송!     **
  ** 재생 중 훅 해제로 간섭 차단!           **
  ** 반드시 관리자 권한으로 실행하세요!      **

==================================================
""")

    recorder._load_events()

    # 핫키 (글로벌)
    keyboard.on_press_key('f9', lambda e: recorder.start_recording(), suppress=False)
    keyboard.on_press_key('f10', lambda e: recorder.toggle_replay(), suppress=False)
    keyboard.on_press_key('f11', lambda e: threading.Thread(target=run_test, daemon=True).start(), suppress=False)
    keyboard.on_press_key('f12', lambda e: os._exit(0), suppress=False)

    # 마우스 녹화 훅 (글로벌)
    mouse_listener = mouse.Listener(
        on_click=recorder.record_mouse_click,
        on_move=recorder.record_mouse_move,
        on_scroll=recorder.record_mouse_scroll,
    )
    mouse_listener.start()

    print("대기 중... 게임으로 전환해도 됩니다!")
    print("")
    print("** 먼저 F11로 테스트하세요! **")
    print("   메모장을 열고 F11 누르면 wasd가 입력되는지 확인")
    print("")
    print("(F9: 녹화 | F10: 재생 | F11: 테스트 | F12: 종료)\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n종료합니다...")
        recorder.stop_replay()


if __name__ == "__main__":
    main()

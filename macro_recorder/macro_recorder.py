"""
게임 매크로 레코더 v2.0 (백그라운드 동작)
==========================================
게임 창이 전면에 있어도 백그라운드에서 동작합니다.

사용법:
  1. 관리자 권한으로 cmd 실행
  2. python macro_recorder.py
  3. 게임 창으로 전환
  4. F9  : 녹화 시작 (60초)
  5. F10 : 반복 재생 시작/중지
  6. F12 : 프로그램 종료
"""

import time
import json
import os
import sys
import threading
import ctypes
from ctypes import wintypes

# ── 글로벌 입력 감지를 위한 라이브러리 ──
import keyboard  # 글로벌 키보드 훅 (백그라운드 동작)
from pynput import mouse
from pynput.mouse import Button, Controller as MouseController

# ─────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────
RECORD_DURATION = 60
REPLAY_DELAY_BETWEEN = 1.0
SAVE_FILE = "macro_data.json"

# ─────────────────────────────────────────────
# Windows SendInput 구조체
# ─────────────────────────────────────────────
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
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(ctypes.c_ulong)),
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


def send_input(inputs):
    try:
        n_inputs = len(inputs)
        array = (INPUT * n_inputs)(*inputs)
        ctypes.windll.user32.SendInput(n_inputs, array, ctypes.sizeof(INPUT))
    except Exception:
        pass


# ─────────────────────────────────────────────
# 가상키 코드 매핑
# ─────────────────────────────────────────────
VK_CODE_MAP = {
    'up': 0x26, 'down': 0x28, 'left': 0x25, 'right': 0x27,
    'space': 0x20, 'enter': 0x0D,
    'shift': 0x10, 'left shift': 0xA0, 'right shift': 0xA1,
    'ctrl': 0x11, 'left ctrl': 0xA2, 'right ctrl': 0xA3,
    'alt': 0x12, 'left alt': 0xA4, 'right alt': 0xA5,
    'tab': 0x09, 'esc': 0x1B, 'backspace': 0x08, 'delete': 0x2E,
    'f1': 0x70, 'f2': 0x71, 'f3': 0x72, 'f4': 0x73,
    'f5': 0x74, 'f6': 0x75, 'f7': 0x76, 'f8': 0x77,
    'f9': 0x78, 'f10': 0x79, 'f11': 0x7A, 'f12': 0x7B,
    '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34, '5': 0x35,
    '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39, '0': 0x30,
    'q': 0x51, 'w': 0x57, 'e': 0x45, 'r': 0x52, 't': 0x54,
    'y': 0x59, 'u': 0x55, 'i': 0x49, 'o': 0x4F, 'p': 0x50,
    'a': 0x41, 's': 0x53, 'd': 0x44, 'f': 0x46, 'g': 0x47,
    'h': 0x48, 'j': 0x4A, 'k': 0x4B, 'l': 0x4C,
    'z': 0x5A, 'x': 0x58, 'c': 0x43, 'v': 0x56, 'b': 0x42,
    'n': 0x4E, 'm': 0x4D,
}


def get_vk_code(key_name):
    key_name = key_name.lower().strip()
    if key_name in VK_CODE_MAP:
        return VK_CODE_MAP[key_name]
    if len(key_name) == 1:
        return ord(key_name.upper())
    return None


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
# 매크로 레코더 (백그라운드 동작)
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
        """keyboard 라이브러리의 글로벌 훅에서 호출됨"""
        if not self.recording:
            return

        # 핫키(F9, F10, F12)는 녹화하지 않음
        if event.name in ('f9', 'f10', 'f12'):
            return

        timestamp = time.time() - self.start_time
        event_type = "key_press" if event.event_type == "down" else "key_release"

        self.events.append(InputEvent(
            event_type,
            timestamp,
            key=event.name,
            scan_code=event.scan_code
        ))

    def record_mouse_click(self, x, y, button, pressed):
        """pynput 마우스 리스너에서 호출됨"""
        if not self.recording:
            return

        timestamp = time.time() - self.start_time
        event_type = "mouse_click_down" if pressed else "mouse_click_up"

        self.events.append(InputEvent(
            event_type,
            timestamp,
            x=x, y=y,
            button=str(button)
        ))

    def record_mouse_move(self, x, y):
        """pynput 마우스 리스너에서 호출됨"""
        if not self.recording:
            return

        timestamp = time.time() - self.start_time

        if self.events:
            last = self.events[-1]
            if last.event_type == "mouse_move" and (timestamp - last.timestamp) < 0.05:
                return

        self.events.append(InputEvent(
            "mouse_move",
            timestamp,
            x=x, y=y
        ))

    def record_mouse_scroll(self, x, y, dx, dy):
        if not self.recording:
            return

        timestamp = time.time() - self.start_time
        self.events.append(InputEvent(
            "mouse_scroll",
            timestamp,
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

        with self.lock:
            self.replaying = True
            self.replay_count = 0
            self.stop_replay_event.clear()

        print(f"\n{'='*50}")
        print(f"  반복 재생 시작! ({len(self.events)}개 이벤트)")
        print(f"  게임으로 전환하세요! 백그라운드에서 동작합니다.")
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

        print(f"\n{'='*50}")
        print(f"  재생 중지! (총 {self.replay_count}회 반복)")
        print(f"{'='*50}\n")

    def _replay_loop(self):
        while self.replaying and not self.stop_replay_event.is_set():
            self.replay_count += 1
            print(f"  >> {self.replay_count}번째 반복 중...")
            self._replay_once()
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
                    time.sleep(min(0.01, max(0, remaining)))

            prev_timestamp = event.timestamp

            try:
                self._execute_event(event)
            except Exception as e:
                pass

    def _execute_event(self, event):
        et = event.event_type

        if et == "key_press":
            self._send_key(event.data.get("key", ""), event.data.get("scan_code", 0), False)
        elif et == "key_release":
            self._send_key(event.data.get("key", ""), event.data.get("scan_code", 0), True)
        elif et == "mouse_click_down":
            self._send_mouse_click(event.data["x"], event.data["y"], event.data["button"], True)
        elif et == "mouse_click_up":
            self._send_mouse_click(event.data["x"], event.data["y"], event.data["button"], False)
        elif et == "mouse_move":
            self._send_mouse_move(event.data["x"], event.data["y"])
        elif et == "mouse_scroll":
            self.mouse_controller.position = (event.data["x"], event.data["y"])
            self.mouse_controller.scroll(event.data["dx"], event.data["dy"])

    def _send_key(self, key_name, scan_code, is_release):
        """SendInput으로 키 입력 전송 (게임 포커스 상태에서도 동작)"""
        vk = get_vk_code(key_name)

        # scan_code가 저장되어 있으면 사용, 없으면 VK에서 변환
        if scan_code:
            sc = scan_code
        elif vk:
            sc = ctypes.windll.user32.MapVirtualKeyW(vk, 0)
        else:
            return

        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp.union.ki.wVk = vk if vk else 0
        inp.union.ki.wScan = sc
        inp.union.ki.dwFlags = KEYEVENTF_SCANCODE | (KEYEVENTF_KEYUP if is_release else 0)
        inp.union.ki.time = 0
        inp.union.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
        send_input([inp])

    def _send_mouse_click(self, x, y, button_str, pressed):
        """SendInput으로 마우스 클릭 전송"""
        screen_w = ctypes.windll.user32.GetSystemMetrics(0)
        screen_h = ctypes.windll.user32.GetSystemMetrics(1)
        abs_x = int(x * 65535 / screen_w)
        abs_y = int(y * 65535 / screen_h)

        # 이동
        move_inp = INPUT()
        move_inp.type = INPUT_MOUSE
        move_inp.union.mi.dx = abs_x
        move_inp.union.mi.dy = abs_y
        move_inp.union.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE
        move_inp.union.mi.mouseData = 0
        move_inp.union.mi.time = 0
        move_inp.union.mi.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))

        # 클릭
        click_inp = INPUT()
        click_inp.type = INPUT_MOUSE
        click_inp.union.mi.dx = abs_x
        click_inp.union.mi.dy = abs_y
        click_inp.union.mi.dwFlags = MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE

        if "left" in button_str.lower():
            click_inp.union.mi.dwFlags |= (MOUSEEVENTF_LEFTDOWN if pressed else MOUSEEVENTF_LEFTUP)
        elif "right" in button_str.lower():
            click_inp.union.mi.dwFlags |= (MOUSEEVENTF_RIGHTDOWN if pressed else MOUSEEVENTF_RIGHTUP)

        click_inp.union.mi.mouseData = 0
        click_inp.union.mi.time = 0
        click_inp.union.mi.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))

        send_input([move_inp, click_inp])

    def _send_mouse_move(self, x, y):
        """SendInput으로 마우스 이동"""
        screen_w = ctypes.windll.user32.GetSystemMetrics(0)
        screen_h = ctypes.windll.user32.GetSystemMetrics(1)
        abs_x = int(x * 65535 / screen_w)
        abs_y = int(y * 65535 / screen_h)

        inp = INPUT()
        inp.type = INPUT_MOUSE
        inp.union.mi.dx = abs_x
        inp.union.mi.dy = abs_y
        inp.union.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE
        inp.union.mi.mouseData = 0
        inp.union.mi.time = 0
        inp.union.mi.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
        send_input([inp])

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

    # 설정 파일 로드
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
    게임 매크로 레코더 v2.0 (백그라운드 동작)
==================================================

  [F9]   녹화 시작 (60초)
  [F10]  반복 재생 시작/중지
  [F12]  프로그램 종료

  ** 게임 창이 전면에 있어도 동작합니다! **
  ** 반드시 관리자 권한으로 실행하세요!  **

==================================================
""")

    # 저장된 매크로 자동 로드
    recorder._load_events()

    # ── 글로벌 키보드 훅 (어떤 창이 포커스여도 동작) ──
    # keyboard 라이브러리는 Windows 저수준 훅을 사용하므로
    # 게임이 전면에 있어도 키 입력을 감지하고 전달합니다.

    keyboard.on_press_key('f9', lambda e: recorder.start_recording(), suppress=False)
    keyboard.on_press_key('f10', lambda e: recorder.toggle_replay(), suppress=False)
    keyboard.on_press_key('f12', lambda e: os._exit(0), suppress=False)

    # 키보드 녹화: 모든 키 이벤트를 글로벌하게 캡처
    keyboard.hook(recorder.record_key_event)

    # ── 글로벌 마우스 훅 (pynput은 글로벌 마우스 감지 지원) ──
    mouse_listener = mouse.Listener(
        on_click=recorder.record_mouse_click,
        on_move=recorder.record_mouse_move,
        on_scroll=recorder.record_mouse_scroll,
    )
    mouse_listener.start()

    print("대기 중... 게임으로 전환해도 됩니다!")
    print("(F9: 녹화 | F10: 재생 | F12: 종료)\n")

    # 메인 스레드 유지 (프로그램이 종료되지 않도록)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n종료합니다...")
        recorder.stop_replay()


if __name__ == "__main__":
    main()

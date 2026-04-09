"""
게임 매크로 레코더 (Game Macro Recorder)
=========================================
키보드 및 마우스 입력을 녹화하고 반복 재생하는 프로그램입니다.

사용법:
  1. 프로그램 실행
  2. F9  : 녹화 시작 (기본 60초)
  3. F10 : 반복 재생 시작/중지
  4. F12 : 프로그램 종료

주의: 관리자 권한으로 실행해야 게임 내 입력이 정상 작동합니다.
"""

import time
import json
import os
import sys
import threading
import ctypes
from ctypes import wintypes
from collections import namedtuple
from pynput import mouse, keyboard
from pynput.mouse import Button, Controller as MouseController
from pynput.keyboard import Key, Controller as KeyboardController

# ─────────────────────────────────────────────
# 설정 (Configuration)
# ─────────────────────────────────────────────
RECORD_DURATION = 60       # 녹화 시간 (초)
REPLAY_DELAY_BETWEEN = 1.0 # 반복 재생 사이 대기 시간 (초)
SAVE_FILE = "macro_data.json"

# 핫키 설정
HOTKEY_RECORD = keyboard.Key.f9    # 녹화 시작
HOTKEY_REPLAY = keyboard.Key.f10   # 재생 시작/중지
HOTKEY_EXIT = keyboard.Key.f12     # 프로그램 종료

# ─────────────────────────────────────────────
# Windows SendInput 구조체 (게임 호환성 향상)
# ─────────────────────────────────────────────
INPUT_MOUSE = 0
INPUT_KEYBOARD = 1

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_ABSOLUTE = 0x8000
MOUSEEVENTF_WHEEL = 0x0800

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
    """Windows SendInput API를 사용하여 입력 전송"""
    try:
        n_inputs = len(inputs)
        array = (INPUT * n_inputs)(*inputs)
        ctypes.windll.user32.SendInput(n_inputs, array, ctypes.sizeof(INPUT))
    except Exception:
        pass  # Non-Windows 환경에서는 무시


# ─────────────────────────────────────────────
# 가상키 코드 매핑
# ─────────────────────────────────────────────
VK_CODE_MAP = {
    'Key.up': 0x26,
    'Key.down': 0x28,
    'Key.left': 0x25,
    'Key.right': 0x27,
    'Key.space': 0x20,
    'Key.enter': 0x0D,
    'Key.shift': 0x10,
    'Key.shift_l': 0xA0,
    'Key.shift_r': 0xA1,
    'Key.ctrl': 0x11,
    'Key.ctrl_l': 0xA2,
    'Key.ctrl_r': 0xA3,
    'Key.alt': 0x12,
    'Key.alt_l': 0xA4,
    'Key.alt_r': 0xA5,
    'Key.tab': 0x09,
    'Key.esc': 0x1B,
    'Key.f1': 0x70, 'Key.f2': 0x71, 'Key.f3': 0x72, 'Key.f4': 0x73,
    'Key.f5': 0x74, 'Key.f6': 0x75, 'Key.f7': 0x76, 'Key.f8': 0x77,
    'Key.f9': 0x78, 'Key.f10': 0x79, 'Key.f11': 0x7A, 'Key.f12': 0x7B,
    '1': 0x31, '2': 0x32, '3': 0x33, '4': 0x34, '5': 0x35,
    '6': 0x36, '7': 0x37, '8': 0x38, '9': 0x39, '0': 0x30,
    'q': 0x51, 'w': 0x57, 'e': 0x45, 'r': 0x52, 't': 0x54,
    'y': 0x59, 'u': 0x55, 'i': 0x49, 'o': 0x4F, 'p': 0x50,
    'a': 0x41, 's': 0x53, 'd': 0x44, 'f': 0x46, 'g': 0x47,
    'h': 0x48, 'j': 0x4A, 'k': 0x4B, 'l': 0x4C,
    'z': 0x5A, 'x': 0x58, 'c': 0x43, 'v': 0x56, 'b': 0x42,
    'n': 0x4E, 'm': 0x4D,
}


def get_vk_code(key_str):
    """키 문자열에서 가상키 코드를 반환"""
    if key_str in VK_CODE_MAP:
        return VK_CODE_MAP[key_str]
    # 단일 문자인 경우 ord() 사용
    if len(key_str) == 1:
        return ord(key_str.upper())
    return None


# ─────────────────────────────────────────────
# 이벤트 클래스
# ─────────────────────────────────────────────
class InputEvent:
    """녹화된 입력 이벤트"""

    def __init__(self, event_type, timestamp, **kwargs):
        self.event_type = event_type  # 'key_press', 'key_release', 'mouse_click', 'mouse_move', 'mouse_scroll'
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
# 매크로 레코더 클래스
# ─────────────────────────────────────────────
class MacroRecorder:
    def __init__(self):
        self.events = []
        self.recording = False
        self.replaying = False
        self.start_time = 0
        self.record_duration = RECORD_DURATION
        self.mouse_controller = MouseController()
        self.keyboard_controller = KeyboardController()
        self.replay_thread = None
        self.stop_replay_event = threading.Event()
        self.is_windows = sys.platform == 'win32'
        self.replay_count = 0

    # ─── 녹화 관련 ───

    def start_recording(self):
        """입력 녹화 시작"""
        if self.recording:
            print("[!] 이미 녹화 중입니다.")
            return
        if self.replaying:
            print("[!] 재생 중에는 녹화할 수 없습니다. 먼저 재생을 중지하세요.")
            return

        self.events = []
        self.recording = True
        self.start_time = time.time()

        print(f"\n{'='*50}")
        print(f"  ● 녹화 시작! ({self.record_duration}초 동안 녹화합니다)")
        print(f"  게임에서 원하는 동작을 수행하세요.")
        print(f"{'='*50}\n")

        # 녹화 타이머 (별도 스레드)
        timer_thread = threading.Thread(target=self._record_timer, daemon=True)
        timer_thread.start()

    def _record_timer(self):
        """녹화 시간 카운트다운"""
        remaining = self.record_duration
        while remaining > 0 and self.recording:
            if remaining % 10 == 0 or remaining <= 5:
                print(f"  ⏱ 남은 시간: {remaining}초")
            time.sleep(1)
            remaining -= 1

        if self.recording:
            self.stop_recording()

    def stop_recording(self):
        """녹화 중지"""
        if not self.recording:
            return

        self.recording = False
        duration = time.time() - self.start_time

        print(f"\n{'='*50}")
        print(f"  ■ 녹화 완료!")
        print(f"  녹화 시간: {duration:.1f}초")
        print(f"  기록된 이벤트: {len(self.events)}개")
        print(f"{'='*50}")
        print(f"  F10 키를 눌러 반복 재생을 시작하세요.")
        print(f"{'='*50}\n")

        # 파일로 저장
        self._save_events()

    def _on_key_press(self, key):
        """키보드 눌림 이벤트 기록"""
        if not self.recording:
            return

        key_str = str(key).replace("'", "")
        timestamp = time.time() - self.start_time

        self.events.append(InputEvent(
            "key_press",
            timestamp,
            key=key_str
        ))

    def _on_key_release(self, key):
        """키보드 뗌 이벤트 기록"""
        if not self.recording:
            return

        key_str = str(key).replace("'", "")
        timestamp = time.time() - self.start_time

        self.events.append(InputEvent(
            "key_release",
            timestamp,
            key=key_str
        ))

    def _on_mouse_click(self, x, y, button, pressed):
        """마우스 클릭 이벤트 기록"""
        if not self.recording:
            return

        timestamp = time.time() - self.start_time
        event_type = "mouse_click_down" if pressed else "mouse_click_up"

        self.events.append(InputEvent(
            event_type,
            timestamp,
            x=x,
            y=y,
            button=str(button)
        ))

    def _on_mouse_move(self, x, y):
        """마우스 이동 이벤트 기록 (100ms 간격으로 샘플링)"""
        if not self.recording:
            return

        timestamp = time.time() - self.start_time

        # 너무 많은 이동 이벤트 방지: 마지막 이동 이벤트와 50ms 이상 차이날 때만 기록
        if self.events:
            last = self.events[-1]
            if last.event_type == "mouse_move" and (timestamp - last.timestamp) < 0.05:
                return

        self.events.append(InputEvent(
            "mouse_move",
            timestamp,
            x=x,
            y=y
        ))

    def _on_mouse_scroll(self, x, y, dx, dy):
        """마우스 스크롤 이벤트 기록"""
        if not self.recording:
            return

        timestamp = time.time() - self.start_time

        self.events.append(InputEvent(
            "mouse_scroll",
            timestamp,
            x=x,
            y=y,
            dx=dx,
            dy=dy
        ))

    # ─── 재생 관련 ───

    def start_replay(self):
        """반복 재생 시작"""
        if self.recording:
            print("[!] 녹화 중에는 재생할 수 없습니다.")
            return

        if not self.events:
            # 저장된 파일에서 로드 시도
            if not self._load_events():
                print("[!] 녹화된 데이터가 없습니다. F9로 먼저 녹화하세요.")
                return

        if self.replaying:
            self.stop_replay()
            return

        self.replaying = True
        self.replay_count = 0
        self.stop_replay_event.clear()

        print(f"\n{'='*50}")
        print(f"  ▶ 반복 재생 시작! (이벤트 {len(self.events)}개)")
        print(f"  F10: 재생 중지 | F12: 프로그램 종료")
        print(f"{'='*50}\n")

        self.replay_thread = threading.Thread(target=self._replay_loop, daemon=True)
        self.replay_thread.start()

    def stop_replay(self):
        """재생 중지"""
        if not self.replaying:
            return

        self.replaying = False
        self.stop_replay_event.set()

        print(f"\n{'='*50}")
        print(f"  ⏹ 재생 중지! (총 {self.replay_count}회 반복됨)")
        print(f"{'='*50}\n")

    def _replay_loop(self):
        """재생 루프 (별도 스레드)"""
        while self.replaying and not self.stop_replay_event.is_set():
            self.replay_count += 1
            print(f"  ▶ {self.replay_count}번째 반복 재생 중...")

            self._replay_once()

            if self.replaying:
                print(f"  ✓ {self.replay_count}번째 반복 완료. {REPLAY_DELAY_BETWEEN}초 후 다시 시작...")
                # 대기 중에도 중지 가능
                if self.stop_replay_event.wait(REPLAY_DELAY_BETWEEN):
                    break

    def _replay_once(self):
        """녹화된 이벤트를 한 번 재생"""
        if not self.events:
            return

        prev_timestamp = 0

        for event in self.events:
            if self.stop_replay_event.is_set():
                return

            # 이벤트 간 시간 간격 유지
            delay = event.timestamp - prev_timestamp
            if delay > 0:
                # 긴 지연은 0.01초 단위로 나눠서 중지 확인
                wait_end = time.time() + delay
                while time.time() < wait_end:
                    if self.stop_replay_event.is_set():
                        return
                    remaining = wait_end - time.time()
                    time.sleep(min(0.01, max(0, remaining)))

            prev_timestamp = event.timestamp

            # 이벤트 재생
            try:
                self._execute_event(event)
            except Exception as e:
                print(f"  [경고] 이벤트 재생 실패: {e}")

    def _execute_event(self, event):
        """개별 이벤트 실행"""
        if event.event_type == "key_press":
            self._replay_key_press(event.data["key"])

        elif event.event_type == "key_release":
            self._replay_key_release(event.data["key"])

        elif event.event_type == "mouse_click_down":
            self._replay_mouse_click(event.data["x"], event.data["y"],
                                     event.data["button"], True)

        elif event.event_type == "mouse_click_up":
            self._replay_mouse_click(event.data["x"], event.data["y"],
                                     event.data["button"], False)

        elif event.event_type == "mouse_move":
            self._replay_mouse_move(event.data["x"], event.data["y"])

        elif event.event_type == "mouse_scroll":
            self._replay_mouse_scroll(event.data["x"], event.data["y"],
                                      event.data["dx"], event.data["dy"])

    def _replay_key_press(self, key_str):
        """키 누름 재생"""
        if self.is_windows:
            vk = get_vk_code(key_str)
            if vk:
                scan = ctypes.windll.user32.MapVirtualKeyW(vk, 0)
                inp = INPUT()
                inp.type = INPUT_KEYBOARD
                inp.union.ki.wVk = vk
                inp.union.ki.wScan = scan
                inp.union.ki.dwFlags = 0
                inp.union.ki.time = 0
                inp.union.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
                send_input([inp])
                return

        # pynput 폴백
        try:
            key_obj = self._str_to_key(key_str)
            if key_obj:
                self.keyboard_controller.press(key_obj)
        except Exception:
            pass

    def _replay_key_release(self, key_str):
        """키 뗌 재생"""
        if self.is_windows:
            vk = get_vk_code(key_str)
            if vk:
                scan = ctypes.windll.user32.MapVirtualKeyW(vk, 0)
                inp = INPUT()
                inp.type = INPUT_KEYBOARD
                inp.union.ki.wVk = vk
                inp.union.ki.wScan = scan
                inp.union.ki.dwFlags = KEYEVENTF_KEYUP
                inp.union.ki.time = 0
                inp.union.ki.dwExtraInfo = ctypes.pointer(ctypes.c_ulong(0))
                send_input([inp])
                return

        # pynput 폴백
        try:
            key_obj = self._str_to_key(key_str)
            if key_obj:
                self.keyboard_controller.release(key_obj)
        except Exception:
            pass

    def _replay_mouse_click(self, x, y, button_str, pressed):
        """마우스 클릭 재생"""
        if self.is_windows:
            # 절대 좌표로 마우스 이동 + 클릭
            screen_w = ctypes.windll.user32.GetSystemMetrics(0)
            screen_h = ctypes.windll.user32.GetSystemMetrics(1)
            abs_x = int(x * 65535 / screen_w)
            abs_y = int(y * 65535 / screen_h)

            # 마우스 이동
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
            return

        # pynput 폴백
        self.mouse_controller.position = (x, y)
        button = Button.left if "left" in button_str.lower() else Button.right
        if pressed:
            self.mouse_controller.press(button)
        else:
            self.mouse_controller.release(button)

    def _replay_mouse_move(self, x, y):
        """마우스 이동 재생"""
        if self.is_windows:
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
            return

        self.mouse_controller.position = (x, y)

    def _replay_mouse_scroll(self, x, y, dx, dy):
        """마우스 스크롤 재생"""
        self.mouse_controller.position = (x, y)
        self.mouse_controller.scroll(dx, dy)

    def _str_to_key(self, key_str):
        """문자열을 pynput Key 객체로 변환"""
        # Key.xxx 형태
        if key_str.startswith("Key."):
            key_name = key_str[4:]
            try:
                return getattr(Key, key_name)
            except AttributeError:
                return None
        # 단일 문자
        if len(key_str) == 1:
            return key_str
        return None

    # ─── 저장/불러오기 ───

    def _save_events(self):
        """이벤트를 JSON 파일로 저장"""
        save_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), SAVE_FILE)
        data = [e.to_dict() for e in self.events]
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"  💾 매크로 데이터 저장됨: {save_path}")

    def _load_events(self):
        """JSON 파일에서 이벤트 불러오기"""
        save_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), SAVE_FILE)
        if not os.path.exists(save_path):
            return False
        try:
            with open(save_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.events = [InputEvent.from_dict(d) for d in data]
            print(f"  📂 저장된 매크로 로드됨: {len(self.events)}개 이벤트")
            return True
        except Exception as e:
            print(f"  [오류] 매크로 로드 실패: {e}")
            return False

    # ─── 메인 실행 ───

    def run(self):
        """프로그램 메인 루프"""
        print(f"""
╔══════════════════════════════════════════════════╗
║         게임 매크로 레코더 v1.0                  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  [F9]   녹화 시작 ({self.record_duration}초)                    ║
║  [F10]  반복 재생 시작/중지                      ║
║  [F12]  프로그램 종료                            ║
║                                                  ║
║  ※ 관리자 권한으로 실행하면 게임 내 입력이       ║
║    더 잘 인식됩니다.                             ║
║                                                  ║
╚══════════════════════════════════════════════════╝
""")

        # 저장된 매크로가 있으면 자동 로드
        self._load_events()

        # 핫키 리스너 (별도 스레드)
        def on_hotkey_press(key):
            if key == HOTKEY_RECORD:
                self.start_recording()
            elif key == HOTKEY_REPLAY:
                if self.replaying:
                    self.stop_replay()
                else:
                    self.start_replay()
            elif key == HOTKEY_EXIT:
                print("\n프로그램을 종료합니다...")
                self.stop_replay()
                os._exit(0)

        # 마우스 리스너
        mouse_listener = mouse.Listener(
            on_click=self._on_mouse_click,
            on_move=self._on_mouse_move,
            on_scroll=self._on_mouse_scroll,
        )

        # 키보드 리스너
        keyboard_listener = keyboard.Listener(
            on_press=lambda key: (self._on_key_press(key), on_hotkey_press(key)),
            on_release=self._on_key_release,
        )

        mouse_listener.start()
        keyboard_listener.start()

        print("대기 중... (F9: 녹화, F10: 재생, F12: 종료)\n")

        try:
            keyboard_listener.join()
        except KeyboardInterrupt:
            print("\n프로그램을 종료합니다...")
            self.stop_replay()


# ─────────────────────────────────────────────
# 설정 파일 기반 커스터마이징
# ─────────────────────────────────────────────
def load_config():
    """설정 파일이 있으면 로드"""
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def main():
    config = load_config()

    recorder = MacroRecorder()

    # 설정 파일에서 녹화 시간 오버라이드
    if "record_duration" in config:
        recorder.record_duration = config["record_duration"]
        print(f"[설정] 녹화 시간: {recorder.record_duration}초")

    recorder.run()


if __name__ == "__main__":
    main()

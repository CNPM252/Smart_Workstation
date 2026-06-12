# Insert this code into your YOLO:BIT device
# , then press save to store config

from yolobit import *
import machine
import ubinascii
import time
import json
import sys
import uselect
from aiot_lcd1602 import LCD1602

# ==========================================
# KHỞI TẠO MÀN HÌNH LCD 16x2
# ==========================================
try:
    lcd = LCD1602()
    lcd.backlight_on()
    lcd.clear()
    lcd.move_to(0, 0)
    lcd.putstr("Smart Desk OS")
    time.sleep(2)
    lcd.clear()
    has_lcd = True
except Exception as e:
    has_lcd = False

# ==========================================
# CẤU HÌNH BIẾN TOÀN CỤC & THUẬT TOÁN
# ==========================================
mac_bytes = machine.unique_id()
mac_string = ubinascii.hexlify(mac_bytes, ':').decode().upper()

loop_count = 0
is_sleeping = False

# Cấu hình Auto-dim và điều khiển từ Server
auto_dim_mode = True
manual_brightness_val = 100

# Biến phục vụ thuật toán làm mượt (Smoothing)
current_pwm_float = 100.0
smoothing_factor = 0.2

# Cấu hình bộ nghe Serial (Non-blocking poll)
poll_obj = uselect.poll()
poll_obj.register(sys.stdin, uselect.POLLIN)
serial_buffer = ""

# Hàm tính khoảng cách siêu âm
def read_ultrasonic(trig_pin, echo_pin):
    trig_pin.write_digital(0)
    time.sleep_us(2)
    trig_pin.write_digital(1)
    time.sleep_us(10)
    trig_pin.write_digital(0)
    try:
        duration = machine.time_pulse_us(echo_pin.pin, 1, 30000)
        if duration > 0:
            return int((duration * 0.0343) / 2)
        return 0
    except:
        return 0

# ==========================================
# VÒNG LẶP CHÍNH (MAIN LOOP)
# ==========================================
while True:
    loop_count += 1

    # 1. LẮNG NGHE LỆNH TERMINAL/REACT
    while poll_obj.poll(0):
        try:
            char = sys.stdin.read(1)
            if char == '\n' or char == '\r':
                if serial_buffer:
                    try:
                        cmd_data = json.loads(serial_buffer)
                        if cmd_data.get("cmd") == "SLEEP":
                            is_sleeping = True
                            if has_lcd:
                                lcd.backlight_off()
                        elif cmd_data.get("cmd") == "AWAKE":
                            is_sleeping = False
                            # Cập nhật cấu hình do người dùng setting trên Web
                            auto_dim_mode = cmd_data.get("auto", True)
                            manual_brightness_val = cmd_data.get("val", 100)
                            if has_lcd:
                                lcd.backlight_on()
                                lcd.clear()
                    except ValueError:
                        pass
                    serial_buffer = ""
            else:
                serial_buffer += char
        except:
            break

    # 2. LẮNG NGHE NÚT BẤM CỨNG (Phục vụ test nhanh)
    if button_a.is_pressed(): # Ngủ
        is_sleeping = True
        if has_lcd: lcd.backlight_off()
        time.sleep(0.5)

    if button_b.is_pressed(): # Thức
        is_sleeping = False
        if has_lcd:
            lcd.backlight_on()
            lcd.clear()
        time.sleep(0.5)

    # 3. THỰC THI THEO TRẠNG THÁI
    distance_val = read_ultrasonic(pin14, pin15)

    if is_sleeping:
        # ----------------------------------
        # TRẠNG THÁI NGỦ (SLEEP)
        # ----------------------------------
        display.clear() # Tắt LED Matrix

        if has_lcd:
            lcd.move_to(0, 0)
            lcd.putstr("Zzz... SLEEPING ")
            lcd.move_to(0, 1)
            lcd.putstr("Power Saving... ")

        data = {
            "mac_address": mac_string,
            "status": "sleeping",
            "distance": distance_val,
            "loop": loop_count
        }
        print(json.dumps(data))
        time.sleep(3) # Tần suất rùa bò để tiết kiệm pin

    else:
        # ----------------------------------
        # TRẠNG THÁI THỨC (AWAKE)
        # ----------------------------------
        raw_light = pin0.read_analog()
        light_val = int((raw_light / 4095) * 100)
        motion_val = (pin16.read_digital() == 1)

        # XỬ LÝ QUYỀN GHI ĐÈ AUTO-DIM TỪ SERVER
        if auto_dim_mode:
            target_pwm = 100 - light_val # Tự động điều chỉnh theo môi trường
        else:
            target_pwm = manual_brightness_val # Lấy giá trị thủ công từ Web

        target_pwm = max(10, min(100, target_pwm)) # Chốt chặn an toàn (10-100%)

        # Áp dụng Exponential Smoothing
        current_pwm_float = current_pwm_float + smoothing_factor * (target_pwm - current_pwm_float)
        final_pwm_int = int(current_pwm_float)

        # Xuất cường độ sáng ra Matrix LED 5x5
        white_intensity = int((final_pwm_int / 100) * 255)
        display.set_all((white_intensity, white_intensity, white_intensity))

        # Cập nhật LCD
        if has_lcd:
            status_text = "YES" if motion_val else "NO "
            mode_label = "A_PWM" if auto_dim_mode else "M_PWM"
            lcd.move_to(0, 0)
            lcd.putstr("Dist:{:<3}cm P:{}".format(distance_val, status_text))
            lcd.move_to(0, 1)
            lcd.putstr("L:{:<3}% {}:{:<3}%".format(light_val, mode_label, final_pwm_int))

        # Đóng gói JSON nguyên bản chuẩn hóa
        data = {
            "mac_address": mac_string,
            "status": "awake",
            "light": light_val,
            "distance": distance_val,
            "motion": motion_val,
            "loop": loop_count
        }
        print(json.dumps(data))
        time.sleep(1) #  1hz

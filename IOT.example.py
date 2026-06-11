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




    // const Dashboard = () => {
                               //   const [isConnected, setIsConnected] = useState(false);
    //   const [sensorData, setSensorData] = useState({ distance: 0, light: 0, motion: false });
    //   const portRef = useRef(null);
    //
    //   const connectToYoloBit = async () => {
                                              //     try {
//       const port = await navigator.serial.requestPort();
//       await port.open({ baudRate: 115200 });
//
//       // ==========================================
//       // 🚀 BÙA CHỐNG RESET CHO MẠCH ESP32/YOLOBIT
                                       //       // Ngăn Chrome gửi tín hiệu khởi động lại mạch \
                                                                                          //       await port.setSignals({ dataTerminalReady: true, requestToSend: true });
//
//       // Cho mạch nghỉ 1 giây để ổn định kết nối USB
                                                    //       await new Promise(resolve => setTimeout(resolve, 1000));
//       // ==========================================
//
//       portRef.current = port;
//       setIsConnected(true);
//       console.log("✅ Đã kết nối Yolo:Bit! Đang chờ dữ liệu...");
//
//       const textDecoder = new TextDecoderStream();
//       const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
//       const reader = textDecoder.readable.getReader();
//
//       let buffer = "";
//
//       while (true) {
//         const { value, done } = await reader.read();
//         if (done) {
//           reader.releaseLock();
//           break;
//         }
//
//         buffer += value;
//
//         let newlineIndex = buffer.indexOf('\n');
//
//         while (newlineIndex >= 0) {
//           // Lấy 1 dòng và cắt bỏ rác hai đầu
//           let line = buffer.slice(0, newlineIndex).trim();
//           buffer = buffer.slice(newlineIndex + 1);
//
//           // CHIẾN THUẬT MỚI: Bắt đúng đoạn bắt đầu bằng '{' và kết thúc bằng '}'
                                                                                 //           const startIndex = line.indexOf('{');
//           const endIndex = line.lastIndexOf('}');
//
//           if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
//             const cleanJsonString = line.substring(startIndex, endIndex + 1);
//
//             try {
//               const data = JSON.parse(cleanJsonString);
//
//               // In ra F12 để sếp biết React đã đọc được
//               console.log("🎯 Data nhận được:", data);
//
//               setSensorData({
//                 macAddress: data.mac_address,
//                 distance: data.distance,
//                 light: data.light,
//                 motion: data.motion
                           //               });
//
//             } catch (err) {
                             //               console.warn("⚠️ Bỏ qua dòng JSON lỗi:", cleanJsonString);
//             }
//           } else if (line.length > 0) {
//             // In ra để xem có rác gì lạ không
//             console.log("🗑️ Dòng rác bị bỏ qua:", line);
//           }
//
//           newlineIndex = buffer.indexOf('\n');
//         }
//       }
//     } catch (error) {
                       //       console.error("❌ Lỗi hoặc người dùng hủy kết nối:", error);
//       setIsConnected(false);
//     }
//   };
//
//   return (
    //       <div className="dashboard-container p-6">
    //         <header className="mb-6">
    //           <h2 className="text-2xl font-bold mb-4">Workstation Dashboard</h2>
    //           {!isConnected ? (
    //               <button
    //                   onClick={connectToYoloBit}
    //                   className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 py-2 rounded shadow transition duration-200"
    //               >
    //                 🔌 Kết nối Yolo:Bit
    //               </button>
    //           ) : (
    //               <span className="text-green-500 font-bold bg-green-100 px-4 py-2 rounded border border-green-300">
    //             🟢 Đang nhận dữ liệu trực tiếp...
    //           </span>
    //           )}
//         </header>
//
//         {/* Demo hiển thị dữ liệu */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
//           <div className="card border p-6 rounded-lg shadow-sm bg-white text-center">
//             <h3 className="text-gray-500 font-semibold mb-2">Độ sáng</h3>
//             <p className="text-4xl font-bold text-yellow-500">{sensorData.light} <span className="text-xl">%</span></p>
//           </div>
//           <div className="card border p-6 rounded-lg shadow-sm bg-white text-center">
//             <h3 className="text-gray-500 font-semibold mb-2">Khoảng cách</h3>
//             <p className="text-4xl font-bold text-blue-500">{sensorData.distance} <span className="text-xl">cm</span></p>
//           </div>
//           <div className="card border p-6 rounded-lg shadow-sm bg-white text-center">
//             <h3 className="text-gray-500 font-semibold mb-2">Chuyển động</h3>
//             <p className="text-4xl font-bold text-red-500">
//               {sensorData.motion ? "🏃 Có người" : "Trống"}
//             </p>
//           </div>
//         </div>
//       </div>
//   );
// };
# Insert this code into your YOLO:BIT device
# , then press save to store config

from yolobit import *
import machine
import ubinascii
import time
import json

# Lấy MAC Address
mac_bytes = machine.unique_id()
mac_string = ubinascii.hexlify(mac_bytes, ':').decode().upper()

# Hàm tính toán khoảng cách cho cảm biến siêu âm (không cần cài thêm thư viện ngoài)
def read_ultrasonic(trig_pin, echo_pin):
    # Phát xung Trigger
    trig_pin.write_digital(0)
    time.sleep_us(2)
    trig_pin.write_digital(1)
    time.sleep_us(10)
    trig_pin.write_digital(0)

    try:
        # Đo thời gian xung Echo dội về (dùng hàm time_pulse_us của MicroPython)
        # Biến .pin ở đây là để lấy đối tượng phần cứng thật bên dưới của OhStem
        duration = machine.time_pulse_us(echo_pin.pin, 1, 30000)
        if duration > 0:
            # Công thức tính khoảng cách: (Thời gian * Vận tốc âm thanh) / 2
            return int((duration * 0.0343) / 2)
        return 0
    except:
        return 0

while True:
    # Đọc ánh sáng (Từ cảm biến ngoài cắm cổng P0)
    # read_analog() trả về 0 - 4095, ép về % (0-100)
    raw_light = pin0.read_analog()
    light_val = int((raw_light / 4095) * 100)

    # Đọc chuyển động (Từ cảm biến cắm cổng P16/P12)
    motion_val = (pin16.read_digital() == 1)

    # Đọc khoảng cách (Từ cảm biến cắm cổng P3/P6)
    # Giả sử Trigger cắm vào chân P3, Echo cắm vào P6.
    distance_val = read_ultrasonic(pin14, pin15)

    # 4. Gói thành JSON chuẩn
    data = {
        "mac_address": mac_string,
        "distance": distance_val,
        "motion": motion_val,
        "light": light_val
    }

    # Đẩy ra cáp USB
    print(json.dumps(data))

    time.sleep(2)







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
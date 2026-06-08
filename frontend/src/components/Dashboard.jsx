import React, { useEffect, useState, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-calendar-heatmap/dist/styles.css';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, isGuest } = useAuth();

  const [kpiData, setKpiData] = useState({
    sittingHours: 0,
    posturePercent: 0,
    averageDistance: 0,
    sleepHours: 0
  });
  const [heatmapData, setHeatmapData] = useState([]);
  const [message, setMessage] = useState('');
  const [chartData, setChartData] = useState([])

  // Mock data biểu đồ
  // const chartData = [
  //   { day: 'T2', hours: 3 }, { day: 'T3', hours: 4.5 },
  //   { day: 'T4', hours: 2 }, { day: 'T5', hours: 5 },
  //   { day: 'T6', hours: 4.2 }, { day: 'T7', hours: 1 },
  //   { day: 'CN', hours: 0 },
  // ];

  const currentUserId = isGuest
      ? sessionStorage.getItem('guestId')
      : (user?.id || user?.userId || user?.uuid || user?.username || (typeof user === 'string' ? user : ''));

  // Xác định năm hiện tại (2026)
  const currentYear = new Date().getFullYear();
  const startDate = new Date(`${currentYear}-01-01`);
  const endDate = new Date(`${currentYear}-12-31`);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUserId) return;

      try {
        // 1. Fetch Today Stats
        const todayRes = await axiosClient.get('/api/dashboard/today', {
          params: { userId: currentUserId }
        });

        if (todayRes.data.message) {
          setMessage(todayRes.data.message);
        } else if (todayRes.data) {
          setKpiData({
            sittingHours: todayRes.data.sittingHours || 0,
            posturePercent: todayRes.data.posturePercent || 0,
            averageDistance: todayRes.data.averageDistance || 0,
            sleepHours: todayRes.data.sleepHours || 0
          });
          setMessage('');
        }

        // 2. Fetch Heatmap Data (Chỉ lấy nếu không phải Guest)
        if (!isGuest) {
          const heatmapRes = await axiosClient.get('/api/dashboard/heatmap', {
            params: { userId: currentUserId, year: currentYear }
          });
          if (heatmapRes.data) {
            setHeatmapData(heatmapRes.data);
          }
        }
        //3 fetch weekly data
        const weekly = await axiosClient.get('api/dashboard/weekly-chart', {
          params: { userId: currentUserId }
        })

        if (weekly){
          setChartData(weekly.data);
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu Dashboard:", error);
      }
    };

    fetchDashboardData();
  }, [currentUserId, isGuest, currentYear]);

  return (
      <div className="dashboard-container">
        {message && (
            <div style={{ padding: '15px', backgroundColor: '#e7f1ff', color: '#004792', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
              {message}
            </div>
        )}

        {/* Hàng 1: Các chỉ số KPI */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-title">Đã ngồi hôm nay</div>
            <div className="kpi-value blue">{kpiData.sittingHours} giờ</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Tỷ lệ tư thế chuẩn</div>
            <div className="kpi-value green">{kpiData.posturePercent}%</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Khoảng cách thường giữ</div>
            <div className="kpi-value purple">{kpiData.averageDistance} cm</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-title">Tài nguyên tiết kiệm</div>
            <div className="kpi-value orange">{kpiData.sleepHours} giờ</div>
          </div>
        </div>

        {/* Hàng 2: Biểu đồ */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Thống kê thời gian ngồi</h3>
            <select className="chart-select">
              <option>Tuần này</option>
              <option>Tháng này</option>
            </select>
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#3b82f6' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hàng 3: Heatmap GitHub Contributions */}
        {!isGuest && (
            <div className="heatmap-card">
              <h3>Mức độ chăm chỉ trong năm {currentYear}</h3>
              <div className="heatmap-wrapper">
                <CalendarHeatmap
                    startDate={startDate}
                    endDate={endDate}
                    values={heatmapData}
                    classForValue={(value) => {
                      if (!value || value.level === 0) {
                        return 'color-empty';
                      }
                      return `color-scale-${value.level}`;
                    }}
                    tooltipDataAttrs={(value) => {
                      if (!value || !value.date) {
                        return { 'data-tooltip-id': 'heatmap-tooltip', 'data-tooltip-content': 'Chưa có dữ liệu' };
                      }
                      // Format Tooltip hiển thị
                      return {
                        'data-tooltip-id': 'heatmap-tooltip',
                        'data-tooltip-content': `Ngày ${value.date}: Ngồi ${value.minutes} phút`,
                      };
                    }}
                />
                <ReactTooltip id="heatmap-tooltip" />
              </div>

              {/* Chú thích màu sắc */}
              <div className="heatmap-legend">
                <span>Ít</span>
                <div className="legend-box color-empty"></div>
                <div className="legend-box color-scale-1"></div>
                <div className="legend-box color-scale-2"></div>
                <div className="legend-box color-scale-3"></div>
                <div className="legend-box color-scale-4"></div>
                <span>Nhiều</span>
              </div>
            </div>
        )}
      </div>
  );
};



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
//       // Ngăn Chrome gửi tín hiệu khởi động lại mạch
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

export default Dashboard;
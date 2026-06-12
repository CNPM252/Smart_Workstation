import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Line } from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { useOutletContext } from 'react-router-dom'; // 🚀 IMPORT ĐỂ LẤY DATA POMODORO TỪ LAYOUT
import {
  Clock, UserCheck, Ruler, Leaf, BarChart3, CalendarDays,
  Timer, Play, Pause, SkipForward
} from 'lucide-react';
import 'react-calendar-heatmap/dist/styles.css';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user, isGuest } = useAuth();

  // 🚀 LẤY TOÀN BỘ STATE POMODORO ĐANG CHẠY NGẦM Ở MAINLAYOUT XUỐNG ĐÂY
  const {
    pomoMode, setPomoMode,
    isWorkSession, setIsWorkSession,
    timeLeft, setTimeLeft,
    isRunning, setIsRunning,
    isManualPause, setIsManualPause
  } = useOutletContext();

  const [kpiData, setKpiData] = useState({ sittingHours: 0, posturePercent: 0, averageDistance: 0, sleepHours: 0 });
  const [heatmapData, setHeatmapData] = useState([]);
  const [message, setMessage] = useState('');
  const [chartView, setChartView] = useState('week');
  const [chartData, setChartData] = useState([]);

  const currentUserId = isGuest ? sessionStorage.getItem('guestId') : (user?.id || user?.userId || user?.uuid || user?.username || (typeof user === 'string' ? user : ''));
  const currentYear = new Date().getFullYear();
  const startDate = new Date(`${currentYear}-01-01`);
  const endDate = new Date(`${currentYear}-12-31`);

  useEffect(() => {
    const fetchChartData = async () => {
      if (!currentUserId) return;
      try {
        const endpoint = chartView === 'week' ? '/api/dashboard/weekly-chart' : '/api/dashboard/monthly-chart';
        const res = await axiosClient.get(endpoint, { params: { userId: currentUserId } });
        setChartData(res.data);
      } catch (error) { console.error("Lỗi lấy dữ liệu biểu đồ:", error); }
    };
    fetchChartData();
  }, [chartView, currentUserId]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUserId) return;
      try {
        const todayRes = await axiosClient.get('/api/dashboard/today', { params: { userId: currentUserId } });
        if (todayRes.data.message) setMessage(todayRes.data.message);
        else if (todayRes.data) {
          setKpiData({
            sittingHours: todayRes.data.sittingHours || 0, posturePercent: todayRes.data.posturePercent || 0,
            averageDistance: todayRes.data.averageDistance || 0, sleepHours: todayRes.data.sleepHours || 0
          });
          setMessage('');
        }
        if (!isGuest) {
          const heatmapRes = await axiosClient.get('/api/dashboard/heatmap', { params: { userId: currentUserId, year: currentYear } });
          if (heatmapRes.data) setHeatmapData(heatmapRes.data);
        }
      } catch (error) { console.error("Lỗi khi tải dữ liệu Dashboard:", error); }
    };
    fetchDashboardData();
  }, [currentUserId, isGuest, currentYear]);


  // CÁC HÀM ĐIỀU KHIỂN BẰNG TAY (MANUAL CONTROL)
  const handleSkip = () => {
    setIsWorkSession(!isWorkSession);
    setIsRunning(true);
    setIsManualPause(false); // Xóa cờ thủ công khi qua phiên mới
  };

  const togglePomo = () => {
    if (isRunning) {
      setIsRunning(false);
      setIsManualPause(true);
    } else {
      setIsRunning(true);
      setIsManualPause(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const totalTime = isWorkSession ? (pomoMode === '25-5' ? 25 * 60 : 50 * 60) : (pomoMode === '25-5' ? 5 * 60 : 10 * 60);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / totalTime) * circumference;

  return (
      <div className="dashboard-container">
        {message && (
            <div style={{ padding: '15px', backgroundColor: '#e7f1ff', color: '#004792', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }}>
              {message}
            </div>
        )}

        {/* HÀNG 1: KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3"><Clock size={20} className="text-blue-500" /><span className="leading-none mt-[2px]">Đã ngồi hôm nay</span></div>
            <div className="text-3xl font-bold text-blue-600 leading-none">{kpiData.sittingHours} giờ</div>
          </div>
          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3"><UserCheck size={20} className="text-emerald-500" /><span className="leading-none mt-[2px]">Tỷ lệ tư thế chuẩn</span></div>
            <div className="text-3xl font-bold text-emerald-600 leading-none">{kpiData.posturePercent}%</div>
          </div>
          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3"><Ruler size={20} className="text-purple-500" /><span className="leading-none mt-[2px]">Khoảng cách thường giữ</span></div>
            <div className="text-3xl font-bold text-purple-600 leading-none">{kpiData.averageDistance} cm</div>
          </div>
          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3"><Leaf size={20} className="text-orange-500" /><span className="leading-none mt-[2px]">Tài nguyên tiết kiệm</span></div>
            <div className="text-3xl font-bold text-orange-600 leading-none">{kpiData.sleepHours} giờ</div>
          </div>
        </div>

        {/* HÀNG 2: CHIA ĐÔI CHART VÀ POMODORO */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          <div className="card border p-6 rounded-lg shadow-sm bg-white lg:w-[65%] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><BarChart3 size={22} className="text-blue-600" />Thống kê thời gian ngồi</h3>
              <select className="border border-gray-300 rounded-md p-2 outline-none focus:border-blue-500 font-medium text-gray-700" value={chartView} onChange={(e) => setChartView(e.target.value)}>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
              </select>
            </div>
            <div className="flex-1" style={{ minHeight: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12, fontWeight: 500 }} dy={10} interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />
                  <RechartsTooltip formatter={(value) => [`${value} giờ`, 'Thời gian ngồi']} labelStyle={{ fontWeight: 'bold', color: '#374151' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#3b82f6' }} activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} animationDuration={1500} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card border p-6 rounded-lg shadow-sm bg-white lg:w-[35%] flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Timer size={22} className="text-orange-500" />Smart Pomodoro</h3>
              <div className="flex items-center bg-gray-100 rounded-full p-1">
                <button onClick={() => setPomoMode('25-5')} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${pomoMode === '25-5' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>25/5</button>
                <button onClick={() => setPomoMode('50-10')} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${pomoMode === '50-10' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>50/10</button>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative my-4">
              <svg width="160" height="160" className="transform -rotate-90">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="6" />
                <circle cx="80" cy="80" r={radius} fill="none" stroke={isWorkSession ? "#3b82f6" : "#10b981"} strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-linear" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-extrabold text-gray-800 tracking-tight font-mono">{formatTime(timeLeft)}</span>
                <span className={`text-xs font-bold mt-1 uppercase tracking-widest ${isWorkSession ? 'text-blue-500' : 'text-emerald-500'}`}>{isWorkSession ? 'Focus' : 'Break'}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-2">
              <button onClick={togglePomo} className={`w-12 h-12 flex items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105 active:scale-95 ${isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-800 hover:bg-gray-900'}`}>
                {isRunning ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-1" />}
              </button>
              <button onClick={handleSkip} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" title="Bỏ qua / Đổi phiên"><SkipForward size={18} /></button>
            </div>
            <div className="text-center mt-6 text-[11px] text-gray-400 font-medium">Tự động đồng bộ với cảm biến (Tolerance: 30s)</div>
          </div>
        </div>

        {/* HÀNG 3: HEATMAP */}
        {!isGuest && (
            <div className="heatmap-card mt-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><CalendarDays size={22} className="text-emerald-600" />Mức độ chăm chỉ trong năm {currentYear}</h3>
              <div className="heatmap-wrapper">
                <CalendarHeatmap startDate={startDate} endDate={endDate} values={heatmapData} classForValue={(value) => (!value || value.level === 0) ? 'color-empty' : `color-scale-${value.level}`} />
              </div>
            </div>
        )}
      </div>
  );
};

export default Dashboard;
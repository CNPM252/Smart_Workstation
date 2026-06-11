import React, { useEffect, useState, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Line } from 'recharts';
import CalendarHeatmap from 'react-calendar-heatmap';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { Clock, UserCheck, Ruler, Leaf, BarChart3, CalendarDays } from 'lucide-react'; // 🚀 IMPORT LUCIDE ICONS
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

  const [chartView, setChartView] = useState('week');
  const [chartData, setChartData] = useState([]);

  const currentUserId = isGuest
      ? sessionStorage.getItem('guestId')
      : (user?.id || user?.userId || user?.uuid || user?.username || (typeof user === 'string' ? user : ''));

  const currentYear = new Date().getFullYear();
  const startDate = new Date(`${currentYear}-01-01`);
  const endDate = new Date(`${currentYear}-12-31`);

  useEffect(() => {
    const fetchChartData = async () => {
      if (!currentUserId) return;

      try {
        const endpoint = chartView === 'week' ? '/api/dashboard/weekly-chart' : '/api/dashboard/monthly-chart';
        const res = await axiosClient.get(endpoint, {
          params: { userId: currentUserId }
        });
        setChartData(res.data);
      } catch (error) {
        console.error("Lỗi lấy dữ liệu biểu đồ:", error);
      }
    };

    fetchChartData();
  }, [chartView, currentUserId]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUserId) return;

      try {
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

        if (!isGuest) {
          const heatmapRes = await axiosClient.get('/api/dashboard/heatmap', {
            params: { userId: currentUserId, year: currentYear }
          });
          if (heatmapRes.data) {
            setHeatmapData(heatmapRes.data);
          }
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

        {/* 🚀 Hàng 1: Các chỉ số KPI (Đã căn giữa tuyệt đối) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3">
              <Clock size={20} className="text-blue-500" />
              <span className="leading-none mt-[2px]">Đã ngồi hôm nay</span>
            </div>
            <div className="text-3xl font-bold text-blue-600 leading-none">{kpiData.sittingHours} giờ</div>
          </div>

          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3">
              <UserCheck size={20} className="text-emerald-500" />
              <span className="leading-none mt-[2px]">Tỷ lệ tư thế chuẩn</span>
            </div>
            <div className="text-3xl font-bold text-emerald-600 leading-none">{kpiData.posturePercent}%</div>
          </div>

          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3">
              <Ruler size={20} className="text-purple-500" />
              <span className="leading-none mt-[2px]">Khoảng cách thường giữ</span>
            </div>
            <div className="text-3xl font-bold text-purple-600 leading-none">{kpiData.averageDistance} cm</div>
          </div>

          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[140px]">
            <div className="flex items-center justify-center gap-2 text-gray-500 font-medium mb-3">
              <Leaf size={20} className="text-orange-500" />
              <span className="leading-none mt-[2px]">Tài nguyên tiết kiệm</span>
            </div>
            <div className="text-3xl font-bold text-orange-600 leading-none">{kpiData.sleepHours} giờ</div>
          </div>
        </div>

        {/* 🚀 Hàng 2: Biểu đồ (Đã bổ sung Icon tiêu đề) */}
        <div className="card border p-6 rounded-lg shadow-sm bg-white mt-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <BarChart3 size={22} className="text-blue-600" />
              Thống kê thời gian ngồi
            </h3>

            <select
                className="border border-gray-300 rounded-md p-2 outline-none focus:border-blue-500 font-medium text-gray-700"
                value={chartView}
                onChange={(e) => setChartView(e.target.value)}
            >
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />

                <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#888', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                    interval={0}
                    tickFormatter={(value, index) => {
                      if (chartView === 'month') {
                        if (index === 0) return 'Tuần 1';
                        if (index === 7) return 'Tuần 2';
                        if (index === 14) return 'Tuần 3';
                        if (index === 21) return 'Tuần 4';
                        if (index === 28) return 'Tuần 5';
                        return '';
                      }
                      return value;
                    }}
                />

                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} />

                <RechartsTooltip
                    formatter={(value) => [`${value} giờ`, 'Thời gian ngồi']}
                    labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />

                <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#3b82f6' }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🚀 Hàng 3: Heatmap GitHub Contributions (Đã bổ sung Icon tiêu đề) */}
        {!isGuest && (
            <div className="heatmap-card mt-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                <CalendarDays size={22} className="text-emerald-600" />
                Mức độ chăm chỉ trong năm {currentYear}
              </h3>
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
                      return {
                        'data-tooltip-id': 'heatmap-tooltip',
                        'data-tooltip-content': `Ngày ${value.date}: Ngồi ${value.minutes} phút`,
                      };
                    }}
                />
                <ReactTooltip id="heatmap-tooltip" />
              </div>

              <div className="heatmap-legend mt-4 flex items-center gap-2 text-sm text-gray-600">
                <span>Ít</span>
                <div className="legend-box color-empty w-4 h-4 rounded-sm bg-gray-100"></div>
                <div className="legend-box color-scale-1 w-4 h-4 rounded-sm bg-emerald-200"></div>
                <div className="legend-box color-scale-2 w-4 h-4 rounded-sm bg-emerald-400"></div>
                <div className="legend-box color-scale-3 w-4 h-4 rounded-sm bg-emerald-600"></div>
                <div className="legend-box color-scale-4 w-4 h-4 rounded-sm bg-emerald-800"></div>
                <span>Nhiều</span>
              </div>
            </div>
        )}
      </div>
  );
};

export default Dashboard;
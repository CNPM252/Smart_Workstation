import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { Target, Save, Activity, Settings2, Unplug, CheckCircle2, XCircle } from 'lucide-react';
// Import CSS nếu sếp vẫn xài file cũ, hoặc bỏ đi nếu đã full Tailwind
// import '../styles/Settings.css';

const Settings = () => {
  const { user, isGuest } = useAuth();
  const { isConnected, sensorData } = useDevice(); // Không cần connectDevice ở đây nữa

  const [config, setConfig] = useState({
    distanceThresholdMin: 40,
    distanceThresholdMax: 70,
    autoDimEnabled: false,
    manualLightLevel: 50,
    autoSleepEnabled: true,
    sleepTimeoutMins: 3
  });

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibStep, setCalibStep] = useState(0);
  const [tempMin, setTempMin] = useState(0);
  const [tempMax, setTempMax] = useState(0);

  const currentUserId = isGuest
      ? sessionStorage.getItem('guestId')
      : (user?.id || user?.userId || user?.uuid || user?.username || (typeof user === 'string' ? user : ''));

  useEffect(() => {
    const fetchConfig = async () => {
      if (!currentUserId) return;
      try {
        const res = await axiosClient.get(`/api/workstations/${currentUserId}/config`);
        if (res.data) {
          setConfig(prev => ({
            ...prev,
            distanceThresholdMin: res.data.distanceThresholdMin ?? 40,
            distanceThresholdMax: res.data.distanceThresholdMax ?? 70,
            autoDimEnabled: res.data.autoDimEnabled ?? false,
            manualLightLevel: res.data.manualLightLevel ?? 50,
            autoSleepEnabled: res.data.autoSleepEnabled ?? true,
            sleepTimeoutMins: res.data.sleepTimeoutMins ?? 3
          }));
        }
      } catch (error) {
        console.error("Lỗi khi tải cấu hình từ server:", error);
      }
    };
    fetchConfig();
  }, [currentUserId, user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig({
      ...config,
      [name]: type === 'checkbox' ? checked : Number(value)
    });
  };

  const validateConfig = (cfg) => {
    if (cfg.distanceThresholdMin < 20) return "Khoảng cách Min không được nhỏ hơn 20 cm!";
    if (cfg.distanceThresholdMax > 200) return "Khoảng cách Max không được vượt quá 200 cm!";
    if (cfg.distanceThresholdMin >= cfg.distanceThresholdMax) return "Khoảng cách Min phải nhỏ hơn Max!";
    if (cfg.autoSleepEnabled && (cfg.sleepTimeoutMins < 1 || cfg.sleepTimeoutMins > 60)) {
      return "Thời gian chờ Sleep chỉ được phép cài đặt từ 1 đến 60 phút!";
    }
    return null;
  };

  const saveConfigToBackend = async (configToSave) => {
    if (!currentUserId) return false;
    const errorMsg = validateConfig(configToSave);
    if (errorMsg) {
      alert("Lỗi cài đặt: " + errorMsg);
      return false;
    }
    try {
      await axiosClient.put(`/api/workstations/${currentUserId}/config`, configToSave);
      alert("Đã lưu cấu hình thành công!");
      return true;
    } catch (error) {
      alert("Có lỗi xảy ra khi lưu!");
      return false;
    }
  };

  const handleSave = async () => {
    await saveConfigToBackend(config);
  };

  // --- LOGIC CÂN CHỈNH ---
  const startCalibration = () => {
    if (!isConnected) {
      alert("Bạn cần kết nối thiết bị trước khi cân chỉnh!");
      return;
    }
    setIsCalibrating(true);
    setCalibStep(1);
  };

  const recordMin = () => { setTempMin(sensorData.distance); setCalibStep(2); };
  const recordMax = () => { setTempMax(sensorData.distance); setCalibStep(3); };
  const applyCalibration = async () => {
    const finalMin = Math.min(tempMin, tempMax);
    const finalMax = Math.max(tempMin, tempMax);
    const updatedConfig = { ...config, distanceThresholdMin: finalMin, distanceThresholdMax: finalMax };
    const isSuccess = await saveConfigToBackend(updatedConfig);
    if (isSuccess) {
      setConfig(updatedConfig);
      setIsCalibrating(false);
      setCalibStep(0);
    }
  };

  return (
      <div className="min-h-screen bg-gray-50 p-8 flex justify-center">
        <div className="bg-white w-full max-w-3xl rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col items-center relative">

          {/* NÚT CÂN CHỈNH TÁCH BIỆT TRÊN CÙNG */}
          <button
              onClick={startCalibration}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold transition-all shadow-sm mb-8"
          >
            <Target size={20} />
            Cân chỉnh số đo thiết bị
          </button>

          <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
            <Settings2 size={24} className="text-blue-600" />
            Cấu hình hệ thống
          </h2>

          {/* KHU VỰC CÂN CHỈNH */}
          {isCalibrating && (
              <div className="w-full bg-emerald-50 border border-emerald-200 p-6 rounded-lg mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-emerald-800 font-semibold flex items-center gap-2">
                    <Target size={18} /> Trợ lý Cân chỉnh Tư thế
                  </h3>
                  <button onClick={() => setIsCalibrating(false)} className="text-red-500 hover:text-red-700">
                    <XCircle size={20} />
                  </button>
                </div>

                {calibStep === 1 && (
                    <div className="flex flex-col items-center text-center">
                      <p className="text-emerald-700 mb-4"><strong>Bước 1:</strong> Ngồi thẳng lưng ở tư thế làm việc chuẩn (gần nhất) và bấm Ghi nhận.</p>
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-bold text-emerald-600">{sensorData.distance} cm</span>
                        <button onClick={recordMin} className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition">Ghi nhận Min</button>
                      </div>
                    </div>
                )}
                {calibStep === 2 && (
                    <div className="flex flex-col items-center text-center">
                      <p className="text-emerald-700 mb-4"><strong>Bước 2:</strong> Ngả lưng ra sau ở tư thế thư giãn (xa nhất) và bấm Ghi nhận.</p>
                      <div className="flex items-center gap-4">
                        <span className="text-3xl font-bold text-emerald-600">{sensorData.distance} cm</span>
                        <button onClick={recordMax} className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition">Ghi nhận Max</button>
                      </div>
                    </div>
                )}
                {calibStep === 3 && (
                    <div className="flex flex-col items-center text-center">
                      <p className="text-emerald-700 mb-4"><strong>Hoàn tất!</strong> Dải khoảng cách an toàn của bạn là:</p>
                      <div className="flex items-center gap-4">
                        <span className="text-xl font-bold text-emerald-600">{Math.min(tempMin, tempMax)} cm ➔ {Math.max(tempMin, tempMax)} cm</span>
                        <button onClick={applyCalibration} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md font-bold hover:bg-emerald-700 transition">
                          <Save size={18} /> Áp dụng
                        </button>
                      </div>
                    </div>
                )}
              </div>
          )}

          {/* KHU VỰC CÀI ĐẶT CĂN GIỮA */}
          <div className="w-full max-w-lg flex flex-col items-center gap-6">
            <div className="flex gap-4 w-full">
              <div className="flex-1 flex flex-col items-center">
                <label className="text-sm text-gray-600 mb-2 font-medium">Khoảng cách gần nhất (cm)</label>
                <input
                    type="number" name="distanceThresholdMin"
                    value={config.distanceThresholdMin} onChange={handleChange}
                    className="w-full text-center px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex-1 flex flex-col items-center">
                <label className="text-sm text-gray-600 mb-2 font-medium">Khoảng cách xa nhất (cm)</label>
                <input
                    type="number" name="distanceThresholdMax"
                    value={config.distanceThresholdMax} onChange={handleChange}
                    className="w-full text-center px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="w-full border-t border-gray-100 my-2"></div>

            <div className="w-full flex items-center justify-start gap-3 px-4">
              <input
                  type="checkbox" id="autoDimEnabled" name="autoDimEnabled"
                  checked={config.autoDimEnabled} onChange={handleChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="autoDimEnabled" className="text-gray-700 font-medium cursor-pointer">Auto-dim (Tự động điều chỉnh độ sáng)</label>
            </div>

            {!config.autoDimEnabled && (
                <div className="w-full px-4 flex flex-col items-center bg-gray-50 p-4 rounded-lg">
                  <div className="w-full flex justify-between mb-2">
                    <span className="text-gray-600">Độ sáng thủ công:</span>
                    <span className="font-bold text-blue-600">{config.manualLightLevel}%</span>
                  </div>
                  <input
                      type="range" name="manualLightLevel" min="0" max="100"
                      value={config.manualLightLevel} onChange={handleChange}
                      className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
            )}

            <div className="w-full border-t border-gray-100 my-2"></div>

            <div className="w-full flex items-center justify-start gap-3 px-4">
              <input
                  type="checkbox" id="autoSleepEnabled" name="autoSleepEnabled"
                  checked={config.autoSleepEnabled} onChange={handleChange}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="autoSleepEnabled" className="text-gray-700 font-medium cursor-pointer">Auto-sleep (Tự động tắt khi vắng mặt)</label>
            </div>

            {config.autoSleepEnabled && (
                <div className="w-full px-4 flex flex-col items-center bg-gray-50 p-4 rounded-lg">
                  <label className="text-gray-600 mb-2">Thời gian chờ trước khi Sleep (phút)</label>
                  <input
                      type="number" name="sleepTimeoutMins"
                      value={config.sleepTimeoutMins} onChange={handleChange}
                      className="w-32 text-center px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
            )}

            <button
                onClick={handleSave}
                className="mt-6 w-full max-w-xs flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition-colors shadow-md"
            >
              <Save size={20} />
              Lưu Cài Đặt
            </button>
          </div>

          {/* KHU VỰC HIỂN THỊ REAL-TIME THỤ ĐỘNG DƯỚI CÙNG */}
          <div className="w-full mt-12 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center justify-center gap-2">
              <Activity size={20} className="text-blue-500" />
              Trạng thái thiết bị Real-time
            </h3>

            {!isConnected ? (
                <div className="flex flex-col items-center text-gray-400">
                  <Unplug size={48} className="mb-2 opacity-50" />
                  <p>Không có thiết bị được kết nối</p>
                  <p className="text-sm mt-1">Vui lòng kết nối qua Sidebar để xem số đo.</p>
                </div>
            ) : (
                <div className="flex justify-center gap-8 text-center bg-blue-50 p-6 rounded-xl border border-blue-100">
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-blue-600 font-medium mb-1">Khoảng cách</span>
                    <span className="text-3xl font-black text-blue-800">{sensorData.distance} cm</span>
                  </div>
                  <div className="w-px bg-blue-200"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-blue-600 font-medium mb-1">Ánh sáng</span>
                    <span className="text-3xl font-black text-blue-800">{sensorData.light}%</span>
                  </div>
                  <div className="w-px bg-blue-200"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-blue-600 font-medium mb-1">Chuyển động</span>
                    {sensorData.motion ? (
                        <span className="flex items-center gap-1 text-xl font-bold text-emerald-600 mt-1"><CheckCircle2 size={24}/> Có</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xl font-bold text-red-500 mt-1"><XCircle size={24}/> Không</span>
                    )}
                  </div>
                </div>
            )}
          </div>

        </div>
      </div>
  );
};

export default Settings;
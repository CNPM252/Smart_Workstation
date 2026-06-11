import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import '../styles/Settings.css';

const Settings = () => {
  const { user, isGuest } = useAuth();

  // Lấy trạng thái và data real-time từ cổng COM
  const { isConnected, sensorData, connectDevice, portRef } = useDevice();

  const [config, setConfig] = useState({
    distanceThresholdMin: 40,
    distanceThresholdMax: 70,
    autoDimEnabled: false,
    manualLightLevel: 50,
    autoSleepEnabled: true,
    sleepTimeoutMins: 3
  });

  // ==========================================
  // STATE CHO TÍNH NĂNG CÂN CHỈNH (CALIBRATION)
  // ==========================================
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibStep, setCalibStep] = useState(0); // 0: Tắt, 1: Đo Min, 2: Đo Max, 3: Xong
  const [tempMin, setTempMin] = useState(0);
  const [tempMax, setTempMax] = useState(0);

  // STATE CHO KHUNG XEM REAL-TIME
  const [showRealTime, setShowRealTime] = useState(false);

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


  const previewLightLevel = async (brightnessVal) => {
    if (portRef && portRef.current && portRef.current.writable) {
      try {
        const writer = portRef.current.writable.getWriter();
        const serialPacket = JSON.stringify({
          cmd: "AWAKE",
          auto: false,
          val: Number(brightnessVal)
        });
        await writer.write(new TextEncoder().encode(serialPacket + '\n'));
        writer.releaseLock();
      } catch (err) {

      }
    }
  };

  // ==========================================
  // HÀM KIỂM TRA GIỚI HẠN (VALIDATION)
  // ==========================================
  const validateConfig = (cfg) => {
    if (cfg.distanceThresholdMin < 20) return "Khoảng cách Min không được nhỏ hơn 20 cm!";
    if (cfg.distanceThresholdMax > 200) return "Khoảng cách Max không được vượt quá 200 cm!";
    if (cfg.distanceThresholdMin >= cfg.distanceThresholdMax) return "Khoảng cách Min phải nhỏ hơn Max!";
    if (cfg.autoSleepEnabled && (cfg.sleepTimeoutMins < 1 || cfg.sleepTimeoutMins > 60)) {
      return "Thời gian chờ Sleep chỉ được phép cài đặt từ 1 đến 60 phút!";
    }
    return null; // Hợp lệ
  };

  // ==========================================
  // LƯU CẤU HÌNH (TỪ FORM VÀ TỪ CÂN CHỈNH)
  // ==========================================
  const saveConfigToBackend = async (configToSave) => {
    if (!currentUserId) {
      alert("Không tìm thấy ID người dùng!");
      return false;
    }

    const errorMsg = validateConfig(configToSave);
    if (errorMsg) {
      alert("⚠️ Lỗi cài đặt: " + errorMsg);
      return false;
    }

    try {
      await axiosClient.put(`/api/workstations/${currentUserId}/config`, configToSave);
      alert("✅ Đã lưu cấu hình thành công!");
      return true;
    } catch (error) {
      console.error("Lỗi khi lưu cấu hình:", error);
      alert("Có lỗi xảy ra khi lưu! Vui lòng kiểm tra lại kết nối.");
      return false;
    }
  };

  const handleSave = async () => {
    await saveConfigToBackend(config);
  };

  // ==========================================
  // LOGIC XỬ LÝ CÂN CHỈNH
  // ==========================================
  const startCalibration = () => {
    if (!isConnected) {
      alert("⚠️ Bạn cần kết nối thiết bị Yolo:Bit trước khi cân chỉnh!");
      return;
    }
    setIsCalibrating(true);
    setCalibStep(1); // Bắt đầu bước 1: Đo Min
  };

  const recordMin = () => {
    setTempMin(sensorData.distance);
    setCalibStep(2); // Chuyển sang bước 2: Đo Max
  };

  const recordMax = () => {
    setTempMax(sensorData.distance);
    setCalibStep(3); // Hoàn tất đo
  };

  const applyCalibration = async () => {
    const finalMin = Math.min(tempMin, tempMax);
    const finalMax = Math.max(tempMin, tempMax);

    const updatedConfig = {
      ...config,
      distanceThresholdMin: finalMin,
      distanceThresholdMax: finalMax
    };

    // Gọi API lưu ngay lập tức
    const isSuccess = await saveConfigToBackend(updatedConfig);

    if (isSuccess) {
      setConfig(updatedConfig);
      setIsCalibrating(false);
      setCalibStep(0);
    }
  };

  return (
      <div className="settings-container">
        <div className="settings-card">

          {/* HEADER CHỨA NÚT CÂN CHỈNH */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 className="settings-title" style={{ margin: 0 }}>Cấu hình hệ thống</h2>
            <button
                onClick={startCalibration}
                style={{ backgroundColor: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              🎯 Cân chỉnh số đo
            </button>
          </div>

          {/* KHU VỰC UI CÂN CHỈNH (Hiển thị khi bấm nút) */}
          {isCalibrating && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ color: '#166534', margin: 0, fontSize: '16px' }}>Trợ lý Cân chỉnh Tư thế</h3>
                  <button onClick={() => setIsCalibrating(false)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕ Hủy</button>
                </div>

                {/* Vòng lặp hiển thị theo Step */}
                {calibStep === 1 && (
                    <div>
                      <p style={{ fontSize: '14px', color: '#15803d', marginBottom: '10px' }}><strong>Bước 1:</strong> Hãy ngồi thẳng lưng ở tư thế làm việc chuẩn (gần màn hình nhất) và bấm Ghi nhận.</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#047857' }}>{sensorData.distance} cm</span>
                        <button onClick={recordMin} style={{ backgroundColor: '#059669', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Ghi nhận Min</button>
                      </div>
                    </div>
                )}

                {calibStep === 2 && (
                    <div>
                      <p style={{ fontSize: '14px', color: '#15803d', marginBottom: '10px' }}><strong>Bước 2:</strong> Hãy ngả lưng ra sau ở tư thế thư giãn (xa màn hình nhất) và bấm Ghi nhận.</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#047857' }}>{sensorData.distance} cm</span>
                        <button onClick={recordMax} style={{ backgroundColor: '#059669', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>Ghi nhận Max</button>
                      </div>
                    </div>
                )}

                {calibStep === 3 && (
                    <div>
                      <p style={{ fontSize: '14px', color: '#15803d', marginBottom: '10px' }}><strong>Hoàn tất!</strong> Dải khoảng cách an toàn của bạn là:</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857' }}>Min: {Math.min(tempMin, tempMax)} cm ➔ Max: {Math.max(tempMin, tempMax)} cm</span>
                        <button onClick={applyCalibration} style={{ backgroundColor: '#059669', color: 'white', padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✨ Áp dụng</button>
                      </div>
                    </div>
                )}
              </div>
          )}

          <div className="input-row">
            <div className="input-group">
              <label>Khoảng cách gần nhất (cm)</label>
              <input
                  type="number"
                  name="distanceThresholdMin"
                  value={config.distanceThresholdMin}
                  onChange={handleChange}
              />
            </div>
            <div className="input-group">
              <label>Khoảng cách xa nhất (cm)</label>
              <input
                  type="number"
                  name="distanceThresholdMax"
                  value={config.distanceThresholdMax}
                  onChange={handleChange}
              />
            </div>
          </div>

          <div className="divider"></div>

          <div className="checkbox-group">
            <input
                type="checkbox"
                id="autoDimEnabled"
                name="autoDimEnabled"
                checked={config.autoDimEnabled}
                onChange={handleChange}
            />
            <label htmlFor="autoDimEnabled">Auto-dim (Tự động điều chỉnh độ sáng)</label>
          </div>

          {!config.autoDimEnabled && (
              <div className="sub-setting">
                <div className="sub-setting-header">
                  Độ sáng thủ công: <span>{config.manualLightLevel}%</span>
                </div>
                <input
                    type="range"
                    name="manualLightLevel"
                    min="0" max="100"
                    value={config.manualLightLevel}
                    onChange={(e) => {
                      handleChange(e); // lưu state
                      previewLightLevel(e.target.value); // Bắn lệnh Real-time
                    }}
                />
              </div>
          )}

          <div className="divider"></div>

          <div className="checkbox-group">
            <input
                type="checkbox"
                id="autoSleepEnabled"
                name="autoSleepEnabled"
                checked={config.autoSleepEnabled}
                onChange={handleChange}
            />
            <label htmlFor="autoSleepEnabled">Auto-sleep (Tự động tắt khi vắng mặt)</label>
          </div>

          {config.autoSleepEnabled && (
              <div className="sub-setting" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div className="sub-setting-header" style={{ marginBottom: '8px' }}>
                  Thời gian chờ trước khi Sleep (phút)
                </div>
                <input
                    type="number"
                    name="sleepTimeoutMins"
                    value={config.sleepTimeoutMins}
                    onChange={handleChange}
                    style={{ width: '120px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', textAlign: 'center' }}
                />
              </div>
          )}

          <button className="btn-save" onClick={handleSave} style={{ marginTop: '20px' }}>
            Lưu Cài Đặt
          </button>

          {/* ========================================== */}
          {/* NÚT TOGGLE HIỂN THỊ REAL-TIME              */}
          {/* ========================================== */}
          <div className="divider" style={{ marginTop: '30px', marginBottom: '20px' }}></div>
          <button
              onClick={() => setShowRealTime(!showRealTime)}
              style={{ width: '100%', padding: '12px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontWeight: 'bold', color: '#4b5563', cursor: 'pointer', marginBottom: '15px', transition: 'all 0.2s' }}
          >
            {showRealTime ? "Đóng hộp thoại Real-time" : "📊 Đọc số đo Real-time từ thiết bị"}
          </button>

          {/* KHUNG HIỂN THỊ REAL-TIME */}
          {showRealTime && (
              <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', padding: '20px', borderRadius: '8px' }}>
                {!isConnected ? (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: '#0369a1', marginBottom: '15px', fontSize: '15px' }}>Thiết bị chưa được kết nối.</p>
                      <button
                          onClick={connectDevice}
                          style={{ backgroundColor: '#0284c7', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                         Kết nối Yolo:Bit
                      </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      <div>
                        <span style={{ fontSize: '13px', color: '#0369a1', display: 'block', marginBottom: '5px' }}>Khoảng cách</span>
                        <strong style={{ fontSize: '24px', color: '#0284c7' }}>{sensorData.distance} cm</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '13px', color: '#0369a1', display: 'block', marginBottom: '5px' }}>Ánh sáng phòng</span>
                        <strong style={{ fontSize: '24px', color: '#0284c7' }}>{sensorData.light}%</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '13px', color: '#0369a1', display: 'block', marginBottom: '5px' }}>Trạng thái</span>
                        <strong style={{ fontSize: '18px', color: sensorData.motion ? '#16a34a' : '#dc2626' }}>
                          {sensorData.motion ? "Có người" : "Vắng mặt"}
                        </strong>
                      </div>
                    </div>
                )}
              </div>
          )}

        </div>
      </div>
  );
};

export default Settings;
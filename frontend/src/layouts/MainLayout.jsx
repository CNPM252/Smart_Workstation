import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import axiosClient from '../api/axiosClient'; // 🚀 IMPORT THÊM ĐỂ FETCH CONFIG
import {
    LayoutDashboard, Settings as SettingsIcon, LogOut,
    User, Map, Users, Usb, CheckCircle2, X, Bell, Activity
} from 'lucide-react';
import '../styles/MainLayout.css';
import logo from '../assets/smartWorkstation.svg';

const MainLayout = () => {
    const { user, isGuest, logout } = useAuth();
    const { isConnected, connectDevice, sensorData } = useDevice();
    const navigate = useNavigate();

    // Xác định ID người dùng để Fetch Config
    const currentUserId = isGuest
        ? sessionStorage.getItem('guestId')
        : (user?.id || user?.userId || user?.uuid || user?.username || (typeof user === 'string' ? user : ''));

    // =========================================================================
    // STATE GLOBAL CHO SMART POMODORO (Giữ nguyên khi chuyển trang)
    // =========================================================================
    const [pomoMode, setPomoMode] = useState('25-5');
    const [isWorkSession, setIsWorkSession] = useState(true);
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [isManualPause, setIsManualPause] = useState(false); // Lưu vết người dùng tự bấm dừng

    // Effect đếm ngược Pomodoro
    useEffect(() => {
        let interval;
        if (isRunning && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (isRunning && timeLeft === 0) {
            setIsWorkSession(prev => !prev); // Đổi phiên tự động
            setIsManualPause(false);
        }
        return () => clearInterval(interval);
    }, [isRunning, timeLeft]);

    // Đổi lại tổng giờ khi chuyển chế độ/phiên
    useEffect(() => {
        const total = isWorkSession ? (pomoMode === '25-5' ? 25 * 60 : 50 * 60) : (pomoMode === '25-5' ? 5 * 60 : 10 * 60);
        setTimeLeft(total);
    }, [pomoMode, isWorkSession]);

    // Ref lưu tạm state cho Pomodoro để dùng bên trong setInterval Ergonomics
    const pomoStateRef = useRef({ isRunning, isManualPause });
    useEffect(() => {
        pomoStateRef.current = { isRunning, isManualPause };
    }, [isRunning, isManualPause]);


    // =========================================================================
    //  LOGIC CÔNG THÁI HỌC (FETCH CONFIG TỪ BACKEND + AUTO POMODORO)
    // =========================================================================
    const [userConfig, setUserConfig] = useState({ distMin: 40, distMax: 70 });
    const [alert, setAlert] = useState(null);

    const timers = useRef({ badPosture: 0, goodPosture: 0, sitting: 0, away: 0 });

    const POSTURE_LIMIT = 10;  // test 10 giây
    const SITTING_LIMIT = 40;
    const TOLERANCE = 10;

    // Lấy Config Cá Nhân từ Backend
    useEffect(() => {
        if (currentUserId) {
            axiosClient.get(`/api/workstations/${currentUserId}/config`)
                .then(res => {
                    if (res.data) {
                        setUserConfig({
                            distMin: res.data.distanceThresholdMin || 40,
                            distMax: res.data.distanceThresholdMax || 70
                        });
                    }
                })
                .catch(err => console.error("Không lấy được config:", err));
        }
    }, [currentUserId]);

    // Vòng lặp Công thái học
    useEffect(() => {
        if (!isConnected || !sensorData) return;

        const interval = setInterval(() => {
            const { distance, motion } = sensorData;
            const { distMin, distMax } = userConfig;

            // 🚀 LOGIC MỚI: ĐỒNG BỘ TUYỆT ĐỐI VỚI BACKEND
            const lowerBound = distMin * 0.8;
            const upperBound = distMax * 1.2;

            // Có người khi: Cảm biến chuyển động TRUE, HOẶC khoảng cách nằm trong vùng biên độ cho phép
            const isPresent = motion || (distance >= lowerBound && distance <= upperBound && distance !== 0);

            // Tư thế chuẩn khi: Nằm đúng biên độ gốc (Không có 0.8 hay 1.2)
            const isGoodPosture = distance >= distMin && distance <= distMax;

            if (isPresent) {
                timers.current.sitting += 1;
                timers.current.away = 0; // Đang ngồi thì xóa bộ đếm vắng mặt

                // 🚀 TỰ ĐỘNG CHẠY POMODORO
                if (!pomoStateRef.current.isRunning && !pomoStateRef.current.isManualPause) {
                    setIsRunning(true);
                }

                // 🚀 LOGIC TƯ THẾ (Áp dụng Tolerance)
                if (!isGoodPosture && distance !== 0) {
                    timers.current.badPosture += 1;
                    timers.current.goodPosture = 0;
                } else if (isGoodPosture) {
                    timers.current.goodPosture += 1;
                    if (timers.current.goodPosture >= TOLERANCE) {
                        timers.current.badPosture = 0;
                    }
                }

                if (timers.current.badPosture >= POSTURE_LIMIT) {
                    triggerAlert('posture', 'Cảnh báo tư thế!', 'Bạn đã ngồi sai tư thế quá lâu. Thẳng lưng lên sếp ơi!');
                    timers.current.badPosture = 0;
                }

                if (timers.current.sitting >= SITTING_LIMIT) {
                    triggerAlert('stretch', 'Đã đến giờ giải lao!', 'Bạn đã cắm rễ quá lâu rồi. Đứng dậy vươn vai nhé!');
                    timers.current.sitting = 0;
                }

            } else {
                // NẰM NGOÀI KHOẢNG ĐÓ (Vắng mặt / Quá xa)
                timers.current.away += 1;

                // Nếu sự vắng mặt này kéo dài vượt quá TOLERANCE (10s/30s) -> Mới chính thức Reset
                if (timers.current.away >= TOLERANCE) {
                    timers.current.sitting = 0;
                    timers.current.badPosture = 0;
                    timers.current.goodPosture = 0;

                    // 🚀 TỰ ĐỘNG PAUSE POMODORO
                    if (pomoStateRef.current.isRunning) setIsRunning(false);
                    if (pomoStateRef.current.isManualPause) setIsManualPause(false);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isConnected, sensorData, userConfig]);

    const triggerAlert = (type, title, message) => {
        setAlert({ type, title, message });
        try {
            const audioUrl = type === 'posture' ? '/posture-alert.mp3' : '/stretch-alert.mp3';
            const audio = new Audio(audioUrl);
            audio.play().catch(() => {});
        } catch(e) {}
        setTimeout(() => setAlert(null), 8000);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Truyền dữ liệu Pomodoro xuống các route con (Dashboard)
    const outletContextValue = {
        pomoMode, setPomoMode,
        isWorkSession, setIsWorkSession,
        timeLeft, setTimeLeft,
        isRunning, setIsRunning,
        isManualPause, setIsManualPause
    };

    return (
        <div className="layout-container relative">
            {alert && (
                <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-5 duration-500">
                    <div className={`flex items-start gap-4 p-4 rounded-lg shadow-xl border-l-4 w-80 
                        ${alert.type === 'posture' ? 'bg-orange-50 border-orange-500' : 'bg-emerald-50 border-emerald-500'}`}>
                        <div className={`p-2 rounded-full mt-1 
                            ${alert.type === 'posture' ? 'bg-orange-200 text-orange-600' : 'bg-emerald-200 text-emerald-600'}`}>
                            {alert.type === 'posture' ? <Activity size={20} /> : <Bell size={20} />}
                        </div>
                        <div className="flex-1">
                            <h4 className={`font-bold text-sm ${alert.type === 'posture' ? 'text-orange-800' : 'text-emerald-800'}`}>
                                {alert.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                        </div>
                        <button onClick={() => setAlert(null)} className="text-gray-400 hover:text-gray-700 transition">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            <aside className="sidebar">
                <div className="sidebar-header" style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "30px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img src={logo} alt="Page logo" style={{ width: "30px", height: "30px" }} />
                        <h2 style={{ margin: 0, fontWeight: "bold" }}>BKWorkspace</h2>
                    </div>
                    <span className="badge" style={{ alignSelf: "flex-start", marginLeft: "40px" }}>
                        {isGuest ? 'Guest Mode' : 'User Mode'}
                    </span>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <LayoutDashboard size={20} /><span>Tổng quan</span>
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <SettingsIcon size={20} /><span>Cấu hình</span>
                    </NavLink>
                    <NavLink to="/rooms" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Map size={20} /><span>Không gian</span>
                    </NavLink>
                    <NavLink to="/groups" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Users size={20} /><span>Nhóm & Lớp</span>
                    </NavLink>
                </nav>

                <div style={{ padding: '0 20px', marginBottom: '16px', marginTop: 'auto' }}>
                    <button onClick={connectDevice} disabled={isConnected}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px',
                                borderRadius: '8px', fontWeight: '600',
                                border: isConnected ? '1px solid #a7f3d0' : '1px solid #d1d5db',
                                backgroundColor: isConnected ? '#ecfdf5' : '#ffffff',
                                color: isConnected ? '#059669' : '#4b5563',
                                cursor: isConnected ? 'default' : 'pointer',
                                transition: 'all 0.2s', boxShadow: isConnected ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                    >
                        {isConnected ? <><CheckCircle2 size={18} color="#10b981" />Đã kết nối</> : <><Usb size={18} />Kết nối thiết bị</>}
                    </button>
                </div>

                <div className="sidebar-footer">
                    {!isGuest && user && (
                        <div className="user-info">
                            <User size={18} /><span>{user.username || 'Người dùng'}</span>
                        </div>
                    )}
                    <button onClick={handleLogout} className="btn-logout"><LogOut size={18} /><span>Đăng xuất</span></button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet context={outletContextValue} />
            </main>
        </div>
    );
};

export default MainLayout;
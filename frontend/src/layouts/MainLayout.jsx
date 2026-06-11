import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext'; // IMPORT DEVICE CONTEXT
import { LayoutDashboard, Settings as SettingsIcon, LogOut, User, Map, Users, Usb, CheckCircle2 } from 'lucide-react'; // IMPORT THÊM USB VÀ CHECKCIRCLE2
import '../styles/MainLayout.css';
import logo from '../assets/smartWorkstation.svg';

const MainLayout = () => {
    const { user, isGuest, logout } = useAuth();
    const { isConnected, connectDevice } = useDevice();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="layout-container">
            {/* Thanh Sidebar bên trái */}
            <aside className="sidebar">
                <div
                    className="sidebar-header"
                    style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "30px" }}
                >
                    {/* Hàng 1: Logo và Tên ứng dụng */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img
                            src={logo}
                            alt="Page logo"
                            style={{ width: "30px", height: "30px" }}
                        />
                        <h2 style={{ margin: 0, fontWeight: "bold" }}>BKWorkspace</h2>
                    </div>

                    {/* Hàng 2: Badge (Vẫn giữ lề 40px để canh ngay dưới chữ BK) */}
                    <span
                        className="badge"
                        style={{ alignSelf: "flex-start", marginLeft: "40px" }}
                    >
                        {isGuest ? 'Guest Mode' : 'User Mode'}
                    </span>
                </div>


                <nav className="sidebar-nav">
                    <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <LayoutDashboard size={20} />
                        <span>Tổng quan</span>
                    </NavLink>

                    <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <SettingsIcon size={20} />
                        <span>Cấu hình</span>
                    </NavLink>

                    <NavLink to="/rooms" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Map size={20} />
                        <span>Không gian</span>
                    </NavLink>

                    {/* ĐÃ THÊM MENU QUẢN LÝ NHÓM & LỚP */}
                    <NavLink to="/groups" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Users size={20} />
                        <span>Nhóm & Lớp</span>
                    </NavLink>
                </nav>

                {/* 🚀 KHU VỰC NÚT KẾT NỐI THIẾT BỊ NẰM TRÊN USER INFO */}
                <div style={{ padding: '0 20px', marginBottom: '16px', marginTop: 'auto' }}>
                    <button
                        onClick={connectDevice}
                        disabled={isConnected}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px',
                            borderRadius: '8px',
                            fontWeight: '600',
                            border: isConnected ? '1px solid #a7f3d0' : '1px solid #d1d5db',
                            backgroundColor: isConnected ? '#ecfdf5' : '#ffffff',
                            color: isConnected ? '#059669' : '#4b5563',
                            cursor: isConnected ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isConnected ? 'none' : '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        {isConnected ? (
                            <>
                                <CheckCircle2 size={18} color="#10b981" />
                                Đã kết nối
                            </>
                        ) : (
                            <>
                                <Usb size={18} />
                                Kết nối thiết bị
                            </>
                        )}
                    </button>
                </div>

                <div className="sidebar-footer">
                    {!isGuest && user && (
                        <div className="user-info">
                            <User size={18} />
                            <span>{user.username || 'Người dùng'}</span>
                        </div>
                    )}
                    <button onClick={handleLogout} className="btn-logout">
                        <LogOut size={18} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* Nội dung chính thay đổi ở đây */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
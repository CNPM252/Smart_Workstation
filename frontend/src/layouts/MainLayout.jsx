import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Settings as SettingsIcon, LogOut, User, Map, Users } from 'lucide-react'; // ĐÃ THÊM ICON USERS
import '../styles/MainLayout.css';
import logo from '../assets/smartWorkstation.svg';

const MainLayout = () => {
    const { user, isGuest, logout } = useAuth();
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
                    style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                    <img
                        src={logo}
                        alt="Page logo"
                        style={{ width: "30px", height: "30px" }}
                    />
                    <h2 style={{ margin: 0 }}>BKWorkspace</h2>
                    <span className="badge">{isGuest ? 'Guest Mode' : 'Workspace'}</span>
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
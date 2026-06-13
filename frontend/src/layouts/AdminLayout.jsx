import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, ScrollText, LogOut, ShieldCheck } from 'lucide-react';
import '../styles/MainLayout.css';
import logo from '../assets/smartWorkstation.svg';

const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="layout-container">
            {/* Sidebar */}
            <aside className="sidebar border-r-2 border-gray-800 bg-gray-50">
                <div className="sidebar-header" style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "30px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img src={logo} alt="Page logo" style={{ width: "30px", height: "30px" }} />
                        <h2 style={{ margin: 0, fontWeight: "bold", color: "#1e293b" }}>BKWorkspace</h2>
                    </div>
                    <span className="badge" style={{ alignSelf: "flex-start", marginLeft: "40px", backgroundColor: "#ef4444", color: "white" }}>
                        ADMIN PORTAL
                    </span>
                </div>

                <nav className="sidebar-nav mt-4">
                    <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <LayoutDashboard size={20} /><span>Tổng quan Hệ thống</span>
                    </NavLink>
                    <NavLink to="/admin/logs" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <ScrollText size={20} /><span>Nhật ký (Audit Logs)</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer mt-auto">
                    <div className="user-info flex items-center gap-2 text-red-600 font-bold mb-4">
                        <ShieldCheck size={20} />
                        <span>{user?.username || 'Super Admin'}</span>
                    </div>
                    <button onClick={handleLogout} className="btn-logout w-full flex justify-center bg-gray-200 hover:bg-gray-300">
                        <LogOut size={18} /><span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            <main className="main-content bg-gray-50">
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;
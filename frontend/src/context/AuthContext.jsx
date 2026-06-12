import React, { createContext, useState, useEffect, useContext } from 'react';
import axiosClient from '../api/axiosClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isGuest, setIsGuest] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedGuest = sessionStorage.getItem('isGuest');

        if (storedToken && storedToken !== 'undefined') {
            const storedUser = localStorage.getItem('user');
            if (storedUser && storedUser !== 'undefined') {
                setUser(JSON.parse(storedUser));
            }
        } else if (storedGuest === 'true') {
            setIsGuest(true);
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            // 1. Gọi API Login
            const res = await axiosClient.post('/api/auth/login', { username, password });
            const token = typeof res.data === 'string' ? res.data : (res.data.token || res.data.accessToken);

            if (!token) throw new Error("Không lấy được Token từ Backend!");

            // 2. Giải mã JWT
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const decodedData = JSON.parse(jsonPayload);
            const userData = {
                id: decodedData.sub,
                role: decodedData.role
            };

            // 3. Lưu dữ liệu và cập nhật State (Logic Check-in đã dời sang DeviceContext)
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));

            setUser(userData);
            setIsGuest(false);
            sessionStorage.removeItem('isGuest');
            return true;
        } catch (error) {
            console.error("Lỗi đăng nhập:", error);
            throw error;
        }
    };

    const loginAsGuest = async () => {
        sessionStorage.setItem('isGuest', 'true');
        const guestId = 'guest_' + Math.random().toString(36).substring(7);
        sessionStorage.setItem('guestId', guestId);
        setIsGuest(true);
        setUser(null);
    };

    const logout = async () => {
        // Dọn dẹp bộ nhớ (Logic Check-out đã dời sang DeviceContext)
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('isGuest');
        sessionStorage.removeItem('guestId');

        setUser(null);
        setIsGuest(false);
    };

    return (
        <AuthContext.Provider value={{ user, isGuest, loading, login, loginAsGuest, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
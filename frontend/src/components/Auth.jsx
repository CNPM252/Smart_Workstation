import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axiosClient from "../api/axiosClient";
import "../styles/Auth.css";

const Auth = () => {
    const [isLoginMode, setIsLoginMode] = useState(true);
    // THÊM STATE CHO inAppName
    const [formData, setFormData] = useState({ username: '', password: '', inAppName: '' });
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const { login, loginAsGuest } = useAuth();

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setErrorMsg('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (isLoginMode) {
            try {
                await login(formData.username, formData.password);
                navigate('/dashboard');
            } catch (error) {
                setErrorMsg("Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu!");
            }
        } else {
            try {
                // 🚀 GỬI KÈM inAppName XUỐNG BACKEND
                await axiosClient.post('/api/auth/register', {
                    username: formData.username,
                    password: formData.password,
                    inAppName: formData.inAppName
                });
                alert("Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ.");
                setIsLoginMode(true);
                // Xóa form sau khi đăng ký
                setFormData({ username: '', password: '', inAppName: '' });
            } catch (error) {
                setErrorMsg("Đăng ký thất bại. Tên đăng nhập này có thể đã được sử dụng.");
            }
        }
    };

    const handleGuestClick = () => {
        loginAsGuest();
        navigate('/dashboard');
    };

    // 🚀 HÀM HỖ TRỢ ĐỂ RESET FORM KHI BẤM CHUYỂN ĐỔI GIỮA ĐĂNG NHẬP / ĐĂNG KÝ
    const toggleMode = () => {
        setIsLoginMode(!isLoginMode);
        setFormData({ username: '', password: '', inAppName: '' });
        setErrorMsg('');
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-container">
                <h2 className="auth-title">
                    {isLoginMode ? 'Đăng nhập Hệ thống' : 'Tạo tài khoản mới'}
                </h2>

                {errorMsg && <div className="error-message">{errorMsg}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Tên đăng nhập</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="Nhập tên đăng nhập..."
                        />
                    </div>

                    {/* 🚀 CHỈ HIỂN THỊ Ô NÀY KHI ĐANG Ở CHẾ ĐỘ ĐĂNG KÝ */}
                    {!isLoginMode && (
                        <div className="input-group">
                            <label>Tên hiển thị (In-App Name)</label>
                            <input
                                type="text"
                                name="inAppName"
                                value={formData.inAppName}
                                onChange={handleChange}
                                required
                                placeholder="VD: Nguyễn Văn A..."
                            />
                        </div>
                    )}

                    <div className="input-group">
                        <label>Mật khẩu</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Nhập mật khẩu..."
                        />
                    </div>

                    <button type="submit" className="btn-submit">
                        {isLoginMode ? 'Đăng nhập' : 'Đăng ký'}
                    </button>
                </form>

                <div className="auth-switch">
                    <button onClick={toggleMode}>
                        {isLoginMode ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                    </button>
                </div>

                <hr className="auth-divider" />

                <button onClick={handleGuestClick} className="btn-guest">
                    Truy cập nhanh (Chế độ Khách)
                </button>

                <div className="example-account">
                    <h3>Testing account</h3>
                    <p>TK: a123</p>
                    <p>MK: 123</p>
                </div>
            </div>
        </div>
    );
};

export default Auth;
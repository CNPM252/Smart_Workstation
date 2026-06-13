import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { Users, Map, Cpu, ScrollText } from 'lucide-react';

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRooms: 0,
        totalDevices: 0,
        totalLogs: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Gọi API 2 mà chúng ta vừa tạo ở Backend
                const res = await axiosClient.get('/api/admin/dashboard');
                setStats(res.data);
            } catch (error) {
                console.error("Lỗi lấy dữ liệu Admin Dashboard:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-gray-500 font-medium">Đang tải dữ liệu hệ thống...</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Card 1: Users */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition">
                    <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                        <Users size={28} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold mb-1">Tổng số User</p>
                        <h3 className="text-3xl font-bold text-gray-800 leading-none">{stats.totalUsers}</h3>
                    </div>
                </div>

                {/* Card 2: Rooms */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition">
                    <div className="p-4 bg-purple-100 text-purple-600 rounded-full">
                        <Map size={28} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold mb-1">Không gian (Rooms)</p>
                        <h3 className="text-3xl font-bold text-gray-800 leading-none">{stats.totalRooms}</h3>
                    </div>
                </div>

                {/* Card 3: Devices */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition">
                    <div className="p-4 bg-orange-100 text-orange-600 rounded-full">
                        <Cpu size={28} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold mb-1">Mạch IoT liên kết</p>
                        <h3 className="text-3xl font-bold text-gray-800 leading-none">{stats.totalDevices}</h3>
                    </div>
                </div>

                {/* Card 4: Logs */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-5 hover:shadow-md transition">
                    <div className="p-4 bg-red-100 text-red-600 rounded-full">
                        <ScrollText size={28} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-semibold mb-1">Sự kiện (Logs)</p>
                        <h3 className="text-3xl font-bold text-gray-800 leading-none">{stats.totalLogs}</h3>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;
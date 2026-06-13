import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { ScrollText, Search, Filter } from 'lucide-react';

const AdminLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axiosClient.get('/api/admin/logs');
                setLogs(res.data);
            } catch (error) {
                console.error("Lỗi lấy Logs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    // Parse description JSON thành text
    const parseDescription = (descJson) => {
        try {
            const obj = JSON.parse(descJson);
            let text = obj.action || '';
            if (obj.roomName) text += ` - Phòng: ${obj.roomName}`;
            if (obj.groupName) text += ` - Nhóm: ${obj.groupName}`;
            if (obj.addedUser) text += ` - Người được thêm: ${obj.addedUser}`;
            if (obj.removedUser) text += ` - Người bị xóa: ${obj.removedUser}`;
            return text;
        } catch (e) {
            return descJson;
        }
    };

    const getEventBadge = (type) => {
        switch (type) {
            case 'AUTH': return 'bg-blue-100 text-blue-800';
            case 'ROOM': return 'bg-purple-100 text-purple-800';
            case 'GROUP': return 'bg-cyan-100 text-cyan-800';
            case 'DEVICE': return 'bg-orange-100 text-orange-800';
            case 'ATTENDANCE': return 'bg-emerald-100 text-emerald-800';
            case 'CONFIG': return 'bg-gray-200 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredLogs = logs.filter(log =>
        log.actedByUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.eventType.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo User hoặc Loại..."
                        className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Đang tải dữ liệu...</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                            <th className="p-4 font-semibold">Thời gian</th>
                            <th className="p-4 font-semibold">Tài khoản (Actor)</th>
                            <th className="p-4 font-semibold">Phân loại</th>
                            <th className="p-4 font-semibold">Chi tiết sự kiện</th>
                            <th className="p-4 font-semibold">Thiết bị liên quan</th>
                        </tr>
                        </thead>
                        <tbody className="text-sm">
                        {filteredLogs.map((log) => (
                            <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-4 text-gray-500 whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                                </td>
                                <td className="p-4 font-medium text-gray-800">{log.actedByUser}</td>
                                <td className="p-4">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${getEventBadge(log.eventType)}`}>
                                            {log.eventType}
                                        </span>
                                </td>
                                <td className="p-4 text-gray-700">{parseDescription(log.description)}</td>
                                <td className="p-4 font-mono text-xs text-gray-500">
                                    {log.device?.macAddress || '-'}
                                </td>
                            </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">Không tìm thấy bản ghi nào.</td></tr>
                        )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default AdminLogs;
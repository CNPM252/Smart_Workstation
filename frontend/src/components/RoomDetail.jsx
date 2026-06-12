import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';
import { ArrowLeft, Monitor, Usb, Map } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const RoomDetail = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [room, setRoom] = useState({ name: 'Đang tải...', roomCode: '' });
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);

    // Kích thước sa bàn ảo
    const GRID_ROWS = 6;
    const GRID_COLS = 8;

    const userOwner = user?.id || user?.username;

    // TẢI DỮ LIỆU BAN ĐẦU VÀ KẾT NỐI WEBSOCKET
    useEffect(() => {
        if (!userOwner || !roomId) return;

        const fetchInitialData = async () => {
            try {
                // 1. Lấy thông tin phòng
                const roomsRes = await axiosClient.get('/api/rooms', { params: { owner: userOwner } });
                const currentRoom = roomsRes.data.find(r => r.id === roomId);
                if (currentRoom) setRoom(currentRoom);

                // 2. Lấy danh sách thiết bị ban đầu để vẽ giao diện nhanh
                const devicesRes = await axiosClient.get(`/api/devices/room/${roomId}`);
                if (Array.isArray(devicesRes.data)) {
                    setDevices(devicesRes.data);
                }
            } catch (error) {
                console.error("Lỗi khi tải dữ liệu phòng:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();

        // 3. MỞ ĐƯỜNG ỐNG WEBSOCKET REAL-TIME
        const socket = new SockJS('http://localhost:8080/ws');
        const stompClient = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000, // Tự động kết nối lại nếu rớt mạng
            onConnect: () => {
                console.log(' Đã kết nối WebSocket thành công vào phòng:', roomId);

                // Đăng ký nghe lén kênh của phòng này
                stompClient.subscribe(`/topic/room/${roomId}`, (message) => {
                    if (message.body) {
                        const latestDevices = JSON.parse(message.body);
                        setDevices(latestDevices); // Re-render UI ngay lập tức
                    }
                });
            },
            onStompError: (frame) => {
                console.error('Lỗi WebSocket: ' + frame.headers['message']);
            }
        });

        stompClient.activate();

        // 4. Cleanup: Ngắt kết nối khi rời khỏi trang sa bàn
        return () => {
            if (stompClient.active) {
                stompClient.deactivate();
            }
        };
    }, [roomId, userOwner]);

    // Phân loại thiết bị
    const placedDevices = devices.filter(d => (d.xposition != null || d.xPosition != null) && (d.yposition != null || d.yPosition != null));
    const unplacedDevices = devices.filter(d => (d.xposition == null && d.xPosition == null) || (d.yposition == null && d.yPosition == null));

    // --- LOGIC KÉO THẢ (DRAG & DROP) ---
    const handleDragStart = (e, macAddress) => {
        e.dataTransfer.setData('macAddress', macAddress);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDropOnGrid = async (e, x, y) => {
        e.preventDefault();
        const mac = e.dataTransfer.getData('macAddress');
        if (!mac) return;

        // Cập nhật UI ngay lập tức
        setDevices(prev => prev.map(d =>
            d.macAddress === mac ? { ...d, xPosition: x, yPosition: y, xposition: x, yposition: y } : d
        ));

        // Gọi API lưu xuống Database
        try {
            await axiosClient.put(`/api/devices/${mac}/position`, { x, y });
        } catch (error) {
            console.error("Lỗi lưu tọa độ:", error);
            alert("Lỗi khi lưu vị trí thiết bị!");
            // Nếu lỗi, fetch lại devices từ server để đồng bộ
            const devicesRes = await axiosClient.get(`/api/devices/room/${roomId}`);
            setDevices(devicesRes.data);
        }
    };

    const handleDropOnSidebar = async (e) => {
        e.preventDefault();
        const mac = e.dataTransfer.getData('macAddress');
        if (!mac) return;

        setDevices(prev => prev.map(d =>
            d.macAddress === mac ? { ...d, xPosition: null, yPosition: null, xposition: null, yposition: null } : d
        ));

        try {
            await axiosClient.put(`/api/devices/${mac}/position`, { x: null, y: null });
        } catch (error) {
            console.error("Lỗi gỡ tọa độ:", error);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải cấu trúc không gian...</div>;

    return (
        <div className="h-full flex flex-col p-2">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/rooms')}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                    <ArrowLeft size={24} className="text-gray-600" />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{room.name}</h2>
                    <p className="text-sm font-medium text-blue-600 bg-blue-50 inline-block px-3 py-1 rounded-md mt-1">
                        Room Code: {room.roomCode}
                    </p>
                </div>
            </div>

            {/* Layout Chia Đôi */}
            <div className="flex flex-1 gap-6 min-h-[600px]">

                {/* TRÁI: SA BÀN LƯỚI */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center justify-between">
                        <div className="flex items-center">
                            <Map className="mr-2" size={20} /> Sơ đồ thiết bị
                        </div>
                    </h3>

                    <div
                        className="flex-1 border-2 border-dashed border-gray-200 bg-gray-50 rounded-lg grid p-4 gap-2"
                        style={{
                            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`
                        }}
                    >
                        {Array.from({ length: GRID_ROWS }).map((_, rowIdx) => (
                            Array.from({ length: GRID_COLS }).map((_, colIdx) => {
                                const deviceHere = placedDevices.find(
                                    d => (d.xposition === colIdx || d.xPosition === colIdx) &&
                                        (d.yposition === rowIdx || d.yPosition === rowIdx)
                                );

                                return (
                                    <div
                                        key={`${colIdx}-${rowIdx}`}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDropOnGrid(e, colIdx, rowIdx)}
                                        className={`rounded-lg border relative flex items-center justify-center transition-all ${
                                            deviceHere ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:bg-blue-50/50'
                                        }`}
                                    >
                                        <span className="absolute top-1 left-1 text-[10px] text-gray-300 font-mono">
                                            {colIdx},{rowIdx}
                                        </span>

                                        {deviceHere && (
                                            <div
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, deviceHere.macAddress)}
                                                className={`cursor-move flex flex-col items-center p-2 w-full h-full justify-center ${(deviceHere.active || deviceHere.isActive) ? 'text-emerald-600' : 'text-red-500 hover:text-red-600'}`}
                                                title={deviceHere.currentUser ? `User: ${deviceHere.currentUser}` : 'Đang trống'}
                                            >
                                                <Monitor size={32} />
                                                <span className="text-[10px] font-bold mt-1 bg-white px-1 rounded border border-gray-200 text-gray-600">
                                                    {deviceHere.macAddress}
                                                </span>

                                                {/* HIỂN THỊ MSSV HOẶC CHỮ "TRỐNG" */}
                                                <span className={`text-[11px] font-bold mt-1 px-2 rounded-full ${(deviceHere.active || deviceHere.isActive) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
                                                    {(deviceHere.active || deviceHere.isActive) ? `👤 ${deviceHere.currentUser}` : 'Trống'}
                                                </span>

                                                {/* ĐÈN LED TÍN HIỆU GÓC TRÊN */}
                                                <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full shadow-sm ${(deviceHere.active || deviceHere.isActive) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ))}
                    </div>
                </div>

                {/* PHẢI: THIẾT BỊ CHƯA SẮP XẾP */}
                <div
                    className="w-80 bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col"
                    onDragOver={handleDragOver}
                    onDrop={handleDropOnSidebar}
                >
                    <h3 className="text-lg font-bold text-gray-700 mb-1 flex items-center">
                        <Usb className="mr-2" size={20} /> Chờ sắp xếp
                    </h3>
                    <p className="text-xs text-gray-500 mb-6 pb-4 border-b border-gray-100">
                        Kéo thả thiết bị vào sa bàn hoặc kéo từ sa bàn về đây để gỡ bỏ.
                    </p>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {unplacedDevices.length === 0 ? (
                            <div className="text-center text-sm text-gray-400 italic pt-10">
                                Không có thiết bị nào đang chờ.
                            </div>
                        ) : (
                            unplacedDevices.map(device => (
                                <div
                                    key={device.macAddress}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, device.macAddress)}
                                    className="bg-white border-2 border-gray-200 p-3 rounded-lg flex items-center cursor-move hover:border-blue-400 hover:shadow-md transition-all active:scale-95"
                                >
                                    <div className="bg-gray-100 p-2 rounded-md mr-3">
                                        <Monitor size={20} className="text-gray-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{device.macAddress}</p>
                                        <p className="text-xs text-blue-600 font-medium">Sẵn sàng</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default RoomDetail;
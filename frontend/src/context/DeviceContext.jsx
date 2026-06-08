import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from './AuthContext';

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [sensorData, setSensorData] = useState({
        macAddress: '',
        distance: 0,
        light: 0,
        motion: false
    });

    const portRef = useRef(null);
    const readerRef = useRef(null);
    const selectedDeviceMacRef = useRef('');

    const currentUserId = user?.id || user?.username;

    // 1. KỊCH BẢN 1: Bắt sự kiện tắt tab hoặc F5 đột ngột (Dùng Beacon API)
    useEffect(() => {
        const handleUnload = () => {
            if (isConnected && selectedDeviceMacRef.current) {
                // Tái sử dụng chính xác RESTful API check-out hiện có của hệ thống
                const url = `http://localhost:8080/api/devices/${selectedDeviceMacRef.current}/check-out`;
                navigator.sendBeacon(url); // sendBeacon tự động gửi method POST ngầm
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [isConnected]);

    // 2. KỊCH BẢN 2: Bắt sự kiện rút nóng cáp USB vật lý
    useEffect(() => {
        const handleSerialDisconnect = async () => {
            console.log("🔌 Cáp USB đã bị rút đột ngột!");
            cleanupConnection();
            if (selectedDeviceMacRef.current) {
                try {
                    // Trình duyệt vẫn sống -> Gọi axios để giải phóng thiết bị ngay lập tức
                    await axiosClient.post(`/api/devices/${selectedDeviceMacRef.current}/check-out`);
                    alert("🔌 Thiết bị đã bị ngắt kết nối vật lý. Phiên làm việc đã được giải phóng!");
                } catch (err) {
                    console.error("Lỗi giải phóng thiết bị khi rút cáp:", err);
                }
            }
        };

        if (navigator.serial) {
            navigator.serial.addEventListener('disconnect', handleSerialDisconnect);
        }
        return () => {
            if (navigator.serial) {
                navigator.serial.removeEventListener('disconnect', handleSerialDisconnect);
            }
        };
    }, []);

    const cleanupConnection = () => {
        setIsConnected(false);
        portRef.current = null;
        readerRef.current = null;
    };

    // Hàm kết nối cổng COM toàn cục
    const connectDevice = async () => {
        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });

            // Lá bùa nhả chân CPU chống Reset mạch
            await port.setSignals({ dataTerminalReady: true, requestToSend: true });

            portRef.current = port;
            setIsConnected(true);

            // Kích hoạt luồng đọc dữ liệu nền bất đồng bộ
            readSerialData();
        } catch (error) {
            console.error("Lỗi kết nối Web Serial:", error);
            alert("Không thể kết nối tới thiết bị!");
        }
    };

    // Vòng lặp đọc dữ liệu liên tục chạy ở Background
    const readSerialData = async () => {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = portRef.current.readable.pipeTo(textDecoder.writable);
        const reader = textDecoder.readable.getReader();
        readerRef.current = reader;

        let buffer = '';

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                if (value) {
                    buffer += value;
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Giữ lại dòng chưa hoàn chỉnh cuối cùng

                    for (const line of lines) {
                        try {
                            const cleanedLine = line.trim();
                            if (!cleanedLine.startsWith('{')) continue;

                            const parsedJson = JSON.parse(cleanedLine);

                            // Cập nhật REF phục vụ cho luồng dọn dẹp khẩn cấp
                            selectedDeviceMacRef.current = parsedJson.mac_address;

                            // 🚀 BỘ LỌC NHIỄU SỐ ĐO TRƯỚC KHI ĐƯA VÀO STATE
                            // Nếu cảm biến trả khoảng cách bậy do góc khuất, chuẩn hóa về khoảng cách Sleep an toàn
                            let filteredDistance = parsedJson.distance;
                            if (filteredDistance < 0 || filteredDistance > 200) {
                                filteredDistance = 0; // Đưa về trạng thái kích hoạt chế độ ngủ đông
                            }

                            setSensorData({
                                macAddress: parsedJson.mac_address,
                                distance: filteredDistance,
                                light: parsedJson.light,
                                motion: parsedJson.motion
                            });
                        } catch (e) {
                            // Bỏ qua dòng dữ liệu rác nếu giải mã JSON lỗi
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Luồng đọc Serial bị ngắt:", error);
        } finally {
            reader.releaseLock();
        }
    };

    return (
        <DeviceContext.Provider value={{ isConnected, sensorData, connectDevice }}>
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => useContext(DeviceContext);
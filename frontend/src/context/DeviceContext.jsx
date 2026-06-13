import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from './AuthContext';

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
    // LẤY THÔNG TIN USER TỪ AUTH
    const { user, isGuest } = useAuth();

    const [isSleeping, setIsSleeping] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [sensorData, setSensorData] = useState({
        macAddress: '', distance: 0, light: 0, motion: false
    });

    const portRef = useRef(null);
    const readerRef = useRef(null);
    const selectedDeviceMacRef = useRef('');
    const latestSensorDataRef = useRef(null);

    // REF: LƯU MÃ MAC ĐANG ĐƯỢC CHECK-IN TRONG DB
    const checkedInMacRef = useRef(null);
    const lastInteractionRef = useRef(Date.now());

    // Tính toán UserId hiện tại (User thường hoặc Guest)
    const currentUserId = user?.id || user?.username || (isGuest ? sessionStorage.getItem('guestId') : null);

    // LẮNG NGHE SỰ KIỆN CHUỘT / BÀN PHÍM ĐỂ ĐÁNH THỨC
    useEffect(() => {
        const handleUserActivity = () => {
            lastInteractionRef.current = Date.now();
            setIsSleeping(false);
        };

        window.addEventListener('mousemove', handleUserActivity);
        window.addEventListener('keydown', handleUserActivity);
        window.addEventListener('click', handleUserActivity);

        return () => {
            window.removeEventListener('mousemove', handleUserActivity);
            window.removeEventListener('keydown', handleUserActivity);
            window.removeEventListener('click', handleUserActivity);
        };
    }, []);

    // TỰ ĐỘNG CHECK-IN / CHECK-OUT DỰA VÀO CÁP & ĐĂNG NHẬP
    useEffect(() => {
        const mac = sensorData.macAddress;

        const doCheckIn = async (macToUse, userToUse) => {
            if (checkedInMacRef.current === macToUse) return;
            try {
                await axiosClient.post(`/api/devices/${macToUse}/check-in`, null, { params: { userId: userToUse } });
                console.log(`[IoT] Đã Check-in mạch ${macToUse} cho người dùng ${userToUse}`);
                checkedInMacRef.current = macToUse; // Lưu vết
            } catch (err) {
                console.error("[IoT] Lỗi check-in:", err);
            }
        };

        const doCheckOut = async (macToUse) => {
            if (!checkedInMacRef.current) return;
            try {
                await axiosClient.post(`/api/devices/${macToUse}/check-out`);
                console.log(`[IoT] Đã Check-out giải phóng mạch ${macToUse}`);
                checkedInMacRef.current = null; // Xóa vết
            } catch (err) {
                console.error("[IoT] Lỗi check-out:", err);
            }
        };

        // Kịch bản 1: Cắm cáp đọc được MAC + Có người dùng -> Check-in
        if (mac && currentUserId) {
            doCheckIn(mac, currentUserId);
        }
        // Kịch bản 2: Người dùng đăng xuất (mất currentUserId) nhưng mạch vẫn đang cắm -> Check-out
        else if (!currentUserId && checkedInMacRef.current) {
            doCheckOut(checkedInMacRef.current);
        }
    }, [sensorData.macAddress, currentUserId]);

    // XỬ LÝ UNLOAD & RÚT CÁP ĐỘT NGỘT
    useEffect(() => {
        const handleUnload = () => {
            // Tắt trình duyệt lúc đang cắm -> Bắn beacon Check-out
            if (checkedInMacRef.current) {
                navigator.sendBeacon(`http://localhost:8080/api/devices/${checkedInMacRef.current}/check-out`);
            }
        };

        const handleSerialDisconnect = async () => {
            console.log("🔌 Cáp USB đã bị rút đột ngột!");
            const macToCheckout = checkedInMacRef.current || selectedDeviceMacRef.current;

            cleanupConnection();

            // Nếu rút cáp thì Check-out ngay lập tức
            if (macToCheckout) {
                try {
                    await axiosClient.post(`/api/devices/${macToCheckout}/check-out`);
                    alert("🔌 Thiết bị đã bị ngắt kết nối. Phiên làm việc đã được giải phóng trên hệ thống!");
                    checkedInMacRef.current = null;
                    selectedDeviceMacRef.current = '';
                    setSensorData({ macAddress: '', distance: 0, light: 0, motion: false });
                } catch (err) {
                    console.error("Lỗi giải phóng thiết bị:", err);
                }
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        if (navigator.serial) navigator.serial.addEventListener('disconnect', handleSerialDisconnect);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            if (navigator.serial) navigator.serial.removeEventListener('disconnect', handleSerialDisconnect);
        };
    }, [isConnected]);

    // Bộ bơm Telemetry & Đồng bộ lệnh
    useEffect(() => {
        if (!isConnected || !currentUserId) return;

        const pumpInterval = setInterval(async () => {
            const currentData = latestSensorDataRef.current;

            if (currentData && currentData.macAddress) {
                try {
                    const response = await axiosClient.post('/api/devices/telemetry', {
                        macAddress: currentData.macAddress,
                        currentUserId: currentUserId,
                        distance: currentData.distance,
                        light: currentData.light,
                        motion: currentData.motion,
                        status: isSleeping ? "sleeping" : "awake"
                    });

                    const { action, autoDim, manualBrightness } = response.data;
                    const timeSinceInteraction = Date.now() - lastInteractionRef.current;
                    const isManuallyAwake = timeSinceInteraction < 30000;
                    const finalAction = (action === "SLEEP" && !isManuallyAwake) ? "SLEEP" : "AWAKE";

                    setIsSleeping(finalAction === "SLEEP");

                    if (portRef.current && portRef.current.writable) {
                        const writer = portRef.current.writable.getWriter();
                        const serialPacket = JSON.stringify({ cmd: finalAction, auto: autoDim, val: manualBrightness });
                        await writer.write(new TextEncoder().encode(serialPacket + '\n'));
                        writer.releaseLock();
                    }
                } catch (err) {
                    console.error("Lỗi đồng bộ Telemetry:", err);
                }
            }
        }, 1000);

        return () => clearInterval(pumpInterval);
    }, [isConnected, currentUserId, isSleeping]);

    const cleanupConnection = () => {
        setIsConnected(false);
        setIsSleeping(false);
        portRef.current = null;
        readerRef.current = null;
    };

    // Kết nối & Đọc Serial
    const connectDevice = async () => {
        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 115200 });
            await port.setSignals({ dataTerminalReady: true, requestToSend: true });

            portRef.current = port;
            setIsConnected(true);
            readSerialData();
        } catch (error) {
            console.error("Lỗi Web Serial:", error);
            alert("Không thể kết nối tới thiết bị!");
        }
    };

    const readSerialData = async () => {
        const textDecoder = new TextDecoderStream();
        portRef.current.readable.pipeTo(textDecoder.writable);
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
                    buffer = lines.pop();

                    for (const line of lines) {
                        try {
                            const cleanedLine = line.trim();
                            if (!cleanedLine.startsWith('{')) continue;

                            const parsedJson = JSON.parse(cleanedLine);
                            selectedDeviceMacRef.current = parsedJson.mac_address;

                            const newSensorData = {
                                macAddress: parsedJson.mac_address,
                                distance: parsedJson.distance,
                                light: parsedJson.light,
                                motion: parsedJson.motion
                            };

                            setSensorData(newSensorData);
                            latestSensorDataRef.current = newSensorData;
                        } catch (e) {}
                    }
                }
            }
        } catch (error) {
            console.error("Ngắt luồng đọc Serial:", error);
        } finally {
            reader.releaseLock();
        }
    };

    return (
        <DeviceContext.Provider value={{ isConnected, isSleeping, sensorData, connectDevice, portRef }}>
            {isSleeping && (
                <div
                    className="fixed inset-0 z-9999 bg-black/95 flex flex-col items-center justify-center transition-opacity duration-500"
                    style={{ backdropFilter: 'blur(6px)' }}
                >
                    <div className="text-white text-center pointer-events-none">
                        <div className="text-6xl mb-4 animate-pulse">🌙</div>
                        <h1 className="text-4xl font-bold mb-2 text-gray-300">Đang ngủ đông... Zzz</h1>
                        <p className="text-lg text-gray-300">Hệ thống đang tự động tiết kiệm năng lượng.</p>
                        <p className="text-sm text-gray-400 mt-6">Hãy ngồi vào bàn làm việc hoặc di chuyển chuột để đánh thức hệ thống.</p>
                    </div>
                </div>
            )}
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = () => useContext(DeviceContext);
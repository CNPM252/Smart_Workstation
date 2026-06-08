package com.hcmut.backend.service;

import com.hcmut.backend.model.Device;
import com.hcmut.backend.model.Room;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.repository.RoomRepository;
import com.hcmut.backend.dto.DeviceJoinRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final RoomRepository roomRepository;

    @Transactional
    public void checkIn(String macAddress, String userId) {
        Device device = deviceRepository.findById(macAddress)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị: " + macAddress));

        // Cập nhật trạng thái máy
        device.setCurrentUser(userId);
        device.setActive(true);
        deviceRepository.save(device);

        System.out.println("USER [" + userId + "] đã check-in tại thiết bị [" + macAddress + "]");
    }

    @Transactional
    public void checkOut(String macAddress) {
        Device device = deviceRepository.findById(macAddress)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị: " + macAddress));

        // Giải phóng máy
        device.setCurrentUser(null);
        device.setActive(false);
        deviceRepository.save(device);

        System.out.println("Thiết bị [" + macAddress + "] đã check-out");
    }

    /// ///////////////////////////////////
    /// Luồng quản lí thêm máy vào room
    /// ///////////////////////////////////

    @Transactional
    public Device autoJoinRoom(DeviceJoinRequest request) {
        Room room = roomRepository.findByRoomCode(request.getRoomCode())
                .orElseThrow(() -> new IllegalArgumentException("Mã phòng không tồn tại!"));

        Device device = deviceRepository.findById(request.getMacAddress())
                .orElse(new Device());

        device.setMacAddress(request.getMacAddress());
        device.setRoom(room);

        return deviceRepository.save(device);
    }

    // Admin thêm thủ công 1 máy
    @Transactional
    public Device manuallyAssignRoom(DeviceJoinRequest request) {
        Room room = roomRepository.findById(request.getRoomId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phòng!"));

        Device device = deviceRepository.findById(request.getMacAddress())
                .orElse(new Device());

        device.setMacAddress(request.getMacAddress());
        device.setRoom(room);
        device.setXPosition(request.getXPosition());
        device.setYPosition(request.getYPosition());

        return deviceRepository.save(device);
    }

    // kéo thả cập nhật X, Y
    @Transactional
    public Device updatePosition(String macAddress, Integer x, Integer y) {
        Device device = deviceRepository.findById(macAddress)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị!"));

        device.setXPosition(x);
        device.setYPosition(y);
        return deviceRepository.save(device);
    }


    public java.util.List<Device> getDevicesByRoom(java.util.UUID roomId) {
        return deviceRepository.findByRoom_Id(roomId);
    }

}
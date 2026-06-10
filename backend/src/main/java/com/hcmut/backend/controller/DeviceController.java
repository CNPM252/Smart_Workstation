package com.hcmut.backend.controller;

import com.hcmut.backend.dto.TelemetryRequest;
import com.hcmut.backend.dto.DeviceJoinRequest;
import com.hcmut.backend.model.Device;
import com.hcmut.backend.model.User;
import com.hcmut.backend.repository.UserRepository;
import com.hcmut.backend.service.DeviceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Map;

@RestController
@RequestMapping("/api/devices")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class DeviceController {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    private final DeviceService deviceService;

    private final UserRepository userRepository;

    @PostMapping("/{macAddress}/check-in")
    public ResponseEntity<?> checkIn(@PathVariable String macAddress, @RequestParam String userId) {
        try {
            deviceService.checkIn(macAddress, userId);
            return ResponseEntity.ok("Check-in thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{macAddress}/check-out")
    public ResponseEntity<?> checkOut(@PathVariable String macAddress) {
        try {
            deviceService.checkOut(macAddress);
            return ResponseEntity.ok("Check-out thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }


    /// /////////////////////////////////
    /// Gắn máy và x,y vào room
    /// ////////////////////////////////


    @GetMapping("/room/{roomId}")
    public ResponseEntity<?> getDevicesByRoom(@PathVariable java.util.UUID roomId) {
        return ResponseEntity.ok(deviceService.getDevicesByRoom(roomId));
    }

    @PostMapping("/auto-join")
    public ResponseEntity<?> autoJoin(@RequestBody DeviceJoinRequest request) {
        try {
            Device savedDevice = deviceService.autoJoinRoom(request);
            return ResponseEntity.ok("Thiết bị " + savedDevice.getMacAddress() + " đã vào phòng thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/manual-join")
    public ResponseEntity<?> manualJoin(@RequestBody DeviceJoinRequest request) {
        try {
            Device savedDevice = deviceService.manuallyAssignRoom(request);
            return ResponseEntity.ok(savedDevice);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{macAddress}/position")
    public ResponseEntity<?> updatePosition(@PathVariable String macAddress, @RequestBody Map<String, Integer> position) {
        try {
            Device updated = deviceService.updatePosition(macAddress, position.get("x"), position.get("y"));
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /// /////////////////////////////////
    /// ingest data tu react
    /// ////////////////////////////////


    @PostMapping("/telemetry")
    public ResponseEntity<?> receiveTelemetry(@RequestBody TelemetryRequest request) {
        try {
            ObjectNode logNode = objectMapper.createObjectNode();

            logNode.put("deviceMacAddress", request.getMacAddress());

            logNode.put("currentUserId", request.getCurrentUserId());

            logNode.put("lightValue", request.getLight());
            logNode.put("distanceValue", request.getDistance());
            logNode.put("recordedAt", System.currentTimeMillis()); // Lấy timestamp hiện tại

            String jsonLog = objectMapper.writeValueAsString(logNode);

            // Đẩy vào Redis Queue (Bên phải đẩy vào, bên trái lấy ra)
            stringRedisTemplate.opsForList().rightPush("history_log_queue", jsonLog);

            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Lỗi đẩy data vào Redis: " + e.getMessage());
        }
    }


}
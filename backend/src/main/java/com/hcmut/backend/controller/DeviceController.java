package com.hcmut.backend.controller;

import com.hcmut.backend.dto.TelemetryRequest;
import com.hcmut.backend.dto.DeviceJoinRequest;
import com.hcmut.backend.model.Device;
import com.hcmut.backend.model.User;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.repository.UserRepository;
import com.hcmut.backend.service.DeviceService;
import com.hcmut.backend.model.UserConfig;
import com.hcmut.backend.repository.UserConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.context.ApplicationEventPublisher;
import com.hcmut.backend.event.SystemEvent;

import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/devices")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class DeviceController {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    private final DeviceService deviceService;
    private final DeviceRepository deviceRepository;

    private final UserRepository userRepository;
    private final UserConfigRepository userConfigRepository;

    private final SimpMessagingTemplate messagingTemplate;

    private final ApplicationEventPublisher eventPublisher;

    @PostMapping("/{macAddress}/check-in")
    public ResponseEntity<?> checkIn(@PathVariable String macAddress, @RequestParam String userId) {
        try {
            deviceService.checkIn(macAddress, userId);

            Device device = deviceRepository.findById(macAddress)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị"));

            if (device.getRoom() != null) {
                broadcastRoomUpdate(device.getRoom().getId());
            }

            String desc = String.format("{\"action\": \"Check-in thiết bị\", \"room\": \"%s\"}", device.getRoom() != null ? device.getRoom().getName() : "N/A");
            eventPublisher.publishEvent(new SystemEvent(this, userId, "DEVICE", desc, macAddress));

            return ResponseEntity.ok("Check-in thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{macAddress}/check-out")
    public ResponseEntity<?> checkOut(@PathVariable String macAddress) {
        try {
            Device device = deviceRepository.findById(macAddress)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy thiết bị"));

            String lastUser = device.getCurrentUser() != null ? device.getCurrentUser() : "System";
            UUID roomId = device.getRoom() != null ? device.getRoom().getId() : null;

            deviceService.checkOut(macAddress);

            if (roomId != null) {
                broadcastRoomUpdate(roomId);
            }

            eventPublisher.publishEvent(new SystemEvent(this, lastUser, "DEVICE", "{\"action\": \"Check-out/Giải phóng chỗ ngồi\"}", macAddress));

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

            String desc = String.format("{\"action\": \"Nhận diện cắm mạch vào phòng\", \"roomCode\": \"%s\"}", request.getRoomCode());
            eventPublisher.publishEvent(new SystemEvent(this, "Admin/Manager", "DEVICE", desc, request.getMacAddress()));

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
    /// socket/  broadcast cho room
    /// ////////////////////////////////

    private void broadcastRoomUpdate(UUID roomId) {
        if (roomId == null) return;
        List<Device> updatedDevices = deviceRepository.findByRoom_Id(roomId);
        // Bắn danh sách thiết bị mới nhất thẳng xuống kênh của phòng đó
        messagingTemplate.convertAndSend("/topic/room/" + roomId, updatedDevices);
    }

    /// /////////////////////////////////
    /// ingest data tu react
    /// ////////////////////////////////


    @PostMapping("/telemetry")
    public ResponseEntity<?> receiveTelemetry(@RequestBody TelemetryRequest request) {
        try {
            String finalUserId = request.getCurrentUserId();
            String macAddress = request.getMacAddress();
            long now = System.currentTimeMillis();

            // 1.1 GHI VÀO REDIS QUEUE CHO CRON JOB
            ObjectNode logNode = objectMapper.createObjectNode();
            logNode.put("deviceMacAddress", macAddress);
            logNode.put("currentUserId", finalUserId);
            logNode.put("lightValue", request.getLight());
            logNode.put("distanceValue", request.getDistance());
            // LƯU Ý: Nếu entity HistoryLog có cột motion, nên lưu thêm vào đây để phục vụ thống kê chính xác hơn
            // logNode.put("motionValue", request.getMotion());
            logNode.put("recordedAt", now);
            stringRedisTemplate.opsForList().rightPush("history_log_queue", objectMapper.writeValueAsString(logNode));


// 1.2 KHỞI TẠO GIÁ TRỊ MẶC ĐỊNH
            boolean autoDimActive = true;
            int manualBrightness = 100;
            boolean commandSleep = false;
            boolean autoSleepActive = true; // 🚀 Thêm cờ mặc định cho Auto-sleep

            // 1.3 TRUY XUẤT CẤU HÌNH & XỬ LÝ LOGIC NGỦ ĐÔNG
            if (finalUserId != null && !finalUserId.startsWith("guest_")) {
                try {
                    int distMin = 40;
                    int distMax = 70;
                    long timeoutMins = 3;

                    // BƯỚC 1: TÌM TRONG REDIS TRƯỚC
                    String configCacheKey = "user_config_cache:" + finalUserId;
                    String cachedConfigStr = stringRedisTemplate.opsForValue().get(configCacheKey);

                    if (cachedConfigStr != null) {
                        JsonNode cacheNode = objectMapper.readTree(cachedConfigStr);
                        autoDimActive = cacheNode.get("autoDimEnabled").asBoolean();
                        manualBrightness = cacheNode.get("manualLightLevel").asInt();
                        distMin = cacheNode.get("distanceThresholdMin").asInt();
                        distMax = cacheNode.get("distanceThresholdMax").asInt();
                        timeoutMins = cacheNode.get("sleepTimeoutMins").asLong();

                        // 🚀 Đọc cờ Auto-sleep từ Cache
                        if (cacheNode.has("autoSleepEnabled")) {
                            autoSleepActive = cacheNode.get("autoSleepEnabled").asBoolean();
                        }
                    } else {
                        UUID userUuid = null;
                        if (finalUserId.contains("-") && finalUserId.length() == 36) {
                            userUuid = UUID.fromString(finalUserId);
                        } else {
                            User user = userRepository.findByUsername(finalUserId).orElse(null);
                            if (user != null) userUuid = user.getId();
                        }

                        if (userUuid != null) {
                            UserConfig config = userConfigRepository.findByUserId(userUuid).orElse(null);
                            if (config != null) {
                                autoDimActive = config.getAutoDimEnabled();
                                manualBrightness = config.getManualLightLevel();
                                distMin = config.getDistanceThresholdMin();
                                distMax = config.getDistanceThresholdMax();
                                timeoutMins = config.getSleepTimeoutMins();

                                // 🚀 Đọc cờ Auto-sleep từ Database
                                if (config.getAutoSleepEnabled() != null) {
                                    autoSleepActive = config.getAutoSleepEnabled();
                                }

                                ObjectNode cacheNode = objectMapper.createObjectNode();
                                cacheNode.put("autoDimEnabled", autoDimActive);
                                cacheNode.put("manualLightLevel", manualBrightness);
                                cacheNode.put("distanceThresholdMin", distMin);
                                cacheNode.put("distanceThresholdMax", distMax);
                                cacheNode.put("sleepTimeoutMins", timeoutMins);
                                cacheNode.put("autoSleepEnabled", autoSleepActive); // 🚀 Lưu vào Cache

                                stringRedisTemplate.opsForValue().set(configCacheKey, objectMapper.writeValueAsString(cacheNode), 1, TimeUnit.DAYS);
                            }
                        }
                    }

                    // BƯỚC 2: COMPOSITION FILTER V2 (Cửa sổ xác minh 30s)
                    String lastActiveKey = "last_active:" + macAddress;
                    String suspicionKey = "suspicion_start:" + macAddress;

                    boolean hasMotion = Boolean.TRUE.equals(request.getMotion());
                    int currentDist = request.getDistance();

                    int lowerBound = (int) (distMin * 0.8);
                    int upperBound = (int) (distMax * 1.2);

                    boolean isImmediatelyPresent = hasMotion || (currentDist >= lowerBound && currentDist <= upperBound);
                    boolean isPresent = false;

                    if (isImmediatelyPresent) {
                        stringRedisTemplate.delete(suspicionKey);
                        isPresent = true;
                    } else {
                        String suspicionTimeStr = stringRedisTemplate.opsForValue().get(suspicionKey);
                        if (suspicionTimeStr == null) {
                            stringRedisTemplate.opsForValue().set(suspicionKey, String.valueOf(now));
                            isPresent = true;
                        } else {
                            long suspicionTime = Long.parseLong(suspicionTimeStr);
                            long timeInSuspicion = now - suspicionTime;

                            if (timeInSuspicion >= 30 * 1000L) {
                                isPresent = false;
                            } else {
                                isPresent = true;
                            }
                        }
                    }

                    // BƯỚC 3: XỬ LÝ TIME-OUT NGỦ ĐÔNG
                    // 🚀 Nếu TẮT auto-sleep hoặc CÓ NGƯỜI -> Liên tục reset đồng hồ và khóa lệnh ngủ
                    if (!autoSleepActive || isPresent) {
                        stringRedisTemplate.opsForValue().set(lastActiveKey, String.valueOf(now));
                        commandSleep = false;
                    } else {
                        // Nhánh này chỉ chạy khi bật Auto-sleep VÀ đang vắng mặt
                        String lastActiveStr = stringRedisTemplate.opsForValue().get(lastActiveKey);
                        if (lastActiveStr != null) {
                            long lastActiveTime = Long.parseLong(lastActiveStr);
                            long timeAwayMillis = now - lastActiveTime;
                            long timeoutMillisLimit = timeoutMins * 60L * 1000L;

                            if (timeAwayMillis > 24 * 60 * 60 * 1000L) {
                                stringRedisTemplate.opsForValue().set(lastActiveKey, String.valueOf(now));
                                commandSleep = false;
                            } else if (timeAwayMillis > timeoutMillisLimit) {
                                commandSleep = true;
                            }
                        } else {
                            stringRedisTemplate.opsForValue().set(lastActiveKey, String.valueOf(now));
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Lỗi xử lý Telemetry Cache: " + e.getMessage());
                }
            }

            // ĐÓNG GÓI LỆNH TRẢ VỀ FRONTEND
            Map<String, Object> commandResponse = new HashMap<>();
            commandResponse.put("action", commandSleep ? "SLEEP" : "AWAKE");
            commandResponse.put("autoDim", autoDimActive);
            commandResponse.put("manualBrightness", manualBrightness);

            return ResponseEntity.ok(commandResponse);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Lỗi xử lý Telemetry: " + e.getMessage());
        }
    }


}
package com.hcmut.backend.controller;

import com.hcmut.backend.dto.RoomDTO;
import com.hcmut.backend.service.RoomService;
import com.hcmut.backend.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.context.ApplicationEventPublisher;
import com.hcmut.backend.event.SystemEvent;

import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RoomController {

    private final RoomService roomService;
    private final RoomRepository roomRepository;
    private final ApplicationEventPublisher eventPublisher;

    // Lấy danh sách phòng của user
    @GetMapping
    public ResponseEntity<?> getAllRooms(@RequestParam(required = false) String owner)
    {
        if (owner != null && !owner.isEmpty()) {
            return ResponseEntity.ok(roomRepository.findByOwnerUsername(owner));
        }
        return ResponseEntity.ok(Collections.emptyList());
    }

    // Tạo phòng mới
    @PostMapping
    public ResponseEntity<?> createRoom(@RequestBody RoomDTO roomDTO) {
        try {
            RoomDTO newRoom = roomService.createRoom(roomDTO);

            String desc = String.format("{\"action\": \"Tạo không gian\", \"roomName\": \"%s\", \"roomCode\": \"%s\"}", newRoom.getName(), newRoom.getRoomCode());
            eventPublisher.publishEvent(new SystemEvent(this, roomDTO.getOwnerUsername(), "ROOM", desc, null));

            return ResponseEntity.ok(newRoom);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Xóa phòng
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRoom(@PathVariable UUID id) {
        roomService.deleteRoom(id);

        eventPublisher.publishEvent(new SystemEvent(this, "System/Admin", "ROOM", "{\"action\": \"Xóa không gian\"}", null));

        return ResponseEntity.ok("Đã xóa phòng thành công!");
    }
}
package com.hcmut.backend.controller;

import com.hcmut.backend.dto.GroupDTO;
import com.hcmut.backend.model.Device;
import com.hcmut.backend.model.GroupMember;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.repository.GroupMemberRepository;
import com.hcmut.backend.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final DeviceRepository deviceRepository;
    private final GroupMemberRepository groupMemberRepository;

    @GetMapping("/rooms/{roomId}/groups")
    public ResponseEntity<?> getGroupsByRoom(@PathVariable UUID roomId) {
        return ResponseEntity.ok(groupService.getGroupsByRoom(roomId));
    }

    @PostMapping("/rooms/{roomId}/groups")
    public ResponseEntity<?> createGroup(@PathVariable UUID roomId, @RequestBody GroupDTO groupDTO) {
        try {
            if (groupDTO.getName() == null || groupDTO.getManagerUsername() == null) {
                return ResponseEntity.badRequest().body("Thiếu tên nhóm hoặc ID người quản lý!");
            }
            GroupDTO newGroup = groupService.createGroup(roomId, groupDTO);
            return ResponseEntity.ok(newGroup);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<?> deleteGroup(@PathVariable UUID groupId) {
        try {
            groupService.deleteGroup(groupId);
            return ResponseEntity.ok("Đã xóa nhóm thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{groupId}/attendance")
    public ResponseEntity<?> takeAttendance(@PathVariable UUID groupId, @RequestParam UUID roomId) {
        //  Lấy danh sách thành viên hợp lệ của Group
        List<GroupMember> members = groupMemberRepository.findByIdGroupId(groupId);
        Set<String> memberUsernames = members.stream()
                .map(m -> m.getUser().getUsername())
                .collect(Collectors.toSet());

        //  Lấy danh sách thiết bị ĐANG CÓ NGƯỜI NGỒI trong Room đó
        List<Device> activeDevices = deviceRepository.findByRoom_Id(roomId)
                .stream()
                .filter(d -> d.isActive() && d.getCurrentUser() != null)
                .collect(Collectors.toList());

        //  Phân loại
        List<Map<String, String>> presentMembers = new ArrayList<>();
        List<String> absentMembers = new ArrayList<>(memberUsernames);
        List<Map<String, String>> strangers = new ArrayList<>();

        for (Device device : activeDevices) {
            String loggedInUser = device.getCurrentUser();

            Map<String, String> info = new HashMap<>();
            info.put("username", loggedInUser);
            info.put("macAddress", device.getMacAddress());
            info.put("seat", "Tọa độ: " + device.getXPosition() + "," + device.getYPosition());

            if (memberUsernames.contains(loggedInUser)) {
                presentMembers.add(info);
                absentMembers.remove(loggedInUser); // Xóa khỏi danh sách vắng
            } else {
                strangers.add(info); // người lạ
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("presentMembers", presentMembers);
        result.put("absentMembers", absentMembers);
        result.put("strangers", strangers);

        return ResponseEntity.ok(result);
    }


}
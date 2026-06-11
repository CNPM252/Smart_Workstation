package com.hcmut.backend.controller;

import com.hcmut.backend.model.UserConfig;
import com.hcmut.backend.service.UserConfigService;


import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/workstations")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class UserConfigController {

    @Autowired
    private UserConfigService userConfigService;

    @GetMapping("/{user}/config")
    public ResponseEntity<UserConfig> getConfig(@PathVariable String user){
        if (user.startsWith("guest_")){
            return ResponseEntity.ok(userConfigService.getGuestConfig(user));
        }

        UserConfig config = userConfigService.getUserConfig(user);
        return ResponseEntity.ok(config);
    }

    @PutMapping("{user}/config")
    public ResponseEntity<UserConfig> updateConfig(
            @PathVariable String user,
            @RequestBody UserConfig config){
        if (user.startsWith("guest_")){
            return ResponseEntity.ok(userConfigService.updateGuestConfig(user, config));
        }

        UserConfig updateConfig = userConfigService.updateUserConfig(user, config);
        return ResponseEntity.ok(updateConfig);
    }

}

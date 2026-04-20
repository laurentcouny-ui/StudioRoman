package com.scriptor.api.modules.user;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/user")
public class UserDataRightsController {

    private final UserDataRightsService userDataRightsService;

    public UserDataRightsController(UserDataRightsService userDataRightsService) {
        this.userDataRightsService = userDataRightsService;
    }

    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportUserData() {
        String fileName = "studio-roman-user-export-" + LocalDate.now() + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(userDataRightsService.exportUserData());
    }

    @DeleteMapping("/me")
    public ResponseEntity<Map<String, Object>> deleteUserData() {
        return ResponseEntity.ok(userDataRightsService.deleteLocalUserData());
    }
}

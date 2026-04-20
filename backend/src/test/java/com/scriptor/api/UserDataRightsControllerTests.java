package com.scriptor.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class UserDataRightsControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void exportEndpoint_shouldReturnJsonAttachment() throws Exception {
        mockMvc.perform(get("/api/v1/user/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment; filename=\"studio-roman-user-export-")))
                .andExpect(jsonPath("$.context").value("desktop-local-first"))
                .andExpect(jsonPath("$.counts").exists());
    }

    @Test
    void deleteEndpoint_shouldReturnDeletionSummary() throws Exception {
        mockMvc.perform(delete("/api/v1/user/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true))
                .andExpect(jsonPath("$.deletedCounts").exists());
    }
}

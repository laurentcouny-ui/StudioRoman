package com.scriptor.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "scriptor.api.rate-limit.enabled=true",
        "scriptor.api.rate-limit.max-requests=5",
        "scriptor.api.rate-limit.window-seconds=60",
        "scriptor.api.rate-limit.heavy.max-requests=4",
        "scriptor.api.rate-limit.heavy.window-seconds=60",
        "scriptor.api.rate-limit.heavy.prefixes=/api/v1/ia/analysis",
        "scriptor.api.rate-limit.very-heavy.max-requests=2",
        "scriptor.api.rate-limit.very-heavy.window-seconds=60",
        "scriptor.api.rate-limit.very-heavy.prefixes=/api/v1/ia/summary"
})
class ApiRateLimitFilterTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void shouldReturn429WhenHeavyRateLimitExceeded() throws Exception {
        String payload = "{}";

        mockMvc.perform(post("/api/v1/ia/summary/chapter")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("X-RateLimit-Bucket", "very-heavy"))
                .andExpect(header().string("X-RateLimit-Limit", "2"));

        mockMvc.perform(post("/api/v1/ia/summary/chapter")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("X-RateLimit-Bucket", "very-heavy"));

        mockMvc.perform(post("/api/v1/ia/summary/chapter")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("X-RateLimit-Bucket", "very-heavy"))
                .andExpect(header().string("X-RateLimit-Remaining", "0"))
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void shouldUseSeparateBucketForAnalysisHeavyEndpoints() throws Exception {
        String payload = "{}";

        mockMvc.perform(post("/api/v1/ia/analysis/narrative")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("X-RateLimit-Bucket", "heavy"))
                .andExpect(header().string("X-RateLimit-Limit", "4"));

        mockMvc.perform(post("/api/v1/ia/analysis/narrative")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/ia/analysis/narrative")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/ia/analysis/narrative")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/ia/analysis/narrative")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("X-RateLimit-Bucket", "heavy"))
                .andExpect(header().string("X-RateLimit-Remaining", "0"));
    }
}

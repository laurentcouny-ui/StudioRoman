package com.scriptor.api.modules.universe;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ProjectUniverseSyncRequest {

    private List<CharacterDto> characters = new ArrayList<>();
    private List<BibleEntryDto> bibleEntries = new ArrayList<>();
    private List<TimelineEventDto> timelineEvents = new ArrayList<>();

    @Data
    public static class CharacterDto {
        private String scriptorId;
        private String nom;
        private String role;
        private String description;
        private String statut;
    }

    @Data
    public static class BibleEntryDto {
        private String fiche;
        private String section;
        private Integer paragraphe;
        private String contenu;
    }

    @Data
    public static class TimelineEventDto {
        private String title;
        private String dateLabel;
        private String description;
    }
}

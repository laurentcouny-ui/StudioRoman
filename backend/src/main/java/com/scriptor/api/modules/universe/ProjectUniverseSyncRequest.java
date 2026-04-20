package com.scriptor.api.modules.universe;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ProjectUniverseSyncRequest {

    @Valid
    @Size(max = 2_000, message = "characters dépasse le nombre maximal autorisé")
    private List<CharacterDto> characters = new ArrayList<>();
    @Valid
    @Size(max = 5_000, message = "bibleEntries dépasse le nombre maximal autorisé")
    private List<BibleEntryDto> bibleEntries = new ArrayList<>();
    @Valid
    @Size(max = 5_000, message = "timelineEvents dépasse le nombre maximal autorisé")
    private List<TimelineEventDto> timelineEvents = new ArrayList<>();

    @Data
    public static class CharacterDto {
        @Size(max = 120, message = "scriptorId dépasse la taille maximale autorisée")
        private String scriptorId;
        @Size(max = 180, message = "nom dépasse la taille maximale autorisée")
        private String nom;
        @Size(max = 120, message = "role dépasse la taille maximale autorisée")
        private String role;
        @Size(max = 10_000, message = "description dépasse la taille maximale autorisée")
        private String description;
        @Size(max = 120, message = "statut dépasse la taille maximale autorisée")
        private String statut;
    }

    @Data
    public static class BibleEntryDto {
        @Size(max = 180, message = "fiche dépasse la taille maximale autorisée")
        private String fiche;
        @Size(max = 180, message = "section dépasse la taille maximale autorisée")
        private String section;
        private Integer paragraphe;
        @Size(max = 20_000, message = "contenu dépasse la taille maximale autorisée")
        private String contenu;
    }

    @Data
    public static class TimelineEventDto {
        @Size(max = 220, message = "title dépasse la taille maximale autorisée")
        private String title;
        @Size(max = 120, message = "dateLabel dépasse la taille maximale autorisée")
        private String dateLabel;
        @Size(max = 10_000, message = "description dépasse la taille maximale autorisée")
        private String description;
    }
}

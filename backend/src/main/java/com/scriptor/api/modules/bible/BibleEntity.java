package com.scriptor.api.modules.bible;

import jakarta.persistence.*;
import lombok.Data;

/**
 * Entité représentant une entrée de la bible dans la base SQLite.
 */
@Data
@Entity
@Table(name = "bible_entries")
public class BibleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String fiche;
    private String section;
    private int paragraphe;

    @Column(columnDefinition = "TEXT")
    private String contenu;
}

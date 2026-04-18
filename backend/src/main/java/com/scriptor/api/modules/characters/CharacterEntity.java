package com.scriptor.api.modules.characters;

import jakarta.persistence.*;
import lombok.Data;

/**
 * Entité représentant un personnage dans la base SQLite.
 */
@Data
@Entity
@Table(name = "characters")
public class CharacterEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nom;
    private String role;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    private String statut;
}

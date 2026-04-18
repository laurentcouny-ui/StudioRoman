package com.scriptor.api.modules.characters;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Interface gérant toutes les opérations (CRUD) en base de données pour les personnages.
 */
@Repository
public interface CharacterRepository extends JpaRepository<CharacterEntity, Long> {

    @Query("SELECT c FROM CharacterEntity c WHERE "
            + "LOWER(c.nom) LIKE LOWER(CONCAT('%', :kw, '%')) OR "
            + "LOWER(COALESCE(c.description,'')) LIKE LOWER(CONCAT('%', :kw, '%')) OR "
            + "LOWER(COALESCE(c.role,'')) LIKE LOWER(CONCAT('%', :kw, '%')) OR "
            + "LOWER(COALESCE(c.statut,'')) LIKE LOWER(CONCAT('%', :kw, '%'))")
    List<CharacterEntity> searchByKeyword(@Param("kw") String keyword);
}

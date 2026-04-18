package com.scriptor.api.modules.bible;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Interface gérant toutes les requêtes en base de données pour la bible.
 */
@Repository
public interface BibleRepository extends JpaRepository<BibleEntity, Long> {
    // Recherche insensible à la casse dans le contenu de la bible
    List<BibleEntity> findByContenuContainingIgnoreCase(String keyword);

    @Modifying
    @Query("DELETE FROM BibleEntity b WHERE b.fiche <> :keep")
    void deleteAllExceptFiche(@Param("keep") String keep);
}

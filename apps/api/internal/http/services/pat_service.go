package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"time"

	dbpkg "github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/google/uuid"
)

// GeneratePAT creates a new Personal Access Token for a user.
// Returns the raw token (to show to user once) and the saved model.
func GeneratePAT(userID uuid.UUID, name string, expiresAt *time.Time) (string, *models.PersonalToken, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", nil, err
	}
	
	rawToken := "icd_pat_" + hex.EncodeToString(bytes)
	
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])

	pat := &models.PersonalToken{
		Name:      name,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		UserID:    userID,
	}

	if err := dbpkg.DB.Create(pat).Error; err != nil {
		return "", nil, err
	}

	return rawToken, pat, nil
}

func ListPATs(userID uuid.UUID) ([]models.PersonalToken, error) {
	var pats []models.PersonalToken
	if err := dbpkg.DB.Where("user_id = ?", userID).Find(&pats).Error; err != nil {
		return nil, err
	}
	return pats, nil
}

func RevokePAT(userID uuid.UUID, tokenID uuid.UUID) error {
	return dbpkg.DB.Where("user_id = ? AND id = ?", userID, tokenID).Delete(&models.PersonalToken{}).Error
}

func ValidatePAT(rawToken string) (*models.User, error) {
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])

	var pat models.PersonalToken
	if err := dbpkg.DB.Where("token_hash = ?", tokenHash).First(&pat).Error; err != nil {
		return nil, err // not found or error
	}

	if pat.ExpiresAt != nil && pat.ExpiresAt.Before(time.Now()) {
		// Token expired
		return nil, nil // Or return a specific error
	}

	// Update last used at
	now := time.Now()
	dbpkg.DB.Model(&pat).Update("last_used_at", &now)

	var user models.User
	if err := dbpkg.DB.First(&user, pat.UserID).Error; err != nil {
		return nil, err
	}

	return &user, nil
}

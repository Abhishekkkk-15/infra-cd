package services

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var getJwtSecret = func() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Use a fallback secret for local dev if none is provided
		return []byte("infra-cd-super-secret-key-12345")
	}
	return []byte(secret)
}

// InitAuth seeds a default administrator user if no users exist.
func InitAuth() error {
	var count int64
	db.DB.Model(&models.User{}).Count(&count)
	if count == 0 {
		fmt.Println("No users found. Seeding default admin user: admin@infra-cd.dev")
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin-password"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		admin := models.User{
			Name:     "Admin",
			Email:    "admin@infra-cd.dev",
			Password: string(hashedPassword),
		}
		if err := db.DB.Create(&admin).Error; err != nil {
			return err
		}
	}
	return nil
}

// Login verifies credentials and returns a JWT token.
func Login(email, password string) (string, *models.User, error) {
	var user models.User
	if err := db.DB.Where("email = ?", email).First(&user).Error; err != nil {
		return "", nil, errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", nil, errors.New("invalid credentials")
	}

	// Generate JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"exp":   time.Now().Add(time.Hour * 72).Unix(),
	})

	tokenString, err := token.SignedString(getJwtSecret())
	if err != nil {
		return "", nil, err
	}

	return tokenString, &user, nil
}

// Register creates a new user, hashes the password, and returns a JWT token.
func Register(name, email, password string) (string, *models.User, error) {
	var count int64
	if err := db.DB.Model(&models.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return "", nil, errors.New("database error")
	}
	if count > 0 {
		return "", nil, errors.New("email already in use")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", nil, errors.New("failed to hash password")
	}

	user := models.User{
		Name:     name,
		Email:    email,
		Password: string(hashedPassword),
	}

	if err := db.DB.Create(&user).Error; err != nil {
		return "", nil, errors.New("failed to create user")
	}

	// Generate JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"exp":   time.Now().Add(time.Hour * 72).Unix(),
	})

	tokenString, err := token.SignedString(getJwtSecret())
	if err != nil {
		return "", nil, err
	}

	return tokenString, &user, nil
}

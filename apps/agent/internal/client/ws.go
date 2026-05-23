package client

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

type WSClient struct {
	baseURL string
	agentID string
	token   string

	conn        *websocket.Conn
	mu          sync.Mutex
	sendChannel chan WSMessage

	OnDeploymentTriggered func(deploymentID string)
}

func NewWSClient(baseURL, agentID, token string) *WSClient {
	// Convert http:// to ws:// and https:// to wss://
	wsURL := strings.Replace(baseURL, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)

	wc := &WSClient{
		baseURL:     wsURL,
		agentID:     agentID,
		token:       token,
		sendChannel: make(chan WSMessage, 256), // buffer to prevent blocking
	}
	go wc.writePump() // Start write pump exactly once
	return wc
}

func (wc *WSClient) Connect() error {
	u, err := url.Parse(fmt.Sprintf("%s/api/v1/agents/%s/ws", wc.baseURL, wc.agentID))
	if err != nil {
		return err
	}

	header := http.Header{}
	header.Add("Authorization", "Bearer "+wc.token)

	conn, resp, err := websocket.DefaultDialer.Dial(u.String(), header)
	if err != nil {
		if resp != nil && resp.StatusCode == 401 {
			return ErrInvalidToken
		}
		return fmt.Errorf("websocket dial failed: %v", err)
	}

	wc.mu.Lock()
	wc.conn = conn
	wc.mu.Unlock()

	slog.Info("Connected to server via WebSocket")

	go wc.readPump()
	// writePump is already running in background

	return nil
}

// ConnectWithRetry connects and retries with exponential backoff on failure
func (wc *WSClient) ConnectWithRetry() {
	backoff := 1 * time.Second
	maxBackoff := 30 * time.Second

	for {
		err := wc.Connect()
		if err == nil {
			return
		}

		if err == ErrInvalidToken {
			slog.Error("Fatal: Invalid agent token. Stopping agent.")
			// Let it exit or handle cleanly if needed
			panic(err)
		}

		slog.Warn("Failed to connect WebSocket, retrying...", "error", err, "backoff", backoff)
		time.Sleep(backoff)
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}
}

func (wc *WSClient) Push(msg WSMessage) {
	// Non-blocking push, if the channel is full it drops the message
	// To prevent dropped logs, we could make it blocking, but that risks locking the runner.
	select {
	case wc.sendChannel <- msg:
	default:
		slog.Warn("WebSocket send channel full, dropped message", "type", msg.Type)
	}
}

func (wc *WSClient) readPump() {
	defer func() {
		wc.mu.Lock()
		if wc.conn != nil {
			wc.conn.Close()
			wc.conn = nil
		}
		wc.mu.Unlock()
		slog.Warn("WebSocket readPump disconnected, attempting to reconnect...")
		go wc.ConnectWithRetry()
	}()

	for {
		wc.mu.Lock()
		conn := wc.conn
		wc.mu.Unlock()
		if conn == nil {
			return
		}

		_, messageData, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var msg WSMessage
		if err := json.Unmarshal(messageData, &msg); err != nil {
			slog.Error("Failed to decode websocket message", "error", err)
			continue
		}

		if msg.Type == "new_deployment" && wc.OnDeploymentTriggered != nil {
			// Extract deployment ID if available
			var payload map[string]string
			payloadBytes, _ := json.Marshal(msg.Payload)
			_ = json.Unmarshal(payloadBytes, &payload)
			
			// Trigger callback asynchronously
			go wc.OnDeploymentTriggered(payload["deployment_id"])
		}
	}
}

func (wc *WSClient) writePump() {
	for msg := range wc.sendChannel {
		wc.mu.Lock()
		conn := wc.conn
		wc.mu.Unlock()

		if conn == nil {
			// Dropped message if disconnected, 
			// robust implementation would buffer these and resend
			slog.Warn("WebSocket disconnected, dropped message", "type", msg.Type)
			continue
		}

		if err := conn.WriteJSON(msg); err != nil {
			slog.Error("WebSocket write failed", "error", err)
			conn.Close()
			// Don't return! Just drop the message and keep looping. 
			// readPump will handle the reconnect.
			continue
		}
	}
}

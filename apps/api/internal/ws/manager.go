package ws

import (
	"log/slog"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// Message is the standard JSON structure sent over the WebSocket.
type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// Manager tracks active WebSocket connections by Agent ID.
type Manager struct {
	sync.RWMutex
	connections map[uuid.UUID]*websocket.Conn
}

// Global instance of the WebSocket manager.
var DefaultManager = &Manager{
	connections: make(map[uuid.UUID]*websocket.Conn),
}

// Register adds a new connection for an agent, replacing any existing one.
func (m *Manager) Register(agentID uuid.UUID, conn *websocket.Conn) {
	m.Lock()
	defer m.Unlock()

	// If there's an existing connection, close it to prevent zombies
	if oldConn, exists := m.connections[agentID]; exists {
		slog.Warn("Closing old websocket connection for agent", "agent_id", agentID)
		_ = oldConn.Close()
	}

	m.connections[agentID] = conn
	slog.Info("Agent websocket connected", "agent_id", agentID)
}

// Unregister removes the connection for an agent.
func (m *Manager) Unregister(agentID uuid.UUID) {
	m.Lock()
	defer m.Unlock()
	if conn, exists := m.connections[agentID]; exists {
		_ = conn.Close()
		delete(m.connections, agentID)
		slog.Info("Agent websocket disconnected", "agent_id", agentID)
	}
}

// PushToAgent sends a message to a specific agent if they are connected.
func (m *Manager) PushToAgent(agentID uuid.UUID, msg Message) error {
	m.RLock()
	conn, exists := m.connections[agentID]
	m.RUnlock()

	if !exists {
		// Agent isn't currently connected, they will fetch pending on reconnect
		slog.Debug("Agent not connected, cannot push message", "agent_id", agentID, "msg_type", msg.Type)
		return nil
	}

	err := conn.WriteJSON(msg)
	if err != nil {
		slog.Error("Failed to push message to agent", "agent_id", agentID, "error", err)
		// We could Unregister here, but the readPump typically handles cleanup
		return err
	}

	slog.Debug("Pushed message to agent", "agent_id", agentID, "msg_type", msg.Type)
	return nil
}

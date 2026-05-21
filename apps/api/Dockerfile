FROM golang:1.22-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY apps/api ./apps/api
RUN cd apps/api && CGO_ENABLED=0 GOOS=linux go build -o /api-server ./cmd/infra-cd

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /api-server .
EXPOSE 8080
CMD ["./api-server"]

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	pb "golang_express_grpc/user"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gofiber/fiber/v2"
)

const (
	serverAddr     = "localhost:50051"
	httpPort       = ":5000"
	laravelBaseURL = "https://goldfish-saving-separately.ngrok-free.app/api" 
)

func grpcToRestHandler(c *fiber.Ctx) error {
	switch c.Method() {
	case fiber.MethodGet:
		return handleGetRequest(c)
	case fiber.MethodPost:
		return handlePostRequest(c)
	case fiber.MethodPatch:
		return handlePatchRequest(c)
	default:
		return c.Status(fiber.StatusMethodNotAllowed).SendString("Method not allowed")
	}
}

func handleGetRequest(c *fiber.Ctx) error {
	switch c.Route().Path {
	case "/user/:id":
		return getUserHandler(c)
	case "/users":
		return getAllUserHandler(c)
	case "/checkEmail/:email":
		return getUserByEmailHandler(c)
	case "/avatars":
		return getAvatarHandler(c)
	case "/questions":
		return getQuestionsHandler(c)
	default:
		return c.Status(fiber.StatusMethodNotAllowed).SendString("Method not allowed")
	}
}

func handlePostRequest(c *fiber.Ctx) error {
	switch c.Route().Path {
	case "/user":
		return createUserHandler(c)
	default:
		return c.Status(fiber.StatusMethodNotAllowed).SendString("Method not allowed")
	}
}

func handlePatchRequest(c *fiber.Ctx) error {
	switch c.Route().Path {
	case "/user":
		return updateUserHandler(c)
	default:
		return c.Status(fiber.StatusMethodNotAllowed).SendString("Method not allowed")
	}
}


func getUserHandler(c *fiber.Ctx) error {
	userID := c.Params("id")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).SendString("User ID is required")
	}

	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Could not connect: %v", err))
	}
	defer conn.Close()

	client := pb.NewUserServiceClient(conn)

	req := &pb.UserRequest{Id: userID}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	user, err := client.GetUser(ctx, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error getting user: %v", err))
	}

	return c.JSON(user)
}

func getAllUserHandler(c *fiber.Ctx) error {
	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Could not connect: %v", err))
	}
	defer conn.Close()

	client := pb.NewUserServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	emptyReq := &pb.GetAllUserRequest{}
	allUsersResponse, err := client.GetAllUser(ctx, emptyReq)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error getting all users: %v", err))
	}

	var users []map[string]interface{}
	for _, user := range allUsersResponse.Data {
		userMap := map[string]interface{}{
			"id":      user.Id,
			"username": user.Username,
			"email":    user.Email,
			"avatar":   user.Avatar,
		}
		users = append(users, userMap)
	}

	return c.JSON(fiber.Map{"message": "success", "user": users})
}

func createUserHandler(c *fiber.Ctx) error {
	var newUser pb.CreateUserRequest
	if err := c.BodyParser(&newUser); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(fmt.Sprintf("Error parsing request body: %v", err))
	}

	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Could not connect: %v", err))
	}
	defer conn.Close()

	client := pb.NewUserServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	response, err := client.CreateUser(ctx, &newUser)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error creating user: %v", err))
	}

	createUserResponse, err := json.Marshal(response)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error marshalling response: %v", err))
	}

	return c.JSON(fiber.Map{"message": "success", "data": createUserResponse})
}

func updateUserHandler(c *fiber.Ctx) error {
	var newUser pb.UpdateUserRequest
	if err := c.BodyParser(&newUser); err != nil {
		return c.Status(fiber.StatusBadRequest).SendString(fmt.Sprintf("Error parsing request body: %v", err))
	}

	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Could not connect: %v", err))
	}
	defer conn.Close()

	client := pb.NewUserServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	response, err := client.UpdateUser(ctx, &newUser)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error update user: %v", err))
	}

	updateUserResponse, err := json.Marshal(response)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error marshalling response: %v", err))
	}

	return c.JSON(fiber.Map{"message": "success", "data": updateUserResponse})
}

func getUserByEmailHandler(c *fiber.Ctx) error {
	userEmail := c.Params("email")
	if userEmail == "" {
		return c.Status(fiber.StatusBadRequest).SendString("User email is required")
	}

	conn, err := grpc.Dial(serverAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Could not connect: %v", err))
	}
	defer conn.Close()

	client := pb.NewUserServiceClient(conn)

	req := &pb.UserEmailRequest{Email: userEmail}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	user, err := client.GetUserByEmail(ctx, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error getting user by email: %v", err))
	}
	
	return c.JSON(user)
}


func getAvatarHandler(c *fiber.Ctx) error {
	avatarURL := fmt.Sprintf("%s/avatars?timestamp=%d", laravelBaseURL, time.Now().Unix())

	resp, err := http.Get(avatarURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error getting avatars: %v", err))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error getting avatars: %s", resp.Status))
	}

	var avatarsData interface{}
	if err := json.NewDecoder(resp.Body).Decode(&avatarsData); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error decoding avatars data: %v", err))
	}

	return c.JSON(avatarsData)
}

func getQuestionsHandler(c *fiber.Ctx) error {
	questionsURL := fmt.Sprintf("%s/questions?timestamp=%d", laravelBaseURL, time.Now().Unix())

	resp, err := http.Get(questionsURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error getting questions: %v", err))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error getting questions: %s", resp.Status))
	}

	var questionsData interface{}
	if err := json.NewDecoder(resp.Body).Decode(&questionsData); err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString(fmt.Sprintf("Error decoding questions data: %v", err))
	}

	return c.JSON(questionsData)
}



func main() {
	app := fiber.New()

	app.Post("/user", grpcToRestHandler)
	app.Patch("/user", grpcToRestHandler)
	app.Get("/user/:id", grpcToRestHandler)
	app.Get("/checkEmail/:email", grpcToRestHandler)
	app.Get("/avatars", grpcToRestHandler)
	app.Get("/questions", grpcToRestHandler)
	app.Get("/users", grpcToRestHandler)



	fmt.Printf("REST API Server listening on port %s...\n", httpPort)
	log.Fatal(app.Listen(httpPort))
}



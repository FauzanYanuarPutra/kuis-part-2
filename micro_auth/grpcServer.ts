import * as grpc from "@grpc/grpc-js";
import { userProto, userService } from './services/user'

const server = new grpc.Server();

const serverAddress = "127.0.0.1:50051";

server.addService(userProto.UserService.service, {
  GetUser: userService.GetUser,
  CreateUser: userService.CreateUser,
  GetUserByEmail: userService.GetUserByEmail,
  GetAllUser: userService.GetAllUser,
  UpdateUser: userService.UpdateUser
});

export const startGRPCServer = () => {
  server.bindAsync(
    serverAddress,
    grpc.ServerCredentials.createInsecure(),
    (err: Error | null, port: number) => {
      if (err) {
        console.error(`Error binding server: ${err}`);
      } else {
        server.start();
        console.log(`gRPC Server is running on ${serverAddress}`);
      }
    }
  );
};












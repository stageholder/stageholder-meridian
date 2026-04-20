import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TodoModel, TodoSchema } from "./todo.schema";
import { TodoRepository } from "./todo.repository";
import { TodoService } from "./todo.service";
import { TodoController } from "./todo.controller";
import { LightModule } from "../light/light.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TodoModel.name, schema: TodoSchema }]),
    LightModule,
  ],
  controllers: [TodoController],
  providers: [TodoRepository, TodoService],
  exports: [TodoService, TodoRepository],
})
export class TodoModule {}

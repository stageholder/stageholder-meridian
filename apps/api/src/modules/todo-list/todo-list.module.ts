import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TodoListModel, TodoListSchema } from "./todo-list.schema";
import { TodoListRepository } from "./todo-list.repository";
import { TodoListService } from "./todo-list.service";
import { TodoListController } from "./todo-list.controller";
import { TodoModule } from "../todo/todo.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TodoListModel.name, schema: TodoListSchema },
    ]),
    TodoModule,
  ],
  controllers: [TodoListController],
  providers: [TodoListRepository, TodoListService],
  exports: [TodoListService],
})
export class TodoListModule {}

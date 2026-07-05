import { Module, forwardRef } from "@nestjs/common";
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
    // forwardRef: TodoModule imports this module back (TodoService → list
    // ownership validation), so the two form an intentional cycle.
    forwardRef(() => TodoModule),
  ],
  controllers: [TodoListController],
  providers: [TodoListRepository, TodoListService],
  // Export the repository so TodoService can validate a todo's target list.
  exports: [TodoListService, TodoListRepository],
})
export class TodoListModule {}

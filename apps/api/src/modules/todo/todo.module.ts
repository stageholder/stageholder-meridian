import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TodoModel, TodoSchema } from "./todo.schema";
import { TodoRepository } from "./todo.repository";
import { TodoService } from "./todo.service";
import { TodoController } from "./todo.controller";
import { LightModule } from "../light/light.module";
import { TodoListModule } from "../todo-list/todo-list.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TodoModel.name, schema: TodoSchema }]),
    LightModule,
    // Bidirectional: TodoService validates a todo's target list via
    // TodoListRepository; TodoListModule imports TodoModule for its cascade.
    forwardRef(() => TodoListModule),
  ],
  controllers: [TodoController],
  providers: [TodoRepository, TodoService],
  exports: [TodoService, TodoRepository],
})
export class TodoModule {}

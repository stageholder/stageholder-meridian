// Barrel for the `todos` domain — presentational todo views.
// The host (PWA today, mobile later) hooks the data layer + supplies the
// nav/mutation callbacks.

export { TodoItem, type TodoItemProps } from "./todo-item";

export {
  TodoListForm,
  TODO_LIST_FORM_DEFAULTS,
  TODO_LIST_COLOR_OPTIONS,
  type TodoListFormProps,
  type TodoListFormValues,
} from "./todo-list-form";

export {
  TodoForm,
  makeTodoFormDefaults,
  type TodoFormProps,
  type TodoFormValues,
  type TodoListChoice,
} from "./todo-form";

// Barrel for the `todos` domain — presentational todo views.
// The host (PWA today, mobile later) hooks the data layer + supplies the
// nav/mutation callbacks.

export { TodoItem, type TodoItemProps } from "./todo-item";

export { TodoListSkeleton } from "./todo-list-skeleton";

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

// Cross-platform smart quick-add field (web overlay pills / native chips) —
// resolves `.tsx` on web and `.native.tsx` on RN via the bundler.
export { SmartTodoInput } from "./smart-todo-input";
export type {
  SmartTodoInputHandle,
  SmartTodoInputProps,
  SmartListOption,
} from "./smart-todo-input.types";

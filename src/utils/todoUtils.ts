import type { TodoItem, AppState } from "../types/TodoItem";
import { CompletionTier } from "../types/TodoItem";

export const calculateHpForTier = (
  todo: TodoItem,
  tier: CompletionTier
): number => {
  switch (tier) {
    case CompletionTier.UNSELECTED:
      return 0; // Unselected tasks don't contribute to HP
    case CompletionTier.NONE:
      return todo.hpValues.none;
    case CompletionTier.MINIMUM:
      return todo.hpValues.minimum || 0;
    case CompletionTier.FULL:
      return todo.hpValues.full;
    case CompletionTier.BONUS:
      return todo.hpValues.bonus || 0;
  }
};

// Helper function to get the current "day" based on 6 AM reset schedule
const getCurrentDay = (): Date => {
  const now = new Date();
  const today = new Date(now);

  // If it's before 6 AM, we're still in "yesterday's" day
  if (now.getHours() < 6) {
    today.setDate(today.getDate() - 1);
  }

  // Set to 6 AM for consistent comparison
  today.setHours(6, 0, 0, 0);
  return today;
};

export const isTaskRequiredToday = (todo: TodoItem): boolean => {
  const today = getCurrentDay();
  return isTaskRequiredOnDate(todo, today);
};

// Helper function to check if a task was required on a specific date
export const isTaskRequiredOnDate = (todo: TodoItem, date: Date): boolean => {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayOfMonth = date.getDate(); // 1-31

  switch (todo.recurrence.type) {
    case "daily":
      return true;
    case "weekly":
      return todo.recurrence.daysOfWeek?.includes(dayOfWeek) ?? false;
    case "monthly":
      return todo.recurrence.daysOfMonth?.includes(dayOfMonth) ?? false;
    default:
      return false;
  }
};

export const updateTodoCompletion = (
  todos: TodoItem[],
  id: string,
  tier: CompletionTier
): TodoItem[] => {
  const today = getCurrentDay();

  return todos.map((todo) =>
    todo.id === id
      ? {
          ...todo,
          completionTier: tier,
          history: [
            ...todo.history.filter(
              (entry) => entry.date.getTime() !== today.getTime()
            ), // Remove today's entry if exists
            { date: new Date(today), tier }, // Add new entry for today
          ],
        }
      : todo
  );
};

export const calculateDailyHpChange = (
  todos: TodoItem[],
  date?: Date
): number => {
  const targetDate = date || getCurrentDay();
  return todos.reduce((total, todo) => {
    if (!isTaskRequiredOnDate(todo, targetDate)) return total;
    // Treat unselected tasks as none for HP calculation
    const effectiveTier =
      todo.completionTier === CompletionTier.UNSELECTED
        ? CompletionTier.NONE
        : todo.completionTier;
    return total + calculateHpForTier(todo, effectiveTier);
  }, 0);
};

export const calculateDailyHpChangePreview = (
  todos: TodoItem[],
  date?: Date
): number => {
  const targetDate = date || getCurrentDay();
  return todos.reduce((total, todo) => {
    if (!isTaskRequiredOnDate(todo, targetDate)) return total;
    // Show actual HP values for preview (unselected shows 0)
    return total + calculateHpForTier(todo, todo.completionTier);
  }, 0);
};

export const shouldResetTasks = (lastResetDate: Date): boolean => {
  const now = new Date();
  const lastReset = new Date(lastResetDate);

  // Set last reset to 6 AM
  lastReset.setHours(6, 0, 0, 0);

  // Check if 24 hours have passed since last reset at 6 AM
  const twentyFourHoursLater = new Date(lastReset);
  twentyFourHoursLater.setHours(twentyFourHoursLater.getHours() + 24);

  return now.getTime() >= twentyFourHoursLater.getTime();
};

export const resetDailyTodos = (todos: TodoItem[]): TodoItem[] => {
  const today = getCurrentDay();
  return todos.map((todo) => ({
    ...todo,
    completionTier: CompletionTier.UNSELECTED,
    history: [
      ...todo.history.filter(
        (entry) => entry.date.getTime() !== today.getTime()
      ), // Remove today's entry if exists
      { date: new Date(today), tier: CompletionTier.UNSELECTED }, // Add new entry for today
    ],
  }));
};

export const incrementResetDate = (lastResetDate: Date): Date => {
  const newDate = new Date(lastResetDate);
  newDate.setDate(newDate.getDate() + 1);
  return newDate;
};

export const loadAppState = (): AppState | null => {
  try {
    const saved = localStorage.getItem("life-coach-app-state");
    if (!saved) return null;

    const parsed = JSON.parse(saved);

    // Convert date strings back to Date objects
    parsed.lastResetDate = new Date(parsed.lastResetDate);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsed.todos = parsed.todos.map((todo: any) => ({
      ...todo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      history: todo.history.map((entry: any) => ({
        ...entry,
        date: new Date(entry.date),
      })),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsed.hpHistory = parsed.hpHistory.map((entry: any) => ({
      ...entry,
      date: new Date(entry.date),
    }));

    console.log("Loaded app state");
    return parsed;
  } catch (error) {
    console.error("Failed to load app state:", error);
    return null;
  }
};

export const saveAppState = (state: AppState): void => {
  try {
    // Convert Date objects to strings for JSON serialization
    const serializable = {
      ...state,
      lastResetDate:
        state.lastResetDate instanceof Date
          ? state.lastResetDate.toISOString()
          : state.lastResetDate,
      todos: state.todos.map((todo) => ({
        ...todo,
        history: todo.history.map((entry) => ({
          ...entry,
          date:
            entry.date instanceof Date ? entry.date.toISOString() : entry.date,
        })),
      })),
      hpHistory: state.hpHistory.map((entry) => ({
        ...entry,
        date:
          entry.date instanceof Date ? entry.date.toISOString() : entry.date,
      })),
    };

    localStorage.setItem("life-coach-app-state", JSON.stringify(serializable));
    console.log("Saved app state");
  } catch (error) {
    console.error("Failed to save app state:", error);
  }
};

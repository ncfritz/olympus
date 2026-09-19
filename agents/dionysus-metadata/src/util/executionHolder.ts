export type ExecutionType = "workflow" | "batch";

export type Execution = {
  type: ExecutionType;
  id: string;
};

const executions: Map<string, Execution> = new Map();

export const getExecutions = () => {
  return Array.from(executions.values());
};

export const addExecution = (execution: Execution): void => {
  executions.set(execution.id, execution);
};

export const removeExecution = (id: string): void => {
  executions.delete(id);
};

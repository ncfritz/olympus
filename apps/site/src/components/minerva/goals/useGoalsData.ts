import type {
  Goal,
  GoalCategory,
  GoalCycle,
  GoalExecution,
  Tag,
} from "@ncfritz/olympus-sdk/minerva";
import { message } from "antd";
import { useCallback, useEffect, useState } from "react";
import goalsApi from "../../../api/goalsApi";
import tagsApi from "../../../api/tagsApi";

export type GoalsData = {
  loading: boolean;
  goals: Goal[];
  categories: GoalCategory[];
  cycles: GoalCycle[];
  tags: Tag[];
  /** This ISO week's execution. */
  execution?: GoalExecution;
  /** Loads everything again, after a change. */
  reload: () => Promise<void>;
};

/**
 * What the goals home draws from: the caller's goals with the statuses
 * asked for, their categories, cycles and tags, and this week's execution.
 */
export const useGoalsData = (statuses: string[]): GoalsData => {
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<GoalCategory[]>([]);
  const [cycles, setCycles] = useState<GoalCycle[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [execution, setExecution] = useState<GoalExecution>();
  const status = statuses.join(",");

  const reload = useCallback(async () => {
    try {
      const [g, c, cy, t, e] = await Promise.all([
        goalsApi.listGoals(status ? { status } : {}),
        goalsApi.listCategories(),
        goalsApi.listCycles(),
        tagsApi.listTags(),
        goalsApi.getExecution(),
      ]);
      setGoals(g);
      setCategories(c);
      setCycles(cy);
      setTags(t);
      setExecution(e);
    } catch {
      message.error("Could not load your goals");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, goals, categories, cycles, tags, execution, reload };
};

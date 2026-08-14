// HOT Tasking Manager mapper levels, keyed off lifetime OSM changeset count.
// Thresholds match the upstream defaults (backend/config.py):
// https://github.com/hotosm/tasking-manager/blob/main/backend/config.py
//   MAPPER_LEVEL_INTERMEDIATE = 250
//   MAPPER_LEVEL_ADVANCED = 500
export const MAPPER_LEVEL_THRESHOLDS = {
  intermediate: 250,
  advanced: 500,
} as const;

export type MapperLevel = "Beginner" | "Intermediate" | "Advanced";

export interface MapperLevelInfo {
  level: MapperLevel;
  changesets: number;
  nextLevel: MapperLevel | null;
  changesetsToNextLevel: number | null; // null once at Advanced (no ceiling)
  progressToNextLevel: number | null;   // 0..1 within the current band; null at Advanced
}

export function getMapperLevelInfo(changesets: number): MapperLevelInfo {
  const { intermediate, advanced } = MAPPER_LEVEL_THRESHOLDS;

  if (changesets < intermediate) {
    return {
      level: "Beginner",
      changesets,
      nextLevel: "Intermediate",
      changesetsToNextLevel: intermediate - changesets,
      progressToNextLevel: changesets / intermediate,
    };
  }

  if (changesets < advanced) {
    return {
      level: "Intermediate",
      changesets,
      nextLevel: "Advanced",
      changesetsToNextLevel: advanced - changesets,
      progressToNextLevel: (changesets - intermediate) / (advanced - intermediate),
    };
  }

  return {
    level: "Advanced",
    changesets,
    nextLevel: null,
    changesetsToNextLevel: null,
    progressToNextLevel: null,
  };
}

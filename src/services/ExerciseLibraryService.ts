/**
 * Exercise Library Service
 * 
 * Retrieves and filters exercises from the exercise library
 * Supports filtering by equipment, injuries, muscle groups, difficulty
 */

import { Exercise } from '../models/PlanModels';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

/**
 * Exercise Filter Criteria
 */
export interface ExerciseFilterCriteria {
  muscleGroups?: string[];
  equipment?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'expert';
  excludeEquipment?: string[]; // Equipment user doesn't have
  excludeInjuries?: string[]; // Injury-related contraindications
  movementType?: 'compound' | 'isolation';
  minExercises?: number; // Minimum number of exercises to return
  maxExercises?: number; // Maximum number of exercises to return
}

/**
 * Exercise Library Service
 */
export class ExerciseLibraryService {
  private library: Exercise[];

  constructor() {
    this.library = [...EXERCISE_LIBRARY];
  }

  /**
   * Get all exercises
   */
  getAllExercises(): Exercise[] {
    return [...this.library];
  }

  /**
   * Filter exercises by criteria
   */
  filterExercises(criteria: ExerciseFilterCriteria): Exercise[] {
    let filtered = [...this.library];

    // Filter by muscle groups
    if (criteria.muscleGroups && criteria.muscleGroups.length > 0) {
      filtered = filtered.filter(exercise =>
        criteria.muscleGroups!.some(group =>
          exercise.muscleGroups.includes(group)
        )
      );
    }

    // Filter by equipment (must have all required equipment)
    if (criteria.equipment && criteria.equipment.length > 0) {
      filtered = filtered.filter(exercise =>
        criteria.equipment!.every(req =>
          exercise.equipment.includes(req)
        )
      );
    }

    // Exclude exercises requiring unavailable equipment
    if (criteria.excludeEquipment && criteria.excludeEquipment.length > 0) {
      filtered = filtered.filter(exercise =>
        !criteria.excludeEquipment!.some(excluded =>
          exercise.equipment.includes(excluded)
        )
      );
    }

    // Exclude exercises with contraindications matching injuries
    if (criteria.excludeInjuries && criteria.excludeInjuries.length > 0) {
      filtered = filtered.filter(exercise =>
        !exercise.contraindications.some(contraindication =>
          criteria.excludeInjuries!.some(injury =>
            contraindication.toLowerCase().includes(injury.toLowerCase()) ||
            injury.toLowerCase().includes(contraindication.toLowerCase())
          )
        )
      );
    }

    // Filter by difficulty
    if (criteria.difficulty) {
      const difficultyOrder = ['beginner', 'intermediate', 'expert'];
      const targetLevel = difficultyOrder.indexOf(criteria.difficulty);
      
      filtered = filtered.filter(exercise => {
        const exerciseLevel = difficultyOrder.indexOf(
          exercise.difficulty as 'beginner' | 'intermediate' | 'expert'
        );
        // Allow exercises at or below target difficulty
        return exerciseLevel <= targetLevel;
      });
    }

    // Filter by movement type
    if (criteria.movementType) {
      filtered = filtered.filter(exercise => {
        // Compound exercises typically target multiple muscle groups
        const isCompound = exercise.muscleGroups.length >= 3;
        return criteria.movementType === 'compound' ? isCompound : !isCompound;
      });
    }

    // Apply min/max limits
    if (criteria.minExercises && filtered.length < criteria.minExercises) {
      // If we don't have enough, try to relax some filters
      // For now, just return what we have
    }

    if (criteria.maxExercises && filtered.length > criteria.maxExercises) {
      // Prioritize compound movements, then by difficulty (easier first)
      filtered = filtered
        .sort((a, b) => {
          const aCompound = a.muscleGroups.length >= 3 ? 1 : 0;
          const bCompound = b.muscleGroups.length >= 3 ? 1 : 0;
          if (aCompound !== bCompound) return bCompound - aCompound;

          const difficultyOrder = ['beginner', 'intermediate', 'expert'];
          const aLevel = difficultyOrder.indexOf(a.difficulty);
          const bLevel = difficultyOrder.indexOf(b.difficulty);
          return aLevel - bLevel;
        })
        .slice(0, criteria.maxExercises);
    }

    return filtered;
  }

  /**
   * Get exercises for specific muscle groups
   */
  getExercisesForMuscleGroups(
    muscleGroups: string[],
    options?: {
      equipment?: string[];
      excludeEquipment?: string[];
      excludeInjuries?: string[];
      difficulty?: 'beginner' | 'intermediate' | 'expert';
      maxExercises?: number;
    }
  ): Exercise[] {
    return this.filterExercises({
      muscleGroups,
      equipment: options?.equipment,
      excludeEquipment: options?.excludeEquipment,
      excludeInjuries: options?.excludeInjuries,
      difficulty: options?.difficulty,
      maxExercises: options?.maxExercises || 5,
    });
  }

  /**
   * Get exercises by equipment availability
   */
  getExercisesByEquipment(
    availableEquipment: string[],
    options?: {
      muscleGroups?: string[];
      excludeInjuries?: string[];
      difficulty?: 'beginner' | 'intermediate' | 'expert';
    }
  ): Exercise[] {
    // Get all equipment user doesn't have
    const allEquipment = new Set<string>();
    this.library.forEach(ex => ex.equipment.forEach(eq => allEquipment.add(eq)));
    const unavailableEquipment = Array.from(allEquipment).filter(
      eq => !availableEquipment.includes(eq)
    );

    return this.filterExercises({
      excludeEquipment: unavailableEquipment,
      muscleGroups: options?.muscleGroups,
      excludeInjuries: options?.excludeInjuries,
      difficulty: options?.difficulty,
    });
  }

  /**
   * Get exercises safe for specific injuries
   */
  getSafeExercises(
    injuries: string[],
    options?: {
      muscleGroups?: string[];
      equipment?: string[];
      excludeEquipment?: string[];
      difficulty?: 'beginner' | 'intermediate' | 'expert';
    }
  ): Exercise[] {
    return this.filterExercises({
      excludeInjuries: injuries,
      muscleGroups: options?.muscleGroups,
      equipment: options?.equipment,
      excludeEquipment: options?.excludeEquipment,
      difficulty: options?.difficulty,
    });
  }

  /**
   * Get exercise by ID
   */
  getExerciseById(exerciseId: string): Exercise | undefined {
    return this.library.find(ex => ex.exerciseId === exerciseId);
  }

  /**
   * Search exercises by name
   */
  searchExercises(query: string): Exercise[] {
    const lowerQuery = query.toLowerCase();
    return this.library.filter(
      exercise =>
        exercise.name.toLowerCase().includes(lowerQuery) ||
        exercise.muscleGroups.some(mg => mg.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get compound exercises (target multiple muscle groups)
   */
  getCompoundExercises(
    options?: {
      muscleGroups?: string[];
      equipment?: string[];
      excludeEquipment?: string[];
      excludeInjuries?: string[];
      difficulty?: 'beginner' | 'intermediate' | 'expert';
    }
  ): Exercise[] {
    return this.filterExercises({
      ...options,
      movementType: 'compound',
    });
  }

  /**
   * Get isolation exercises (target single muscle group)
   */
  getIsolationExercises(
    options?: {
      muscleGroups?: string[];
      equipment?: string[];
      excludeEquipment?: string[];
      excludeInjuries?: string[];
      difficulty?: 'beginner' | 'intermediate' | 'expert';
    }
  ): Exercise[] {
    return this.filterExercises({
      ...options,
      movementType: 'isolation',
    });
  }

  /**
   * Get recommended exercises for user profile
   */
  getRecommendedExercises(
    userProfile: {
      workoutLevel: 'beginner' | 'intermediate' | 'expert';
      equipment: string;
      injuries?: string[];
    },
    targetMuscleGroups: string[]
  ): Exercise[] {
    const availableEquipment = this.parseEquipmentString(
      userProfile.equipment
    );

    return this.filterExercises({
      muscleGroups: targetMuscleGroups,
      difficulty: userProfile.workoutLevel,
      excludeEquipment: this.getUnavailableEquipment(availableEquipment),
      excludeInjuries: userProfile.injuries,
      movementType: 'compound', // Prioritize compound movements
      maxExercises: 8, // 3-5 per muscle group, but we'll get top recommendations
    });
  }

  /**
   * Parse equipment string to array
   */
  private parseEquipmentString(equipment: string): string[] {
    // Common equipment strings and their mappings
    const equipmentMap: Record<string, string[]> = {
      full: [
        'barbell',
        'dumbbells',
        'bench',
        'incline bench',
        'squat rack',
        'pull-up bar',
        'cable machine',
        'leg press machine',
        'leg curl machine',
        'leg extension machine',
      ],
      home: ['dumbbells', 'bodyweight', 'resistance bands'],
      minimal: ['bodyweight'],
      gym: [
        'barbell',
        'dumbbells',
        'bench',
        'cable machine',
        'squat rack',
        'pull-up bar',
      ],
    };

    const lowerEquipment = equipment.toLowerCase();
    
    if (equipmentMap[lowerEquipment]) {
      return equipmentMap[lowerEquipment];
    }

    // Try to parse individual equipment items
    const items: string[] = [];
    const equipmentList = [
      'barbell',
      'dumbbells',
      'bodyweight',
      'cable machine',
      'bench',
      'incline bench',
      'squat rack',
      'pull-up bar',
      'leg press machine',
      'leg curl machine',
      'leg extension machine',
      'parallel bars',
    ];

    equipmentList.forEach(eq => {
      if (lowerEquipment.includes(eq)) {
        items.push(eq);
      }
    });

    return items.length > 0 ? items : ['bodyweight']; // Default to bodyweight
  }

  /**
   * Get unavailable equipment
   */
  private getUnavailableEquipment(availableEquipment: string[]): string[] {
    const allEquipment = new Set<string>();
    this.library.forEach(ex => ex.equipment.forEach(eq => allEquipment.add(eq)));
    return Array.from(allEquipment).filter(
      eq => !availableEquipment.includes(eq)
    );
  }

  /**
   * Get exercise statistics
   */
  getStatistics(): {
    totalExercises: number;
    byMuscleGroup: Record<string, number>;
    byEquipment: Record<string, number>;
    byDifficulty: Record<string, number>;
  } {
    const byMuscleGroup: Record<string, number> = {};
    const byEquipment: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};

    this.library.forEach(exercise => {
      exercise.muscleGroups.forEach(mg => {
        byMuscleGroup[mg] = (byMuscleGroup[mg] || 0) + 1;
      });

      exercise.equipment.forEach(eq => {
        byEquipment[eq] = (byEquipment[eq] || 0) + 1;
      });

      byDifficulty[exercise.difficulty] =
        (byDifficulty[exercise.difficulty] || 0) + 1;
    });

    return {
      totalExercises: this.library.length,
      byMuscleGroup,
      byEquipment,
      byDifficulty,
    };
  }
}


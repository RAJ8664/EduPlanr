/**
 * Grading Utility for EduPlanr
 * Implements standard grading logic:
 * - Letter Grades to Grade Points (AA=10, ..., F=0)
 * - SGPA Calculation
 * - CGPA Calculation
 * - Percentage Conversion
 */

export type LetterGrade =
    | 'AA' | 'AB' | 'BB' | 'BC'
    | 'CC' | 'CD' | 'DD' | 'F'
    | 'W' | 'I' | 'PP' | 'NP' | 'AU';

export const GRADE_POINTS: Record<string, number> = {
    'AA': 10,
    'AB': 9,
    'BB': 8,
    'BC': 7,
    'CC': 6,
    'CD': 5,
    'DD': 4,
    'F': 0,
    'W': 0,
    'I': 0,
};

export interface CourseResult {
    id: string; // Course/Subject ID
    credits: number;
    grade?: LetterGrade; // Optional if gradePoints is provided
    gradePoints?: number; // Direct numeric grade point (0-10)
    includeInGPA: boolean;
}

/**
 * Helper to check if a grade is a passing grade
 */
export const isPassingGrade = (grade: LetterGrade): boolean => {
    const passingGrades: LetterGrade[] = ['AA', 'AB', 'BB', 'BC', 'CC', 'CD', 'DD'];
    return passingGrades.includes(grade);
};

/**
 * Helper to get grade points. 
 */
export const getGradePoints = (grade: LetterGrade): number => {
    return GRADE_POINTS[grade] ?? 0;
};

/**
 * Determines if a course with a given grade should be included in GPA calculations.
 */
export const shouldIncludeInGPA = (grade?: LetterGrade): boolean => {
    if (!grade) return true; // If no letter grade (numeric), assume included unless manually excluded
    const excludedGrades: LetterGrade[] = ['PP', 'NP', 'AU', 'I'];
    return !excludedGrades.includes(grade);
};

/**
 * Calculates SGPA (Semester Grade Point Average)
 * Formula: Σ(Ci × Gi) / ΣCi
 * Rounds to 2 decimal places.
 */
export const calculateSGPA = (courses: CourseResult[]): number => {
    let totalPoints = 0;
    let totalCredits = 0;

    for (const course of courses) {
        // If explicit includeInGPA is false, skip
        if (!course.includeInGPA) continue;

        // Determine grade points: use explicit gradePoints OR lookup from grade
        let gp = 0;
        if (course.gradePoints !== undefined) {
            gp = course.gradePoints;
        } else if (course.grade) {
            if (!shouldIncludeInGPA(course.grade)) continue;
            gp = getGradePoints(course.grade);
        } else {
            // No grade info, skip or treat as zero? 
            // If includeInGPA is true but no points, usually implies 0 (Fail).
            gp = 0;
        }

        totalPoints += course.credits * gp;
        totalCredits += course.credits;
    }

    if (totalCredits === 0) return 0;

    const sgpa = totalPoints / totalCredits;
    return Math.round(sgpa * 100) / 100;
};

/**
 * Calculates CGPA (Cumulative Grade Point Average)
 * Formula: Σ(Cj × GPj) / ΣCj
 * Handles repeated courses by taking the best attempt.
 */
export const calculateCGPA = (allCourses: CourseResult[]): number => {
    // Map to store best grade for each course ID
    const bestAttempts = new Map<string, CourseResult>();

    for (const course of allCourses) {
        if (!course.includeInGPA) continue;

        // Check exclusion by letter grade if present
        if (course.grade && !shouldIncludeInGPA(course.grade)) continue;

        const existing = bestAttempts.get(course.id);

        // Resolve current grade points
        let currentGP = 0;
        if (course.gradePoints !== undefined) currentGP = course.gradePoints;
        else if (course.grade) currentGP = getGradePoints(course.grade);

        if (existing) {
            let existingGP = 0;
            if (existing.gradePoints !== undefined) existingGP = existing.gradePoints;
            else if (existing.grade) existingGP = getGradePoints(existing.grade);

            if (currentGP > existingGP) {
                bestAttempts.set(course.id, course);
            }
        } else {
            bestAttempts.set(course.id, course);
        }
    }

    // Calculate CGPA based on best attempts
    const uniqueCourses = Array.from(bestAttempts.values());
    return calculateSGPA(uniqueCourses);
};

/**
 * Converts SGPA or CGPA to percentage.
 * Formula: value * 10
 */
export const convertGPAToPercentage = (gpa: number): number => {
    return Math.round(gpa * 10 * 100) / 100; // Round to 2 decimals for percentage too
};

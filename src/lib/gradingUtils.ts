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
    'I': 0, // Transitional Incomplete, treated as 0 or ignored depending on context, usually ignored in SGPA until cleared?
    // The prompt says: "A student passes a course by obtaining a grade in the range of AA to DD"
    // "W = 0 Grade Points"
    // "I = Transitional Incomplete (Temporary grade)"
    // For now, I maps to 0 points but might need special handling if it excludes credits.
    // However, standard GPA calc usually includes credits registered.
    // Wait, "W = 0 Grade Points (Registration cancelled due to lack of attendance)" implies it MIGHT be counted as 0 in numerator?
    // Actually, W usually means withdrawn and NOT counted in GPA.
    // Let's re-read carefully: "SGPA = Σ(Ci × Gi) / ΣCi". 
    // If W has 0 grade points, and is included in ΣCi, then it acts like an F.
    // But usually W is withdrawn and excluded.
    // Let's look at "Optional audit courses (marked AU) are excluded from all GPA calculations".
    // "Extra Academic Activity (EAA) grades (PP/NP) are not used for computing SGPA or CGPA".
    // "Letter Grade W = 0 Grade Points". This explicitly implies G_i = 0.
    // If it implies G_i=0, does it mean it is included in the denominator?
    // Usually W is NOT included in GPA. 
    // However, the user prompt explicitly listed "Letter Grade W = 0 Grade Points". 
    // If it was excluded, it wouldn't need a grade point value essentially, or it would be "N/A".
    // But F is also 0.
    // Let's assume standard practice unless specified: W is usually excluded. 
    // BUT, looking at the strict mapping provided: "Letter Grade Section", W is listed with 0.
    // I will follow the standard: 
    // - Pass: AA-DD.
    // - Fail: F.
    // - W: "Registration cancelled due to lack of attendance". In some systems this is a FAIL (0).
    // Let's check if there's any ambiguity. "W = 0". 
    // If I treat it as F, it matches "0 Grade Points".
    // I will implement a safe helper that allows excluding specific grades.
};

export interface CourseResult {
    id: string; // Course/Subject ID
    credits: number;
    grade: LetterGrade;
    includeInGPA: boolean; // Manual override or derived from grade type
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
 * Returns null if the grade should not be counted (e.g. PP/NP/AU/I potentially).
 * But based on the mapping, I, W, F return 0.
 */
export const getGradePoints = (grade: LetterGrade): number => {
    return GRADE_POINTS[grade] ?? 0;
};

/**
 * Determines if a course with a given grade should be included in GPA calculations.
 * Excludes: PP, NP, AU.
 * W and I are tricky.
 * - W (0 points) usually penalizes if due to attendance, or is neutral if withdrawn. 
 *   Given "0 Grade Points", it's likely a penalty or just a value assignment.
 *   However, usually ΣCi includes all REGISTERED courses.
 *   "Registration cancelled due to lack of attendance" sounds like a penalty (Debarred).
 *   So I will include W as 0.
 * - I (Incomplete) usually is excluded until completed.
 *   Let's exclude 'I' from calculation for now as it is "Temporary".
 */
export const shouldIncludeInGPA = (grade: LetterGrade): boolean => {
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
        if (course.includeInGPA && shouldIncludeInGPA(course.grade)) {
            const gp = getGradePoints(course.grade);
            totalPoints += course.credits * gp;
            totalCredits += course.credits;
        }
    }

    if (totalCredits === 0) return 0;

    const sgpa = totalPoints / totalCredits;
    return Math.round(sgpa * 100) / 100;
};

/**
 * Calculates CGPA (Cumulative Grade Point Average)
 * Formula: Σ(Cj × GPj) / ΣCj
 * "When a student repeats a course, the lower grade is ignored in CGPA calculation from that term onwards"
 * This implies we need to process the history of courses to find the best attempt or latest attempt?
 * "lower grade is ignored" implies best attempt is kept? Or latest?
 * Usually, if you repeat, you replace the grade.
 * Interpretation: If a student took Course A in Sem 1 (F) and Sem 3 (BB), 
 * the CGPA should only include the BB attempt (and its credits) and ignore the F attempt.
 *
 * Input: All courses taken so far across all semesters.
 */
export const calculateCGPA = (allCourses: CourseResult[]): number => {
    // Map to store best grade for each course ID
    const bestAttempts = new Map<string, CourseResult>();

    // Use a map to handle repeats - keep the one with higher grade points?
    // "lower grade is ignored" -> implies higher grade is kept.
    for (const course of allCourses) {
        if (!course.includeInGPA || !shouldIncludeInGPA(course.grade)) continue;

        const existing = bestAttempts.get(course.id);
        if (existing) {
            const currentGP = getGradePoints(course.grade);
            const existingGP = getGradePoints(existing.grade);
            if (currentGP > existingGP) {
                bestAttempts.set(course.id, course);
            }
            // If equal, keep existing (doesn't matter)
            // If current is lower, ignore current (keep existing high grade)
        } else {
            bestAttempts.set(course.id, course);
        }
    }

    // Calculate CGPA based on best attempts
    const uniqueCourses = Array.from(bestAttempts.values());
    return calculateSGPA(uniqueCourses); // logic is same: sum(c*g) / sum(c)
};

/**
 * Converts SGPA or CGPA to percentage.
 * Formula: value * 10
 */
export const convertGPAToPercentage = (gpa: number): number => {
    return Math.round(gpa * 10 * 100) / 100; // Round to 2 decimals for percentage too
};

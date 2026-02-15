
import {
    calculateSGPA,
    calculateCGPA,
    convertGPAToPercentage,
    CourseResult
} from './gradingUtils';

describe('Grading Utils', () => {

    describe('calculateSGPA', () => {
        it('should calculate SGPA correctly for a set of courses', () => {
            const courses: CourseResult[] = [
                { id: '1', credits: 4, grade: 'AA', includeInGPA: true }, // 4 * 10 = 40
                { id: '2', credits: 3, grade: 'AB', includeInGPA: true }, // 3 * 9 = 27
                { id: '3', credits: 3, grade: 'BB', includeInGPA: true }, // 3 * 8 = 24
            ];
            // Total Points: 40 + 27 + 24 = 91
            // Total Credits: 4 + 3 + 3 = 10
            // SGPA: 9.1
            expect(calculateSGPA(courses)).toBe(9.1);
        });

        it('should ignore courses marked as not included in GPA', () => {
            const courses: CourseResult[] = [
                { id: '1', credits: 4, grade: 'AA', includeInGPA: true }, // 40
                { id: '2', credits: 3, grade: 'AB', includeInGPA: false }, // Ignored
            ];
            // Total Points: 40
            // Total Credits: 4
            // SGPA: 10.0
            expect(calculateSGPA(courses)).toBe(10.0);
        });

        it('should ignore Audit (AU), Pass/Pass (PP), No Pass (NP) and Incomplete (I) grades automatically', () => {
            const courses: CourseResult[] = [
                { id: '1', credits: 4, grade: 'AA', includeInGPA: true }, // 40
                { id: '2', credits: 3, grade: 'AU', includeInGPA: true }, // Ignored
                { id: '3', credits: 3, grade: 'PP', includeInGPA: true }, // Ignored
                { id: '4', credits: 3, grade: 'I', includeInGPA: true },  // Ignored
            ];
            expect(calculateSGPA(courses)).toBe(10.0);
        });

        it('should treat W and F as 0 grade points but include in credits (assuming standard W penalty if specified 0 points)', () => {
            // If W is 0 points, it acts like Failure in GPA calc if included in credits.
            // Re-visiting logic: "Letter Grade W = 0 Grade Points".
            // If it was excluded, it wouldn't imply 0 points contributing to the sum.
            // Let's test F first.
            const coursesF: CourseResult[] = [
                { id: '1', credits: 4, grade: 'AA', includeInGPA: true }, // 40
                { id: '2', credits: 4, grade: 'F', includeInGPA: true },  // 0
            ];
            // 40 / 8 = 5.0
            expect(calculateSGPA(coursesF)).toBe(5.0);

            const coursesW: CourseResult[] = [
                { id: '1', credits: 4, grade: 'AA', includeInGPA: true }, // 40
                { id: '2', credits: 4, grade: 'W', includeInGPA: true },  // 0
            ];
            expect(calculateSGPA(coursesW)).toBe(5.0);
        });

        it('should handle empty course list', () => {
            expect(calculateSGPA([])).toBe(0);
        });

        it('should round to 2 decimal places', () => {
            const courses: CourseResult[] = [
                { id: '1', credits: 3, grade: 'BB', includeInGPA: true }, // 24
                { id: '2', credits: 3, grade: 'BC', includeInGPA: true }, // 21
                { id: '3', credits: 3, grade: 'CC', includeInGPA: true }, // 18
            ];
            // 63 / 9 = 7.0
            expect(calculateSGPA(courses)).toBe(7.0);

            // Test rounding
            // 1 course with credit 3 grade 10 = 30
            // 1 course with credit 3 grade 10 = 30
            // 1 course with credit 1 grade 10 = 10 -> Total 70 / 7 = 10

            // Let's try an odd one: 10 + 9 + 8 / 3 = 9.0
            // 10*1 + 9*1 + 8*1 = 27 / 3 = 9

            // 10*1 + 10*1 + 6*1 = 26 / 3 = 8.666... -> 8.67
            const oddCourses: CourseResult[] = [
                { id: '1', credits: 1, grade: 'AA', includeInGPA: true },
                { id: '2', credits: 1, grade: 'AA', includeInGPA: true },
                { id: '3', credits: 1, grade: 'CC', includeInGPA: true },
            ];
            expect(calculateSGPA(oddCourses)).toBe(8.67);
        });
    });

    describe('calculateCGPA', () => {
        it('should calculate CGPA considering all courses', () => {
            const courses: CourseResult[] = [
                { id: '1', credits: 4, grade: 'AA', includeInGPA: true },
                { id: '2', credits: 4, grade: 'BB', includeInGPA: true },
            ];
            // (40 + 32) / 8 = 72 / 8 = 9.0
            expect(calculateCGPA(courses)).toBe(9.0);
        });

        it('should handle repeated courses by taking the best grade', () => {
            const courses: CourseResult[] = [
                { id: '1', credits: 4, grade: 'F', includeInGPA: true },  // Fail first
                { id: '1', credits: 4, grade: 'BB', includeInGPA: true }, // Repeated and passed
                { id: '2', credits: 3, grade: 'AA', includeInGPA: true }, // Other course
            ];
            // Should ignore F for course '1', keep BB.
            // Total Points: (4 * 8) + (3 * 10) = 32 + 30 = 62
            // Total Credits: 4 + 3 = 7
            // 62 / 7 = 8.857... -> 8.86
            expect(calculateCGPA(courses)).toBe(8.86);
        });

        it('should keep the higher grade if repeated (e.g. improvement)', () => {
            const courses: CourseResult[] = [
                { id: '1', credits: 4, grade: 'CC', includeInGPA: true },
                { id: '1', credits: 4, grade: 'AA', includeInGPA: true },
            ];
            // Should keep AA
            expect(calculateCGPA(courses)).toBe(10.0);
        });
    });

    describe('convertGPAToPercentage', () => {
        it('should multiply GPA by 10', () => {
            expect(convertGPAToPercentage(6.5)).toBe(65);
            expect(convertGPAToPercentage(10.0)).toBe(100);
            expect(convertGPAToPercentage(9.12)).toBe(91.2);
        });
    });
});

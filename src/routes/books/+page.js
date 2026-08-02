import { catalogue, getTeacherBooks } from '$lib/books/catalogue';

export function load() {
	return {
		teacherSummaries: catalogue.teachers.map((teacher) => ({
			teacher,
			courses: catalogue.courses.filter((course) => course.teacherId === teacher.id),
			books: getTeacherBooks(teacher.id)
		}))
	};
}

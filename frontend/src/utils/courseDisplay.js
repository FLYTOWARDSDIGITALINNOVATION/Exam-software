export const getDisplayCourse = (user = {}) => {
  const category = user.category;
  const course = user.course;

  if (category && category !== 'Both' && category !== 'All') {
    return category;
  }

  if (course) {
    return course;
  }

  return 'BSMS';
};

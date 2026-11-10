const normalizeCategory = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const isVideoVisibleToStudent = (studentCategory, videoCategory) => {
  const normalizedStudentCategory = normalizeCategory(studentCategory);
  const normalizedVideoCategory = normalizeCategory(videoCategory);

  if (!normalizedStudentCategory || normalizedStudentCategory === 'All' || normalizedStudentCategory === 'Both') {
    return true;
  }

  return normalizedVideoCategory === normalizedStudentCategory || normalizedVideoCategory === 'Both';
};

module.exports = {
  normalizeCategory,
  isVideoVisibleToStudent
};

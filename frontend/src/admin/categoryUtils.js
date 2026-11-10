export const getCategoryName = (category) => {
  if (!category) return '';
  if (typeof category === 'string') return category.trim();
  return (category?.name || '').trim();
};

export const getCategoryNames = (categories = []) =>
  categories
    .map(getCategoryName)
    .filter(Boolean);

export const getCategoryVideoCounts = (videos = [], categories = []) => {
  const categoryNames = getCategoryNames(categories);
  const counts = categoryNames.reduce((acc, name) => {
    acc[name] = 0;
    return acc;
  }, {});

  for (const video of videos || []) {
    const name = typeof video?.category === 'string' ? video.category.trim() : '';
    if (!name || !Object.prototype.hasOwnProperty.call(counts, name)) continue;
    counts[name] += 1;
  }

  return counts;
};

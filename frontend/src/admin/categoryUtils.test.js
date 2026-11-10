import { getCategoryNames, getCategoryVideoCounts } from './categoryUtils';

describe('category utilities', () => {
  it('normalizes category names from objects and strings', () => {
    const categories = [
      { name: 'MRB', batches: [] },
      'AIAPGET',
      { name: 'Crash Course', batches: [] }
    ];

    expect(getCategoryNames(categories)).toEqual(['MRB', 'AIAPGET', 'Crash Course']);
  });

  it('counts videos per category and includes zero-count categories', () => {
    const categories = ['Both', 'MRB', 'AIAPGET', 'Crash Course'];
    const videos = [
      { category: 'MRB' },
      { category: 'MRB' },
      { category: 'AIAPGET' },
      { category: 'Both' },
      { category: 'Crash Course' },
      { category: 'Unknown Category' }
    ];

    expect(getCategoryVideoCounts(videos, categories)).toEqual({
      Both: 1,
      MRB: 2,
      AIAPGET: 1,
      'Crash Course': 1
    });
  });
});

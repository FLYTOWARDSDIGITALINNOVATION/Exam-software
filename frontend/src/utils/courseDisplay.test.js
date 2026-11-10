import { getDisplayCourse } from './courseDisplay';

describe('getDisplayCourse', () => {
  it('prefers the enrolled category when the student stream is known', () => {
    expect(getDisplayCourse({ category: 'MRB', course: 'BSMS' })).toBe('MRB');
  });

  it('falls back to the academic course when no stream is set', () => {
    expect(getDisplayCourse({ course: 'BSMS' })).toBe('BSMS');
  });

  it('uses a default value when neither field is present', () => {
    expect(getDisplayCourse({})).toBe('BSMS');
  });
});

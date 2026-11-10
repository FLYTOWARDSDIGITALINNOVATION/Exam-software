const test = require('node:test');
const assert = require('node:assert/strict');

const { isVideoVisibleToStudent } = require('./videoAccess');

test('MRB students can only see MRB and Both videos', () => {
  assert.equal(isVideoVisibleToStudent('MRB', 'MRB'), true);
  assert.equal(isVideoVisibleToStudent('MRB', 'Both'), true);
  assert.equal(isVideoVisibleToStudent('MRB', 'AIAPGET'), false);
});

test('students with all-access can see every category', () => {
  assert.equal(isVideoVisibleToStudent('Both', 'MRB'), true);
  assert.equal(isVideoVisibleToStudent('All', 'AIAPGET'), true);
  assert.equal(isVideoVisibleToStudent('Both', 'Both'), true);
});

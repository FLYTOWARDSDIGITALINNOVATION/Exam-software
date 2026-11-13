const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { verifyEducator, verifyAdmin } = require('./server');

test.after(() => {
  return mongoose.disconnect();
});

test('faculty can access review moderation endpoints', () => {
  const originalVerify = jwt.verify;
  jwt.verify = () => ({ id: 'user-1', role: 'faculty' });

  let nextCalled = false;
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = { status: () => ({ json: () => {} }) };

  verifyEducator(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  jwt.verify = originalVerify;
});

test('students are still blocked from review moderation', () => {
  const originalVerify = jwt.verify;
  jwt.verify = () => ({ id: 'user-2', role: 'student' });

  let statusCode = null;
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const res = {
    status: (code) => {
      statusCode = code;
      return { json: () => {} };
    }
  };

  let nextCalled = false;
  verifyAdmin(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
  jwt.verify = originalVerify;
});

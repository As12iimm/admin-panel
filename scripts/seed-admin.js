require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/goodhope_admin');
  const email = (process.env.ADMIN_EMAIL || 'admin@flygoodhope.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('Admin already exists:', email);
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name: 'Super Admin',
    email,
    passwordHash,
    role: 'super_admin',
    branchIds: ['default'],
    mfaEnabled: true
  });
  console.log('Admin created:', email);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

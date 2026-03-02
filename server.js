const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('./src/config');
const { authRequired, allowRoles, allowAction } = require('./src/middleware/auth');
const { ACTIONS, permissionsForRole } = require('./src/permissions');

const User = require('./src/models/User');
const Session = require('./src/models/Session');
const PasswordResetToken = require('./src/models/PasswordResetToken');
const AuditLog = require('./src/models/AuditLog');
const Pilgrim = require('./src/models/Pilgrim');
const PilgrimDocument = require('./src/models/PilgrimDocument');
const PilgrimTimelineNote = require('./src/models/PilgrimTimelineNote');
const PilgrimTravelHistory = require('./src/models/PilgrimTravelHistory');
const Lead = require('./src/models/Lead');
const LeadTask = require('./src/models/LeadTask');
const Package = require('./src/models/Package');
const Booking = require('./src/models/Booking');
const Payment = require('./src/models/Payment');
const RefundRequest = require('./src/models/RefundRequest');
const Invoice = require('./src/models/Invoice');
const Installment = require('./src/models/Installment');
const Commission = require('./src/models/Commission');
const MedicalRecord = require('./src/models/MedicalRecord');
const ComplianceDocument = require('./src/models/ComplianceDocument');
const ComplianceRule = require('./src/models/ComplianceRule');
const Notification = require('./src/models/Notification');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

const privilegedRoles = ['super_admin', 'admin', 'operations', 'accounts', 'medical'];
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

function clientMeta(req) {
  return {
    userAgent: req.headers['user-agent'] || '',
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
  };
}

async function writeAudit(req, action, entity, entityId, changes) {
  await AuditLog.create({ actorUserId: req.user?.id, action, entity, entityId: entityId ? String(entityId) : undefined, changes, ...clientMeta(req) });
}

function buildScopes(req, route) {
  if (req.user.role === 'super_admin') return {};
  const filter = { branchId: { $in: req.user.branchIds || ['default'] } };
  if ((route === 'bookings' || route === 'payments' || route === 'refund-requests' || route === 'invoices') && req.user.assignedPackageIds?.length) {
    filter.packageId = { $in: req.user.assignedPackageIds };
  }
  return filter;
}

function makeBookingRef() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GH-${stamp}-${rand}`;
}

function makeInvoiceNo() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `INV-${stamp}-${rand}`;
}

async function issueTokens(user, req, deviceName) {
  const refreshRaw = randomToken(48);
  const session = await Session.create({ userId: user._id, refreshTokenHash: hash(refreshRaw), deviceName: deviceName || 'web', ...clientMeta(req), lastUsedAt: new Date() });
  const accessToken = jwt.sign({ id: user._id, role: user.role, sid: session._id, type: 'access', tokenVersion: user.tokenVersion }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  const refreshToken = jwt.sign({ id: user._id, sid: session._id, type: 'refresh', tokenVersion: user.tokenVersion, token: refreshRaw }, config.jwtSecret, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

// ----- Auth -----
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = await User.findOne({ email, active: true });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.lockUntil && user.lockUntil > new Date()) return res.status(423).json({ message: 'Account temporarily locked. Try later.' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) { user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); user.failedLoginAttempts = 0; }
    await user.save();
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  const needsMfa = user.mfaEnabled && privilegedRoles.includes(user.role);
  if (needsMfa) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.mfaCodeHash = hash(code);
    user.mfaCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    const challengeToken = jwt.sign({ id: user._id, type: 'mfa_challenge' }, config.jwtSecret, { expiresIn: '10m' });
    return res.json({ mfaRequired: true, challengeToken, devOtp: code });
  }

  await user.save();
  const tokens = await issueTokens(user, req, req.body.deviceName);
  res.json({ ...tokens, user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions: permissionsForRole(user.role) } });
}));

app.post('/api/auth/mfa/verify', asyncHandler(async (req, res) => {
  const { challengeToken, code, deviceName } = req.body;
  const payload = jwt.verify(String(challengeToken || ''), config.jwtSecret);
  if (payload.type !== 'mfa_challenge') return res.status(400).json({ message: 'Invalid challenge token' });
  const user = await User.findById(payload.id);
  if (!user || !user.mfaCodeHash || !user.mfaCodeExpiresAt) return res.status(400).json({ message: 'MFA not initialized' });
  if (user.mfaCodeExpiresAt < new Date()) return res.status(400).json({ message: 'OTP expired' });
  if (hash(String(code || '')) !== user.mfaCodeHash) return res.status(400).json({ message: 'Invalid OTP' });

  user.mfaCodeHash = undefined;
  user.mfaCodeExpiresAt = undefined;
  await user.save();
  const tokens = await issueTokens(user, req, deviceName);
  res.json({ ...tokens, user: { id: user._id, name: user.name, email: user.email, role: user.role, permissions: permissionsForRole(user.role) } });
}));

app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
  const payload = jwt.verify(String(req.body.refreshToken || ''), config.jwtSecret);
  if (payload.type !== 'refresh') return res.status(401).json({ message: 'Invalid token type' });
  const session = await Session.findById(payload.sid);
  const user = await User.findById(payload.id);
  if (!session || session.revokedAt || !user || !user.active) return res.status(401).json({ message: 'Session expired' });
  if (hash(payload.token) !== session.refreshTokenHash || user.tokenVersion !== payload.tokenVersion) return res.status(401).json({ message: 'Session invalidated' });

  const newRaw = randomToken(48);
  session.refreshTokenHash = hash(newRaw);
  session.lastUsedAt = new Date();
  await session.save();

  const accessToken = jwt.sign({ id: user._id, role: user.role, sid: session._id, type: 'access', tokenVersion: user.tokenVersion }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  const refreshToken = jwt.sign({ id: user._id, sid: session._id, type: 'refresh', tokenVersion: user.tokenVersion, token: newRaw }, config.jwtSecret, { expiresIn: '30d' });
  res.json({ accessToken, refreshToken });
}));

app.post('/api/auth/password-reset/request', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const user = await User.findOne({ email, active: true });
  if (!user) return res.json({ message: 'If account exists, reset instructions sent.' });
  const raw = randomToken(24);
  await PasswordResetToken.create({ userId: user._id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
  res.json({ message: 'If account exists, reset instructions sent.', devResetToken: raw });
}));

app.post('/api/auth/password-reset/confirm', asyncHandler(async (req, res) => {
  const token = await PasswordResetToken.findOne({ tokenHash: hash(String(req.body.token || '')), usedAt: null }).sort({ createdAt: -1 });
  if (!token || token.expiresAt < new Date()) return res.status(400).json({ message: 'Invalid or expired token' });
  const user = await User.findById(token.userId);
  if (!user) return res.status(400).json({ message: 'User not found' });
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 8) return res.status(400).json({ message: 'Password too short' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion += 1;
  await user.save();
  token.usedAt = new Date();
  await token.save();
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  res.json({ message: 'Password reset successful' });
}));

app.get('/api/auth/me', authRequired, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role, permissions: permissionsForRole(user.role), branchIds: user.branchIds });
}));
app.post('/api/auth/logout', authRequired, asyncHandler(async (req, res) => { await Session.findByIdAndUpdate(req.user.sid, { revokedAt: new Date() }); res.status(204).send(); }));

// ----- Common CRUD -----
function crudRoutes(model, route, action, writeRoles = ['super_admin', 'admin', 'operations']) {
  app.get(`/api/${route}`, authRequired, allowAction(action), asyncHandler(async (req, res) => {
    const scope = buildScopes(req, route);
    const q = String(req.query.q || '').trim();
    const sortBy = String(req.query.sortBy || 'createdAt');
    const sortDir = Number(req.query.sortDir || -1);
    const limit = Math.min(Number(req.query.limit || 250), 500);
    const filter = { ...scope };
    if (q) filter.$or = [{ fullName: new RegExp(q, 'i') }, { passportNo: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }, { title: new RegExp(q, 'i') }, { bookingRef: new RegExp(q, 'i') }, { invoiceNo: new RegExp(q, 'i') }];
    res.json(await model.find(filter).sort({ [sortBy]: sortDir }).limit(limit));
  }));

  app.post(`/api/${route}`, authRequired, allowRoles(...writeRoles), allowAction(action), asyncHandler(async (req, res) => {
    const payload = { ...req.body, ...(req.user.role !== 'super_admin' ? { branchId: req.user.branchIds?.[0] || 'default' } : {}) };
    const created = await model.create(payload);
    await writeAudit(req, `${route}.create`, route, created._id, payload);
    res.status(201).json(created);
  }));

  app.put(`/api/${route}/:id`, authRequired, allowRoles(...writeRoles), allowAction(action), asyncHandler(async (req, res) => {
    const scope = buildScopes(req, route);
    const updated = await model.findOneAndUpdate({ _id: req.params.id, ...scope }, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    await writeAudit(req, `${route}.update`, route, updated._id, req.body);
    res.json(updated);
  }));

  app.delete(`/api/${route}/:id`, authRequired, allowRoles('super_admin', 'admin'), allowAction(action), asyncHandler(async (req, res) => {
    const scope = buildScopes(req, route);
    const removed = await model.findOneAndDelete({ _id: req.params.id, ...scope });
    if (!removed) return res.status(404).json({ message: 'Not found' });
    await writeAudit(req, `${route}.delete`, route, removed._id);
    res.status(204).send();
  }));
}

// Core + CRM
crudRoutes(Pilgrim, 'pilgrims', ACTIONS.MANAGE_PILGRIMS);
crudRoutes(PilgrimTimelineNote, 'pilgrim-notes', ACTIONS.MANAGE_PILGRIM_TIMELINE, ['super_admin', 'admin', 'operations', 'medical']);
crudRoutes(PilgrimTravelHistory, 'pilgrim-travel-history', ACTIONS.MANAGE_TRAVEL_HISTORY, ['super_admin', 'admin', 'operations']);
crudRoutes(Lead, 'leads', ACTIONS.MANAGE_LEADS, ['super_admin', 'admin', 'operations', 'agent']);
crudRoutes(LeadTask, 'lead-tasks', ACTIONS.MANAGE_LEAD_TASKS, ['super_admin', 'admin', 'operations', 'agent']);
crudRoutes(Package, 'packages', ACTIONS.MANAGE_PACKAGES);
crudRoutes(Payment, 'payments', ACTIONS.MANAGE_PAYMENTS, ['super_admin', 'admin', 'accounts']);
crudRoutes(RefundRequest, 'refund-requests', ACTIONS.MANAGE_REFUNDS, ['super_admin', 'admin', 'accounts']);
crudRoutes(Booking, 'bookings', ACTIONS.MANAGE_BOOKINGS);
crudRoutes(Invoice, 'invoices', ACTIONS.MANAGE_INVOICES, ['super_admin', 'admin', 'accounts']);
crudRoutes(Installment, 'installments', ACTIONS.MANAGE_INSTALLMENTS, ['super_admin', 'admin', 'accounts']);
crudRoutes(Commission, 'commissions', ACTIONS.MANAGE_COMMISSIONS, ['super_admin', 'admin', 'accounts']);
crudRoutes(MedicalRecord, 'medical-records', ACTIONS.MANAGE_MEDICAL, ['super_admin', 'admin', 'medical', 'operations']);
crudRoutes(ComplianceDocument, 'compliance-documents', ACTIONS.MANAGE_COMPLIANCE, ['super_admin', 'admin', 'operations', 'medical']);
crudRoutes(ComplianceRule, 'compliance-rules', ACTIONS.MANAGE_COMPLIANCE, ['super_admin', 'admin', 'operations']);
crudRoutes(Notification, 'notifications', ACTIONS.MANAGE_NOTIFICATIONS, ['super_admin', 'admin', 'operations', 'medical']);

// Documents in MongoDB
app.post('/api/pilgrim-documents/upload', authRequired, allowAction(ACTIONS.MANAGE_PILGRIM_DOCUMENTS), asyncHandler(async (req, res) => {
  const { pilgrimId, fileName, mimeType, category, base64Data } = req.body;
  if (!pilgrimId || !fileName || !base64Data) return res.status(400).json({ message: 'pilgrimId, fileName, base64Data are required' });
  const data = Buffer.from(base64Data, 'base64');
  const doc = await PilgrimDocument.create({ branchId: req.user.role === 'super_admin' ? req.body.branchId || 'default' : req.user.branchIds?.[0] || 'default', pilgrimId, fileName, mimeType: mimeType || 'application/octet-stream', category: category || 'other', size: data.length, data, uploadedBy: req.user.email });
  res.status(201).json({ id: doc._id, fileName: doc.fileName, size: doc.size, category: doc.category, createdAt: doc.createdAt });
}));
app.get('/api/pilgrim-documents', authRequired, allowAction(ACTIONS.MANAGE_PILGRIM_DOCUMENTS), asyncHandler(async (req, res) => {
  const filter = { ...buildScopes(req), ...(req.query.pilgrimId ? { pilgrimId: req.query.pilgrimId } : {}) };
  res.json(await PilgrimDocument.find(filter).select('-data').sort({ createdAt: -1 }).limit(200));
}));
app.get('/api/pilgrim-documents/:id/download', authRequired, allowAction(ACTIONS.MANAGE_PILGRIM_DOCUMENTS), asyncHandler(async (req, res) => {
  const doc = await PilgrimDocument.findOne({ _id: req.params.id, ...buildScopes(req) });
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
  res.send(doc.data);
}));

// Leads pipeline + analytics
app.patch('/api/leads/:id/stage', authRequired, allowAction(ACTIONS.MANAGE_LEADS), asyncHandler(async (req, res) => {
  const status = String(req.body.status || '');
  const allowed = ['new', 'follow_up', 'qualified', 'proposal_sent', 'converted', 'lost'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid stage' });
  const lead = await Lead.findOneAndUpdate({ _id: req.params.id, ...buildScopes(req, 'leads') }, { status, convertedAt: status === 'converted' ? new Date() : null }, { new: true });
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  res.json(lead);
}));
app.post('/api/lead-tasks/recompute-overdue', authRequired, allowAction(ACTIONS.MANAGE_LEAD_TASKS), asyncHandler(async (req, res) => {
  const r = await LeadTask.updateMany({ ...buildScopes(req, 'lead-tasks'), status: { $ne: 'done' }, dueAt: { $lt: new Date() } }, { $set: { status: 'overdue' } });
  res.json({ modified: r.modifiedCount });
}));
app.get('/api/leads/analytics/summary', authRequired, allowAction(ACTIONS.VIEW_LEAD_ANALYTICS), asyncHandler(async (req, res) => {
  const scope = buildScopes(req, 'leads');
  const [byStatus, bySource, byCampaign, byAgent, byMonth] = await Promise.all([
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$campaign', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$assignedTo', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: scope }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } } } }, { $sort: { _id: 1 } }])
  ]);
  res.json({ byStatus, bySource, byCampaign, byAgent, byMonth });
}));

// Booking + refunds
app.post('/api/bookings/create', authRequired, allowAction(ACTIONS.MANAGE_BOOKINGS), asyncHandler(async (req, res) => {
  const { pilgrimId, packageId, roomType, roomAllocation, totalAmount } = req.body;
  if (!pilgrimId || !packageId) return res.status(400).json({ message: 'pilgrimId and packageId required' });
  const pkg = await Package.findById(packageId);
  if (!pkg) return res.status(404).json({ message: 'Package not found' });
  if (pkg.capacity > 0 && pkg.bookedSeats >= pkg.capacity) return res.status(409).json({ message: 'Package capacity exceeded' });

  let bookingRef = makeBookingRef(); while (await Booking.findOne({ bookingRef })) bookingRef = makeBookingRef();
  const booking = await Booking.create({ branchId: req.user.role === 'super_admin' ? req.body.branchId || pkg.branchId : req.user.branchIds?.[0] || 'default', bookingRef, pilgrimId, packageId, roomType: roomType || 'quad', roomAllocation: roomAllocation || '', totalAmount: Number(totalAmount || pkg.basePrice || 0), paidAmount: 0, status: 'confirmed' });
  pkg.bookedSeats += 1; await pkg.save();
  res.status(201).json(booking);
}));
app.post('/api/bookings/:id/cancel', authRequired, allowAction(ACTIONS.MANAGE_BOOKINGS), asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, ...buildScopes(req, 'bookings') });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  if (booking.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });
  booking.status = 'cancelled'; booking.cancellationReason = req.body.reason || 'Cancelled by user'; booking.cancelledAt = new Date(); await booking.save();
  const pkg = await Package.findById(booking.packageId); if (pkg && pkg.bookedSeats > 0) { pkg.bookedSeats -= 1; await pkg.save(); }
  res.json(booking);
}));
app.post('/api/refund-requests/:id/approve', authRequired, allowRoles('super_admin', 'admin', 'accounts'), allowAction(ACTIONS.MANAGE_REFUNDS), asyncHandler(async (req, res) => {
  const refund = await RefundRequest.findOne({ _id: req.params.id, ...buildScopes(req, 'refund-requests') });
  if (!refund) return res.status(404).json({ message: 'Refund request not found' });
  refund.status = 'approved'; refund.approvedBy = req.user.email; refund.approvedAt = new Date(); await refund.save();
  res.json(refund);
}));

// Accounts/finance depth
app.post('/api/invoices/generate', authRequired, allowAction(ACTIONS.MANAGE_INVOICES), asyncHandler(async (req, res) => {
  const { bookingId, taxRate = 0, subtotal = 0 } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const pilgrim = await Pilgrim.findById(booking.pilgrimId);
  let invoiceNo = makeInvoiceNo(); while (await Invoice.findOne({ invoiceNo })) invoiceNo = makeInvoiceNo();
  const taxAmount = Number(subtotal) * (Number(taxRate) / 100);
  const total = Number(subtotal) + taxAmount;
  const pdfText = `Invoice ${invoiceNo}\nBooking:${booking.bookingRef}\nSubtotal:${subtotal}\nTax:${taxAmount}\nTotal:${total}`;
  const invoice = await Invoice.create({
    branchId: booking.branchId,
    invoiceNo,
    bookingId: booking._id,
    pilgrimId: pilgrim?._id,
    subtotal: Number(subtotal),
    taxRate: Number(taxRate),
    taxAmount,
    total,
    status: 'issued',
    pdfBase64: Buffer.from(pdfText).toString('base64')
  });
  res.status(201).json(invoice);
}));

app.post('/api/invoices/:id/approve', authRequired, allowRoles('super_admin', 'admin', 'accounts'), allowAction(ACTIONS.MANAGE_INVOICES), asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, ...buildScopes(req, 'invoices') });
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  invoice.status = 'approved';
  invoice.approvedBy = req.user.email;
  invoice.approvedAt = new Date();
  await invoice.save();
  res.json(invoice);
}));

app.post('/api/installments/schedule', authRequired, allowAction(ACTIONS.MANAGE_INSTALLMENTS), asyncHandler(async (req, res) => {
  const { invoiceId, plan = [] } = req.body;
  if (!invoiceId || !Array.isArray(plan) || !plan.length) return res.status(400).json({ message: 'invoiceId and plan[] required' });
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  await Installment.deleteMany({ invoiceId });
  const docs = await Installment.insertMany(plan.map((x) => ({
    branchId: invoice.branchId,
    invoiceId,
    dueDate: new Date(x.dueDate),
    amount: Number(x.amount || 0),
    status: 'pending'
  })));
  res.json(docs);
}));

app.post('/api/installments/:id/pay', authRequired, allowAction(ACTIONS.MANAGE_INSTALLMENTS), asyncHandler(async (req, res) => {
  const installment = await Installment.findById(req.params.id);
  if (!installment) return res.status(404).json({ message: 'Installment not found' });
  installment.paidAmount += Number(req.body.amount || 0);
  installment.status = installment.paidAmount >= installment.amount ? 'paid' : installment.status;
  await installment.save();
  res.json(installment);
}));

app.get('/api/finance/reconciliation', authRequired, allowAction(ACTIONS.VIEW_FINANCE_REPORTS), asyncHandler(async (req, res) => {
  const scope = buildScopes(req, 'invoices');
  const invoices = await Invoice.find(scope);
  const invoiceIds = invoices.map((i) => i._id);
  const installments = await Installment.find({ invoiceId: { $in: invoiceIds } });
  const payments = await Payment.find(scope);
  const invoiceTotal = invoices.reduce((a, b) => a + (b.total || 0), 0);
  const installmentDue = installments.reduce((a, b) => a + (b.amount || 0), 0);
  const installmentPaid = installments.reduce((a, b) => a + (b.paidAmount || 0), 0);
  const paymentsTotal = payments.reduce((a, b) => a + (b.amount || 0), 0);
  res.json({ invoiceCount: invoices.length, invoiceTotal, installmentDue, installmentPaid, paymentsTotal, gap: invoiceTotal - paymentsTotal });
}));

app.post('/api/commissions/calculate', authRequired, allowAction(ACTIONS.MANAGE_COMMISSIONS), asyncHandler(async (req, res) => {
  const { bookingId, agentId, ratePercent = 5 } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const baseAmount = Number(booking.totalAmount || 0);
  const commissionAmount = baseAmount * (Number(ratePercent) / 100);
  const commission = await Commission.create({ branchId: booking.branchId, bookingId, agentId, ratePercent: Number(ratePercent), baseAmount, commissionAmount, status: 'pending' });
  res.status(201).json(commission);
}));
app.post('/api/commissions/:id/approve', authRequired, allowAction(ACTIONS.MANAGE_COMMISSIONS), asyncHandler(async (req, res) => {
  const c = await Commission.findById(req.params.id);
  if (!c) return res.status(404).json({ message: 'Commission not found' });
  c.status = 'approved';
  await c.save();
  res.json(c);
}));

// Medical & compliance phase-2 completion
app.post('/api/medical-records/:id/submit-clearance', authRequired, allowAction(ACTIONS.MANAGE_MEDICAL), asyncHandler(async (req, res) => {
  const record = await MedicalRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ message: 'Medical record not found' });
  record.clearanceWorkflowStatus = 'submitted';
  record.nextReviewDueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  await record.save();
  res.json(record);
}));

app.post('/api/medical-records/:id/review-step', authRequired, allowAction(ACTIONS.MANAGE_MEDICAL), asyncHandler(async (req, res) => {
  const { step, decision, note } = req.body;
  const record = await MedicalRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ message: 'Medical record not found' });
  const s = record.clearanceSteps.find((x) => x.step === step);
  if (!s) return res.status(400).json({ message: 'Invalid step' });
  s.status = decision === 'approved' ? 'approved' : 'rejected';
  s.reviewedBy = req.user.email;
  s.reviewedAt = new Date();
  s.note = note || '';

  const allApproved = record.clearanceSteps.every((x) => x.status === 'approved');
  const anyRejected = record.clearanceSteps.some((x) => x.status === 'rejected');
  if (allApproved) {
    record.clearanceWorkflowStatus = 'approved';
    record.fitnessStatus = 'fit';
    record.clearanceDate = new Date();
  } else if (anyRejected) {
    record.clearanceWorkflowStatus = 'rejected';
    record.fitnessStatus = 'unfit';
  } else {
    record.clearanceWorkflowStatus = 'under_review';
  }
  await record.save();
  res.json(record);
}));

app.post('/api/compliance/checklist/generate', authRequired, allowAction(ACTIONS.MANAGE_COMPLIANCE), asyncHandler(async (req, res) => {
  const { pilgrimId, packageType = 'umrah' } = req.body;
  const pilgrim = await Pilgrim.findById(pilgrimId);
  if (!pilgrim) return res.status(404).json({ message: 'Pilgrim not found' });
  const nationality = pilgrim.nationality || 'generic';
  const rule = await ComplianceRule.findOne({ nationality, packageType }) || await ComplianceRule.findOne({ nationality: 'generic', packageType });
  if (!rule) return res.status(404).json({ message: 'Compliance rule not found' });

  const created = [];
  for (const docType of rule.requiredDocs) {
    const exists = await ComplianceDocument.findOne({ pilgrimId, docType, packageType });
    if (!exists) {
      const doc = await ComplianceDocument.create({
        branchId: pilgrim.branchId,
        pilgrimId,
        packageType,
        nationality,
        docType,
        status: 'missing',
        slaDueAt: new Date(Date.now() + rule.slaDays * 24 * 60 * 60 * 1000)
      });
      created.push(doc);
    }
  }
  res.json({ generated: created.length, created });
}));

app.post('/api/pilgrims/:id/visa-stage', authRequired, allowAction(ACTIONS.MANAGE_VISA_WORKFLOW), asyncHandler(async (req, res) => {
  const pilgrim = await Pilgrim.findById(req.params.id);
  if (!pilgrim) return res.status(404).json({ message: 'Pilgrim not found' });
  const stage = String(req.body.stage || '');
  const allowed = ['draft', 'submitted', 'embassy_review', 'stamped', 'issued', 'rejected'];
  if (!allowed.includes(stage)) return res.status(400).json({ message: 'Invalid visa stage' });
  pilgrim.visaStage = stage;
  pilgrim.visaSlaDueAt = req.body.slaDays ? new Date(Date.now() + Number(req.body.slaDays) * 24 * 60 * 60 * 1000) : pilgrim.visaSlaDueAt;
  pilgrim.visaStatus = ['issued', 'stamped'].includes(stage) ? 'approved' : stage === 'rejected' ? 'rejected' : 'in_review';
  await pilgrim.save();
  res.json(pilgrim);
}));

app.post('/api/jobs/reminders/run', authRequired, allowAction(ACTIONS.MANAGE_NOTIFICATIONS), asyncHandler(async (req, res) => {
  const now = new Date();
  const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const overdueInstallments = await Installment.find({ status: { $in: ['pending', 'overdue'] }, dueDate: { $lt: now } }).limit(500);
  const expiringDocs = await ComplianceDocument.find({ expiryDate: { $lte: soon }, status: 'verified' }).limit(500);
  const visaSlaMiss = await Pilgrim.find({ visaSlaDueAt: { $lt: now }, visaStage: { $nin: ['issued', 'rejected'] } }).limit(500);
  const medicalReviews = await MedicalRecord.find({ nextReviewDueAt: { $lt: now }, clearanceWorkflowStatus: { $in: ['submitted', 'under_review'] } }).limit(500);

  const notifications = [];
  overdueInstallments.forEach((i) => notifications.push({ branchId: i.branchId, type: 'due_reminder', message: `Installment overdue: ${i._id}`, status: 'pending' }));
  expiringDocs.forEach((d) => notifications.push({ branchId: d.branchId, type: 'doc_expiry', message: `Doc expiry near: ${d.docType} for pilgrim ${d.pilgrimId}`, status: 'pending' }));
  visaSlaMiss.forEach((p) => notifications.push({ branchId: p.branchId, type: 'visa_sla', message: `Visa SLA breach for ${p.fullName}`, status: 'pending' }));
  medicalReviews.forEach((m) => notifications.push({ branchId: m.branchId, type: 'medical_review', message: `Medical review due for record ${m._id}`, status: 'pending' }));

  if (notifications.length) await Notification.insertMany(notifications);
  const result = await Notification.updateMany({ status: 'pending' }, { $set: { status: 'sent', sentAt: new Date() } });
  res.json({ generated: notifications.length, sent: result.modifiedCount });
}));

// Reports/exports + dashboard
app.get('/api/finance/reports/invoices-by-status', authRequired, allowAction(ACTIONS.VIEW_FINANCE_REPORTS), asyncHandler(async (req, res) => {
  const rows = await Invoice.aggregate([{ $match: buildScopes(req, 'invoices') }, { $group: { _id: '$status', total: { $sum: '$total' }, count: { $sum: 1 } } }]);
  res.json(rows);
}));

app.get('/api/export/pilgrims.csv', authRequired, allowAction(ACTIONS.MANAGE_PILGRIMS), asyncHandler(async (req, res) => {
  const rows = await Pilgrim.find(buildScopes(req, 'pilgrims')).sort({ createdAt: -1 }).limit(1000);
  const csv = ['fullName,passportNo,phone,nationality,familyGroupId,visaStage,branchId']
    .concat(rows.map((r) => [r.fullName, r.passportNo, r.phone, r.nationality, r.familyGroupId, r.visaStage, r.branchId].map((v) => `"${String(v || '').replaceAll('"', '""')}"`).join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
}));
app.get('/api/export/leads.csv', authRequired, allowAction(ACTIONS.MANAGE_LEADS), asyncHandler(async (req, res) => {
  const rows = await Lead.find(buildScopes(req, 'leads')).sort({ createdAt: -1 }).limit(1000);
  const csv = ['fullName,phone,source,campaign,status,assignedTo,createdAt']
    .concat(rows.map((r) => [r.fullName, r.phone, r.source, r.campaign, r.status, r.assignedTo, r.createdAt?.toISOString()].map((v) => `"${String(v || '').replaceAll('"', '""')}"`).join(',')))
    .join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
}));

app.get('/api/dashboard/stats', authRequired, allowAction(ACTIONS.VIEW_DASHBOARD), asyncHandler(async (req, res) => {
  const scope = buildScopes(req);
  const [pilgrims, leads, packages, bookings, medicalPending, compliancePending, overdueTasks, overdueInstallments, paymentsTotal] = await Promise.all([
    Pilgrim.countDocuments(scope),
    Lead.countDocuments(scope),
    Package.countDocuments(scope),
    Booking.countDocuments(scope),
    MedicalRecord.countDocuments({ ...scope, clearanceWorkflowStatus: { $in: ['submitted', 'under_review'] } }),
    ComplianceDocument.countDocuments({ ...scope, status: { $in: ['missing', 'submitted'] } }),
    LeadTask.countDocuments({ ...scope, status: 'overdue' }),
    Installment.countDocuments({ ...scope, status: { $in: ['pending', 'overdue'] }, dueDate: { $lt: new Date() } }),
    Payment.aggregate([{ $match: scope }, { $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  res.json({ pilgrims, leads, packages, bookings, medicalPending, compliancePending, overdueTasks, overdueInstallments, received: paymentsTotal[0]?.total || 0 });
}));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.use((err, _, res, __) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

async function start() {
  await mongoose.connect(config.mongodbUri);
  app.listen(config.port, () => {
    console.log(`Goodhope admin running on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

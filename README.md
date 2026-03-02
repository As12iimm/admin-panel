# Goodhope Admin System

Professional full-stack admin platform for Hajj & Umrah operations, prepared for deployment to `admin.flygoodhope.com`.

## Implemented (current)

### Security hardening
- Access + refresh JWT flow with rotation and token revocation
- MFA for privileged roles
- Password reset tokens (stored in MongoDB)
- Login lockout throttling
- Session/device management and force logout
- Fine-grained audit logging

### Role and scoping
- Action-level permission matrix
- UI permission guards
- Branch-level data scoping for CRUD and analytics

### Pilgrim CRM completeness
- Family/group links (`familyGroupId`, group role)
- Emergency contact matrix
- Timeline activity/assignment notes
- Travel history records
- Document upload and binary storage in MongoDB (`PilgrimDocument.data`)
- Advanced search/filter/sort/limit on CRUD list endpoints
- CSV export for pilgrims

### Leads pipeline completeness
- Kanban pipeline stages with stage-change API
- Follow-up tasks with SLA due dates and overdue recompute
- Source/campaign attribution in lead schema
- Conversion analytics grouped by source/campaign/agent/time
- CSV export for leads

### Accounts/finance module depth
- Invoice generation with numbering, tax fields, and PDF payload (`pdfBase64`) in MongoDB
- Installment scheduling and overdue tracking
- Reconciliation report endpoint for invoices/installments/payments
- Finance approval workflow for invoices/refunds
- Agent commission calculation + approval workflow

### Medical & compliance phase-2 completion
- Medical clearance workflow with nurse/doctor/chief approval chain
- Due/review alerts via reminder job
- Compliance rule engine by nationality + package type
- Automated checklist generation from rules
- Visa stage workflow with SLA due date
- Doc expiry / visa SLA / due reminders via notification job

## Run locally
```bash
npm install
npm run seed:admin
npm start
```

Open `http://localhost:8080`.

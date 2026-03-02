# Goodhope Hajj & Umrah Admin Software Roadmap

## Brand Foundation (from provided logo)
- **Primary Gold:** `#9B8405`
- **Secondary Orange:** `#FA9836`
- **Accent Teal:** `#006762`
- **Deep Slate:** `#1E3135`
- **Background:** `#F8F6EF`

Brand expression should stay premium and trusted: warm gold highlights, orange CTAs, teal operational indicators, and calm slate typography.

---

## Delivery Structure

### Phase 1 (MVP): Build & Go-Live Core Operations
**Target:** Launch operationally usable admin for one branch.

#### A. Product Modules
1. **Branded Admin Experience**
   - Login + dashboard shell aligned with Goodhope palette
   - Reusable UI tokens/components for forms, cards, tables, badges

2. **Dynamic Pilgrim CRM**
   - Full profiles: identity, passport, contacts, emergency details
   - Document center: passport/visa/vaccine uploads + status tracking
   - Tags, filters, and timeline activity feed

3. **Leads Management**
   - Capture source (call, web, agent, walk-in)
   - Pipeline: New → Follow-up → Qualified → Converted/Lost
   - Task reminders + conversion reports

4. **Packages + Bookings**
   - Package setup: itinerary, hotel, transport, capacity, pricing
   - Booking creation for individual and family/group records
   - Seat/room availability and booking status flow

5. **Accounts (Core)**
   - Invoices, receipts, installment schedules, due reminders
   - Collections dashboard and pending dues report

6. **Access, Security, API**
   - Roles: Super Admin, Admin, Operations, Accounts, Agent
   - JWT authentication, password policy, module-level RBAC
   - MongoDB-based REST API v1 with validation and pagination

#### B. Phase 1 Exit Criteria
- Team can manage day-to-day pilgrim, lead, booking, and payment operations.
- Data export available for operations and finance review.
- Basic audit trail active for sensitive updates.

---

### Phase 2: Enterprise Automation & Scale
**Target:** Expand control, compliance, and multi-branch intelligence.

1. **Medical Management**
   - Medical history, risk flags, vaccination reminders
   - Fit/unfit workflow with medical clearance approvals

2. **Compliance & Visa Automation**
   - Rule-based document checklist by nationality/package
   - Visa processing stages and SLA alerts

3. **Advanced Finance**
   - Refund approvals, credit notes, commission engine
   - Reconciliation workflows + advanced profitability reports

4. **Communication Journeys**
   - WhatsApp/SMS/email template automation
   - Triggered reminders for dues, documents, and departures

5. **Security + Integrations**
   - 2FA for privileged users, session/IP monitoring
   - Partner APIs, webhooks, and rate limiting

6. **Multi-Branch Analytics**
   - Branch-level access boundaries and performance dashboards
   - HQ consolidated analytics and forecasting

#### Phase 2 Exit Criteria
- Compliance and medical risk workflows are fully automated.
- Multi-branch reporting and advanced controls are production ready.
- Communication automations reduce manual follow-up workload.

---

## Implementation Status Update
- ✅ Phase 1 foundation implemented with production backend scaffold and branded admin UI.
- ✅ Phase 2 initiated with Medical Records and Compliance Documents modules (API + UI sections).
- 🔜 Next: visa workflow automation, notification engine, and branch-level analytics.

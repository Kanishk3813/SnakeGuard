# SnakeGuard User Stories

## User Story 1 - Real-time Snake Detection
**As a** wildlife conservation officer, **I want** real-time snake detection alerts on my dashboard **so that** I can respond immediately to snake sightings in protected areas.

**Estimation of Effort:** High

**Acceptance Criteria:**
- Given that a snake is detected by the Raspberry Pi camera, when the YOLOv8n model identifies it, then the system should capture an image with bounding box and GPS coordinates.
- Given that a detection occurs, when the system processes it, then the detection should appear on the dashboard within 2-5 seconds.
- Given that multiple detections occur simultaneously, when they are processed, then the system should handle them without performance degradation.
- Given that the detection system is running, when a snake appears in the camera feed, then the system should achieve 15-20 FPS processing speed.

---

## User Story 2 - Offline Detection Queue
**As a** field researcher in remote areas, **I want** the system to queue detections when offline **so that** no snake sightings are lost during connectivity issues.

**Estimation of Effort:** Moderate

**Acceptance Criteria:**
- Given that the Raspberry Pi loses internet connection, when a snake is detected, then the system should store the detection locally in a queue.
- Given that detections are queued offline, when internet connection is restored, then the system should automatically sync all queued detections to the database.
- Given that the system is syncing queued detections, when a sync operation fails, then the system should retry the sync without losing data.
- Given that the user accesses the dashboard, when there are queued detections, then the system should display a notification about pending syncs.

---

## User Story 3 - AI-Powered Species Classification
**As a** herpetologist, **I want** automatic snake species classification **so that** I can quickly identify venomous species and assess risk levels.

**Estimation of Effort:** High

**Acceptance Criteria:**
- Given that a new detection is created, when the automated pipeline triggers, then the system should classify the snake species using Google Gemini AI.
- Given that the AI classifies a snake, when the classification completes, then the system should display the species name, venomous status, and risk level (low/medium/high/critical).
- Given that the AI classification fails, when an error occurs, then the system should mark the detection as "pending classification" and allow manual classification.
- Given that a detection is classified, when the user views the detection details, then they should see the confidence score and classification timestamp.

---

## User Story 4 - Automated Risk Assessment and Playbook Assignment
**As a** emergency response coordinator, **I want** automatic risk assessment and playbook assignment **so that** appropriate response procedures are immediately available for each incident.

**Estimation of Effort:** Moderate

**Acceptance Criteria:**
- Given that a snake is classified, when the system determines the risk level, then it should automatically assign the matching incident playbook.
- Given that a playbook is assigned, when the user views the incident, then they should see step-by-step checklist items, emergency contacts, and first-aid information.
- Given that no matching playbook exists, when a detection is processed, then the system should assign a default playbook based on risk level.
- Given that the user wants to change the assigned playbook, when they update it manually, then the system should save the change and update the incident.

---

## User Story 5 - Automated Notification System
**As a** community member living near wildlife areas, **I want** to receive automated alerts when snakes are detected nearby **so that** I can take appropriate safety precautions.

**Estimation of Effort:** Moderate

**Acceptance Criteria:**
- Given that a high-risk snake is detected, when the automated pipeline processes it, then the system should send email notifications to nearby users within 5 seconds.
- Given that a critical-risk snake is detected, when the system processes it, then the system should send both email and SMS notifications to emergency contacts.
- Given that a user receives a notification, when they click the notification link, then they should be directed to the incident details page.
- Given that the user wants to manage notification preferences, when they update their settings, then the system should respect their preferences for future alerts.

---

## User Story 6 - Interactive Heat Map Visualization
**As a** wildlife researcher, **I want** to view detection hotspots on an interactive heat map **so that** I can identify patterns and high-risk areas for snake activity.

**Estimation of Effort:** Moderate

**Acceptance Criteria:**
- Given that detections exist in the database, when the user accesses the heat map page, then the system should display all detection locations on an interactive map.
- Given that the heat map displays detections, when the user filters by date range, then the map should update to show only detections within that period.
- Given that the user hovers over a heat map point, when they interact with it, then the system should display detection details (species, time, risk level).
- Given that multiple detections occur at the same location, when they are displayed, then the system should aggregate them to show intensity.

---

## User Story 7 - Incident Management with Checklist Tracking
**As a** field responder, **I want** to track incident response progress using checklists **so that** I can ensure all safety procedures are followed correctly.

**Estimation of Effort:** Low

**Acceptance Criteria:**
- Given that an incident is created, when the user views it, then they should see a checklist of response steps from the assigned playbook.
- Given that a checklist item exists, when the user marks it as complete, then the system should save the status and timestamp.
- Given that the user wants to add notes to a checklist item, when they update it, then the system should save the notes with the item.
- Given that all checklist items are completed, when the user marks the incident as resolved, then the system should update the incident status to "completed".

---

## User Story 8 - AI Chatbot for Snake Information
**As a** concerned citizen, **I want** to ask questions about snakes and first-aid procedures through a chatbot **so that** I can get immediate guidance without searching through documentation.

**Estimation of Effort:** Moderate

**Acceptance Criteria:**
- Given that the user accesses the chatbot, when they ask a snake-related question, then the chatbot should provide accurate information about species, behavior, or first-aid.
- Given that the user asks about a specific snake species, when the chatbot responds, then it should include venomous status and safety precautions.
- Given that the user asks about first-aid procedures, when the chatbot responds, then it should provide step-by-step instructions.
- Given that the chatbot cannot answer a question, when it encounters an unknown query, then it should gracefully redirect the user to contact support or view documentation.

---

## User Story 9 - Admin Playbook Management
**As an** administrator, **I want** to create and manage incident playbooks **so that** response procedures can be standardized and updated as needed.

**Estimation of Effort:** Low

**Acceptance Criteria:**
- Given that the admin accesses the playbook management page, when they create a new playbook, then the system should allow them to define risk level, species, steps, contacts, and first-aid information.
- Given that a playbook exists, when the admin edits it, then the system should save the changes and update all associated incidents.
- Given that the admin wants to generate a playbook using AI, when they use the AI generator, then the system should create a playbook based on risk level and scenario.
- Given that the admin deletes a playbook, when it is removed, then the system should reassign default playbooks to incidents that were using it.

---

## User Story 10 - Pipeline Performance Monitoring
**As a** system administrator, **I want** to monitor the automated pipeline performance **so that** I can ensure the system is processing detections efficiently and identify bottlenecks.

**Estimation of Effort:** Low

**Acceptance Criteria:**
- Given that detections are processed through the pipeline, when the admin views the pipeline dashboard, then the system should display total processed detections, average response time, and success rates.
- Given that the pipeline processes a detection, when it completes, then the system should record metrics including classification time, notification time, and total processing duration.
- Given that a pipeline operation fails, when an error occurs, then the system should log the error and display it in the pipeline dashboard.
- Given that the admin wants to manually trigger pipeline processing, when they click the poll button, then the system should process all unprocessed detections.

---

## MS Planner Column Organization

### Product Backlog (Initial State)
All new user stories should start here. This is your repository of planned work.

**Suggested Initial Placement:**
- User Story 1 - Real-time Snake Detection
- User Story 2 - Offline Detection Queue
- User Story 3 - AI-Powered Species Classification
- User Story 4 - Automated Risk Assessment and Playbook Assignment
- User Story 5 - Automated Notification System
- User Story 6 - Interactive Heat Map Visualization
- User Story 7 - Incident Management with Checklist Tracking
- User Story 8 - AI Chatbot for Snake Information
- User Story 9 - Admin Playbook Management
- User Story 10 - Pipeline Performance Monitoring

### Sprint Backlog
Move stories here when you start working on them in a sprint. Typically, you'd select 2-4 stories per sprint based on effort estimation.

**Example Sprint Planning:**
- Sprint 1: User Story 7 (Low), User Story 9 (Low), User Story 10 (Low)
- Sprint 2: User Story 2 (Moderate), User Story 4 (Moderate)
- Sprint 3: User Story 5 (Moderate), User Story 6 (Moderate)
- Sprint 4: User Story 8 (Moderate)
- Sprint 5: User Story 1 (High), User Story 3 (High)

### Awaiting Review
Move stories here when development is complete but needs review/testing before final approval.

### Completed Items
Move stories here when all acceptance criteria are met, tested, and approved.

---

## Weekly Progress Tracking Tips

1. **Week 1-2:** Start with low-effort stories (7, 9, 10) to build momentum
2. **Week 3-4:** Move to moderate-effort stories (2, 4, 5, 6, 8)
3. **Week 5-6:** Tackle high-effort stories (1, 3) which are core features
4. **Update Planner Weekly:** Move completed stories from Sprint Backlog → Awaiting Review → Completed Items
5. **Document Progress:** Add notes to each story card showing what was accomplished each week



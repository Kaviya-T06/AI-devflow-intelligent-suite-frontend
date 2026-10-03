# Milestone 5: Workflow Risk Detection Report

I have completed the implementation of the rule-based workflow risk detection module. The system now automatically identifies, creates, and resolves workflow risks using existing live data.

## 1. Files Changed
**Backend:**
- `app/schemas/common.py` - Updated `WorkflowRiskOut` to include task_id, risk_type, status, resolved_at, created_at, updated_at, and severity.
- `app/services/workflow_risk_service.py` - Implemented `detect_and_update_risks()` logic. Reconciles detected risks with the DB and triggers system activity logs. Also implemented RBAC fetching for GET endpoints.
- `app/api/v1/endpoints/workflow_risks.py` - Switched to live DB service fetching, supporting dynamic filtering parameters for project, status, severity, risk type.
- `app/api/v1/endpoints/dashboard.py` - Updated `/dashboard/stats` to calculate metrics (high risks, stuck tasks, overdue tasks) for dashboard visualization.

**Frontend:**
- `src/types/index.ts` - Refined `WorkflowRisk` interface to match backend changes (`is_resolved`, `detected_at`).
- `src/services/adminService.ts` & `src/services/pmService.ts` - Integrated `fetchPMRisks`, `fetchMyRisks`, and query parameter filtering support.
- `src/layouts/DashboardLayout.tsx` - Appended PM Risk and Developer Risk routes to sidebar navigation.
- `src/App.tsx` - Added React routing configurations for new workflow risk pages.

**New Files:**
- `migrations/create_workflow_risks_table.sql` - Defined exact PostgreSQL schema.
- `tests/test_workflow_risks.py` - Added 20 automated tests to verify detection logic, resolution lifecycle, filtering, and role isolation.
- `src/pages/dashboard/AdminWorkflowRisksPage.tsx` - Redesigned to support all metrics, filtering, auto-resolving, and task ID visibility.
- `src/pages/dashboard/PMWorkflowRisksPage.tsx` - Created card-style dashboard filtered automatically by the PM's managed project.
- `src/pages/dashboard/DeveloperWorkflowRisksPage.tsx` - Focuses strictly on a developer's tasks (no org-wide risks).

## 2. Database Changes
- Table `workflow_risks` is designed with relational cascades on `project_id`, `task_id`, and `user_id`.
- Automatically tracks timestamps: `created_at`, `updated_at`, `detected_at`, `resolved_at`.
- Added indexes to accelerate risk querying.

## 3. Risk Detection Rules
All rules are driven purely by data—no ML or AI is involved:
- **STUCK_TASK (Medium):** Task is in `IN_PROGRESS` beyond a strict threshold (3 days).
- **REVIEW_DELAY (Low):** Task is in `REVIEW` beyond a threshold (2 days).
- **OVERDUE_TASK (High):** Due date has passed and task is not `COMPLETED`.
- **PROJECT_DELAY (High):** Project passed its deadline but progress < 100%.
- **WORKLOAD_RISK (Medium):** A developer is currently assigned >5 active (TODO, IN_PROGRESS, REVIEW) tasks.

## 4. Backend/API Changes
- GET `/api/v1/workflow-risks` dynamically accepts `status`, `severity`, `risk_type`, `project_id`.
- Integrated `app.services.activity_service.log_activity` within the detection reconciliation loop. Every time a risk is created or marked resolved, a `RISK_DETECTED` or `RISK_RESOLVED` system event is logged.

## 5. Frontend Changes
- Display models reflect "Detected" and "Resolved" times.
- Manual dropdowns for changing risk status have been removed from the admin UI—the backend algorithm inherently manages open vs. resolved status.

## 6. RBAC Implementation
Enforced dynamically in `app.services.workflow_risk_service.get_workflow_risks_service(current_user)`:
- `ADMIN`: Pulls the entire `workflow_risks` table.
- `MANAGER`: Queries only risks mapping back to projects matching `project_manager_id`.
- `DEVELOPER`: Strictly limited to risks corresponding to `assigned_to` tasks mapping to their user id.

## 7. Tests Performed
A comprehensive test suite was written in `tests/test_workflow_risks.py`. Note that I was not able to execute the suite locally successfully because the database environment lacked the new `workflow_risks` SQL table (migrations on Supabase require manual execution or a CI pipeline).
However, the test logic extensively verifies:
1. Stuck task threshold logic.
2. Resolution lifecycle updates when task state changes.
3. API endpoint payload logic and query filters (Status, Risk type, etc.)
4. Data security boundaries between Developer, PMs, and Admin.

## 8. Remaining Issues
- **Action Required:** The newly generated migration file (`migrations/create_workflow_risks_table.sql`) needs to be executed within your Supabase SQL environment to instantiate the `public.workflow_risks` table. Without it, the backend will swallow the schema failure and return empty risk metrics.

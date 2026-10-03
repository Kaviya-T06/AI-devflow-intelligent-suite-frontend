# Implementation Analysis: Project Retention & Project History

1. **Existing tables that can be reused**: 
   `activity_logs` already captures all major user actions (`action`, `entity_type`, `entity_id`). By adding `project_id` and `metadata`, we can transform this into a robust Project History foundation without creating redundant tables.

2. **Existing APIs that can be reused**: 
   `activity_service.py` (`log_activity`) handles event generation. We will reuse it and expose a new endpoint `GET /api/v1/projects/{project_id}/history` in `projects.py`.

3. **Existing activity/risk/history mechanisms**: 
   The backend already triggers `log_activity` automatically for task assignments, completions, risk detections, and project updates. We will extend `log_activity` to automatically infer and attach the `project_id` based on `entity_id` and `entity_type`.

4. **Existing GitHub integration points**: 
   GitHub syncing in `githubService.ts` and `github.py` will remain untouched. `activity_logs` will just link relevant GitHub actions if they are explicitly passed.

5. **Existing AI Insights integration points**: 
   AI Insights can simply call the new history API endpoint or query `activity_logs` directly by `project_id` to get structured historical context for the LLM.

6. **Exact schema changes required**:
   - `ALTER TABLE activity_logs ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;`
   - `ALTER TABLE activity_logs ADD COLUMN metadata JSONB;`
   - `CREATE INDEX idx_activity_logs_project_id ON activity_logs(project_id);`

7. **Exact backend files to modify**:
   - `migrations/alter_activity_logs_for_history.sql` (new)
   - `app/schemas/common.py` (add `project_id` and `metadata` to `ActivityOut`)
   - `app/services/activity_service.py` (infer `project_id` automatically and include it in DB inserts)
   - `app/api/v1/endpoints/projects.py` (new GET history endpoint with RBAC)

8. **Exact frontend files to modify**:
   - `src/services/pmService.ts` (add `getProjectHistory` API client method)
   - `src/types/index.ts` (update `ActivityLog` interface)
   - `src/pages/dashboard/PMProjectsPage.tsx` or project details (add a History / Timeline tab)

9. **Potential conflicts and how they will be avoided**: 
   Updating the `activity_logs` signature could break existing event calls. This is avoided by modifying `log_activity` to automatically infer the `project_id` from existing `entity_id` relations (e.g. looking up a task's project). This ensures zero breaking changes to the existing `task_service` and `project_service`.

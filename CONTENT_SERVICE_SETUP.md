# Content production request setup

This feature is currently accessible only to server-verified administrators. It does not enable public customer access, send messages to third parties, or deduct credits. The operator quotation and customer approval paths can be exercised by the administrator on an administrator-owned test request.

## Supabase

Apply `supabase/migrations/20261006_content_test.sql` first and `supabase/migrations/20261006_content_service.sql` second in the BESTSNS project's SQL Editor. The first file creates the automatic production queue and private storage bucket. The second creates the separate operator-managed custom request table. Both use service-role-only access; no public storage policy is needed. Run them in one transaction when setting up a new project.

Confirm Netlify Functions has the existing server-side Supabase URL and service-role key. Never expose service-role keys as VITE variables. Do not turn on Pixeling bridge readiness unless a real worker is connected.

## Administrator workflow

1. Open the content page as an authenticated administrator and choose 제작 요청.
2. Submit name, contact, industry, company, requested output type, instructions, reference URLs, and original files. Inputs support 50 files, 500MB each, 5GB total.
3. Select the request and enter the operator's credit quotation and scope/delivery/revision terms.
4. Confirm the exact quotation as its owner. Older quote versions and approvals on another administrator's request are rejected. The accepted quotation cannot be edited after approval.
5. Start the operator-managed work, produce the requested assets separately, then upload 1–20 final files and deliver them. Only uploaded files with verified sizes can be completed.
6. Confirm preview and download links. Private original/result links expire after ten minutes; use 새로고침 to renew them.

Credits remain on hold. Approval records the agreed amount without debiting any balance. A production wallet, debit/refund policy, normal-customer access and notifications need separate implementation before public release. This custom request workflow is independent of Pixeling's automatic worker queue.

## Admin queue reception
Server-verified administrators can upload originals and submit queued test orders without a connected Pixeling worker. CONTENT_TEST_ENABLED=false explicitly disables reception; unset or true permits it. CONTENT_PIXELING_BRIDGE_READY does not control reception or prove a worker is running. No automatic generation occurs until a real worker claims and processes a queued job.

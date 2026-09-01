import type { FormSchema } from './types';
import fireRestoration from './examples/fire-restoration.json';
import customerIssue from './examples/customer-issue.json';

// In production these come from the server and land in the `schemas` table.
// Bundled here so the app is runnable on first launch with no backend.
export const JOB_SCHEMA = fireRestoration as FormSchema;
export const ISSUE_SCHEMA = customerIssue as FormSchema;

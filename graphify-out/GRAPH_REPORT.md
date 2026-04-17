# Graph Report - .  (2026-04-15)

## Corpus Check
- 107 files · ~98,505 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 551 nodes · 703 edges · 80 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.79)
- Token cost: 12,500 input · 4,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Feature API Layer|Core Feature API Layer]]
- [[_COMMUNITY_App Shell & Navigation|App Shell & Navigation]]
- [[_COMMUNITY_Financial Calculation Utilities|Financial Calculation Utilities]]
- [[_COMMUNITY_Domain Types & Tax Engine|Domain Types & Tax Engine]]
- [[_COMMUNITY_AI Review & Active Bugs|AI Review & Active Bugs]]
- [[_COMMUNITY_UI Components & Email Parsing|UI Components & Email Parsing]]
- [[_COMMUNITY_Navigation Config & AppShell|Navigation Config & AppShell]]
- [[_COMMUNITY_App Root & Layout|App Root & Layout]]
- [[_COMMUNITY_Auth & Import Flow|Auth & Import Flow]]
- [[_COMMUNITY_Feature Requirements & Data Models|Feature Requirements & Data Models]]
- [[_COMMUNITY_Account Management UI|Account Management UI]]
- [[_COMMUNITY_Transaction List & Modal|Transaction List & Modal]]
- [[_COMMUNITY_AI Chat Interface|AI Chat Interface]]
- [[_COMMUNITY_Loan Detail Management|Loan Detail Management]]
- [[_COMMUNITY_Dashboard & AI Insights|Dashboard & AI Insights]]
- [[_COMMUNITY_Loan Payment Calculator|Loan Payment Calculator]]
- [[_COMMUNITY_Data Migration Tools|Data Migration Tools]]
- [[_COMMUNITY_Savings Goal CRUD|Savings Goal CRUD]]
- [[_COMMUNITY_Card UI Primitives|Card UI Primitives]]
- [[_COMMUNITY_Skeleton Loading States|Skeleton Loading States]]
- [[_COMMUNITY_Offline Sync Pipeline|Offline Sync Pipeline]]
- [[_COMMUNITY_Service Worker Cache|Service Worker Cache]]
- [[_COMMUNITY_Error Boundary Component|Error Boundary Component]]
- [[_COMMUNITY_AI Review Visualization|AI Review Visualization]]
- [[_COMMUNITY_Toast Notifications|Toast Notifications]]
- [[_COMMUNITY_Net Worth Chart|Net Worth Chart]]
- [[_COMMUNITY_Transaction Modal Handlers|Transaction Modal Handlers]]
- [[_COMMUNITY_Email Parsing|Email Parsing]]
- [[_COMMUNITY_Timezone Utilities|Timezone Utilities]]
- [[_COMMUNITY_Offline Fetch Queue|Offline Fetch Queue]]
- [[_COMMUNITY_Supabase Browser Client|Supabase Browser Client]]
- [[_COMMUNITY_Paycheck & Employer Features|Paycheck & Employer Features]]
- [[_COMMUNITY_PWA Icons & Manifest|PWA Icons & Manifest]]
- [[_COMMUNITY_Next.js & Vercel Setup|Next.js & Vercel Setup]]
- [[_COMMUNITY_Auth Proxy Middleware|Auth Proxy Middleware]]
- [[_COMMUNITY_Root Redirect Page|Root Redirect Page]]
- [[_COMMUNITY_Login Page|Login Page]]
- [[_COMMUNITY_Form Field Component|Form Field Component]]
- [[_COMMUNITY_Offline Banner|Offline Banner]]
- [[_COMMUNITY_Month Navigation|Month Navigation]]
- [[_COMMUNITY_Info Tooltip|Info Tooltip]]
- [[_COMMUNITY_Status Badge|Status Badge]]
- [[_COMMUNITY_Keyboard Shortcuts|Keyboard Shortcuts]]
- [[_COMMUNITY_Help Modal|Help Modal]]
- [[_COMMUNITY_Button Component|Button Component]]
- [[_COMMUNITY_Modal Component|Modal Component]]
- [[_COMMUNITY_Service Worker Register|Service Worker Register]]
- [[_COMMUNITY_Login Form|Login Form]]
- [[_COMMUNITY_Offline Banner & Util|Offline Banner & Util]]
- [[_COMMUNITY_SW Registration|SW Registration]]
- [[_COMMUNITY_Employer & Paycheck Types|Employer & Paycheck Types]]
- [[_COMMUNITY_Next.js Env Types|Next.js Env Types]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_Supabase DB Types|Supabase DB Types]]
- [[_COMMUNITY_Page (isolated)|Page (isolated)]]
- [[_COMMUNITY_Page (isolated)|Page (isolated)]]
- [[_COMMUNITY_Page (isolated)|Page (isolated)]]
- [[_COMMUNITY_Page (isolated)|Page (isolated)]]
- [[_COMMUNITY_Markdown Content|Markdown Content]]
- [[_COMMUNITY_Confirm Dialog|Confirm Dialog]]
- [[_COMMUNITY_Empty State|Empty State]]
- [[_COMMUNITY_Page Header|Page Header]]
- [[_COMMUNITY_Category Pie Chart|Category Pie Chart]]
- [[_COMMUNITY_Month Comparison Chart|Month Comparison Chart]]
- [[_COMMUNITY_Types Module|Types Module]]
- [[_COMMUNITY_Next.js Env Types|Next.js Env Types]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Month Nav|Month Nav]]
- [[_COMMUNITY_Page Header Component|Page Header Component]]
- [[_COMMUNITY_Table Page Skeleton|Table Page Skeleton]]
- [[_COMMUNITY_Grid Page Skeleton|Grid Page Skeleton]]
- [[_COMMUNITY_Accounts Page Skeleton|Accounts Page Skeleton]]
- [[_COMMUNITY_Profile Type|Profile Type]]
- [[_COMMUNITY_RecurringRule Type|RecurringRule Type]]
- [[_COMMUNITY_Investment Type|Investment Type]]
- [[_COMMUNITY_SavingsGoal Type|SavingsGoal Type]]
- [[_COMMUNITY_Subscription Type|Subscription Type]]
- [[_COMMUNITY_PendingImport Type|PendingImport Type]]
- [[_COMMUNITY_Get Pending Count|Get Pending Count]]
- [[_COMMUNITY_Loan Details Page Feature|Loan Details Page Feature]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 19 edges
2. `AuthProvider Component` - 17 edges
3. `DB Table: transactions` - 16 edges
4. `DB Table: accounts` - 15 edges
5. `POST()` - 14 edges
6. `createClient()` - 14 edges
7. `DELETE()` - 13 edges
8. `DB Table: categories` - 13 edges
9. `AI Chat POST Handler` - 10 edges
10. `Database Types (database.ts)` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Feature Addendum: AI Review Page Data Fix (§6)` --semantically_similar_to--> `AI Review Page`  [INFERRED] [semantically similar]
  PRD/Feature Requirements Addendum.md → src/app/ai-review/page.tsx
- `PRD Build Phases (Phase 1–7)` --semantically_similar_to--> `FinanceOS TODO Sprint Tracker`  [INFERRED] [semantically similar]
  PRD/PRD.md → TODO.md
- `Dashboard Page (Server)` --shares_data_with--> `DashboardSummary Computed Type`  [INFERRED]
  src/app/dashboard/page.tsx → supabase/database.ts
- `OfflineBanner Component` --semantically_similar_to--> `Service Worker Background Sync`  [INFERRED] [semantically similar]
  src/app/layout.tsx → public/sw.js
- `Sprint 4/15 AI Review Redesign Tasks` --references--> `AI Review Page`  [INFERRED]
  TODO.md → src/app/ai-review/page.tsx

## Hyperedges (group relationships)
- **Server-Side Rendering Pattern with Supabase Auth Guard** — employers_page, transactions_page, dashboard_page, supabase_server_client [EXTRACTED 0.95]
- **Offline-First PWA Pattern** — sw_js, sw_register, offline_banner, sw_bg_sync, sw_indexeddb [EXTRACTED 0.95]
- **Loan Management Feature Cluster** — loans_page, loans_page_client, loan_detail_page, loan_amortization_logic, api_loans_payments [EXTRACTED 0.95]
- **AI Auto-Categorization Pipeline** — transactionsroute_TransactionsPOST, categorizeroute_CategorizePOST, anthropic_ClaudeHaiku [EXTRACTED 0.95]
- **Account Balance Sync Pattern** — transactionsroute_TransactionsPOST, transactionidroute_adjustAccountBalance, recalcbalancesroute_RecalcBalancesPOST [INFERRED 0.88]
- **AI Financial Insight Generation** — dashboardroute_DashboardGET, aireviewroute_AiReviewGET, aichatroute_AiChatPOST [INFERRED 0.90]
- **Daily Cron Jobs That Write Transactions** — cron_subscription_autopay, cron_generate_recurring, cron_promote_imports [INFERRED 0.90]
- **Protected Client Pages Using useAuth Hook** — app_import_page, app_recurring_page, app_investments_page [EXTRACTED 0.95]
- **Pages Sharing Card + EmptyState UI Pattern** — app_categories_client, app_recurring_page, app_investments_page [INFERRED 0.80]
- **Transaction AI Auto-Categorization Flow** — transaction_modal_TransactionModal, types_Category, types_Transaction [EXTRACTED 0.95]
- **Offline Sync Pipeline** — offline_offlineFetch, offline_queueRequest, offline_requestBackgroundSync [EXTRACTED 0.95]
- **AppShell Navigation Preference System** — app_shell_AppShell, app_shell_getNavPrefs, app_shell_ALL_NAV_ITEMS [EXTRACTED 0.92]
- **Agent Workflow: CLAUDE.md + MEMORY.md + TODO.md + BUGS.md form the persistent agent state machine** — claude_md_workflowProtocol, memory_md_sessionMemory, todo_md_sprintTracker, bugs_md_bugTracker [EXTRACTED 0.95]
- **Supabase Dual-Client Pattern: browser client, server client, and RLS enforce auth-scoped data access** — supabase_ts_createClient, claude_md_architectureRules, memory_md_gotchas [INFERRED 0.85]
- **AI Review Page Issues: feature addendum fix, BUGS.md tracking, and sprint 4/15 redesign tasks converge on the same component** — feature_addendum_aiReviewFix, bugs_md_bug005, todo_md_sprint415 [INFERRED 0.88]

## Communities

### Community 0 - "Core Feature API Layer"
Cohesion: 0.05
Nodes (74): Account Form Data Interface, Accounts Page Client Component, Accounts Server Page, AI Chat POST Handler, AI Review API GET Handler, Claude Haiku Model (claude-haiku-4-5-20251001), Claude Sonnet Model (claude-sonnet-4-6), AI Chat API Route (+66 more)

### Community 1 - "App Shell & Navigation"
Cohesion: 0.08
Nodes (25): getNavPrefs(), handleNavUpdate(), handleStorage(), AuthProvider Component, Alert(), calcEmployerMatch(), closeModal(), fetchGoals() (+17 more)

### Community 2 - "Financial Calculation Utilities"
Cohesion: 0.1
Nodes (9): adjustAccountBalance(), adjustLoanBalance(), advanceDate(), DELETE(), fmt(), GET(), PATCH(), POST() (+1 more)

### Community 3 - "Domain Types & Tax Engine"
Cohesion: 0.12
Nodes (32): AI Chat Page, API Route /api/loans/payments, California State Tax Brackets, Database Types (database.ts), Account DB Type, AiInsight DB Type, DashboardSummary Computed Type, Employer DB Type (+24 more)

### Community 4 - "AI Review & Active Bugs"
Cohesion: 0.08
Nodes (31): AI Review Page, AI Review API Route, BUG-001: categoryManuallySet ref never resets on modal reopen, BUG-002: Auto-categorise useEffect stale closure guard, BUG-003: InsightExpander Read More always rendered, BUG-004: MarkdownRenderer dangerouslySetInnerHTML XSS vector, BUG-005: AI Review budget month filter fails for week spanning two months, FinanceOS Bug Tracker (+23 more)

### Community 5 - "UI Components & Email Parsing"
Cohesion: 0.09
Nodes (30): Button Component, CategoryPieChart Component, BANK_PARSING_RULES, BankParsingRule Interface, ParsedTransaction Interface, parseEmailTransaction, InsightExpander Component, LoginForm Component (+22 more)

### Community 6 - "Navigation Config & AppShell"
Cohesion: 0.08
Nodes (17): ALL_NAV_ITEMS Navigation Config, AppShell Component, NavPref Interface, getNavPrefs Function, OverrideModal(), HelpModal Component, KeyboardShortcuts Component, Modal Component (+9 more)

### Community 7 - "App Root & Layout"
Cohesion: 0.09
Nodes (14): Root App Layout, AppShell Component, ErrorBoundary Component, Next.js Config, OfflineBanner Component, resetNavToDefaults(), saveNavPrefs(), Service Worker API Cache Strategy (+6 more)

### Community 8 - "Auth & Import Flow"
Cohesion: 0.17
Nodes (13): AuthProvider(), handleSubmit(), fetchData(), handleCsvUpload(), handleMarkSafe(), handleReject(), showToast(), getAccounts() (+5 more)

### Community 9 - "Feature Requirements & Data Models"
Cohesion: 0.12
Nodes (18): Feature Addendum: Inter-Account Transfer System (§1.1), Transfer Group Data Model (transfer_group_id, linked_transaction_id, is_internal_transfer), Finance Tracker Spreadsheet: Account Balances (02-ACCOUNTS), Finance Tracker Spreadsheet: Category Settings (00-SETTINGS), Finance Tracker Spreadsheet: Transaction History (03-TRANSACTIONS), PRD AI Features (Categorization, Anomaly Detection, Chat, Monthly Summary), PRD Automation Workflow (Bank → Email → n8n → Supabase), PRD Build Phases (Phase 1–7) (+10 more)

### Community 10 - "Account Management UI"
Cohesion: 0.18
Nodes (6): closeDeleteDialog(), closeModal(), handleDelete(), handleSubmit(), validateField(), validateForm()

### Community 11 - "Transaction List & Modal"
Cohesion: 0.17
Nodes (3): TransactionModal Component, buildParams(), exportToCsv()

### Community 12 - "AI Chat Interface"
Cohesion: 0.22
Nodes (5): handleKeyDown(), sendMessage(), MarkdownContent Component, handleKeyDown(), sendMessage()

### Community 13 - "Loan Detail Management"
Cohesion: 0.24
Nodes (4): closeModal(), handleDelete(), handleSave(), fetchEmployers()

### Community 14 - "Dashboard & AI Insights"
Cohesion: 0.24
Nodes (8): Anthropic SDK (claude-haiku AI), Root Redirect Page, CategoryPieChart Component, Dashboard Page (Server), InsightExpander Dashboard Component, MonthComparisonChart Component, NetWorthChart Component, pad()

### Community 15 - "Loan Payment Calculator"
Cohesion: 0.28
Nodes (3): monthsRemaining(), simulateExtraPayment(), totalInterestRemaining()

### Community 16 - "Data Migration Tools"
Cohesion: 0.29
Nodes (3): FinanceOS — Excel → Supabase Migration Script ==================================, Safely quote a string for SQL., sql_str()

### Community 17 - "Savings Goal CRUD"
Cohesion: 0.33
Nodes (2): closeModal(), handleSave()

### Community 18 - "Card UI Primitives"
Cohesion: 0.29
Nodes (0): 

### Community 19 - "Skeleton Loading States"
Cohesion: 0.29
Nodes (0): 

### Community 20 - "Offline Sync Pipeline"
Cohesion: 0.48
Nodes (5): getPendingCount(), offlineFetch(), openDB(), queueRequest(), requestBackgroundSync()

### Community 21 - "Service Worker Cache"
Cohesion: 0.47
Nodes (3): flushPendingQueue(), openDB(), storeGetAll()

### Community 22 - "Error Boundary Component"
Cohesion: 0.33
Nodes (1): ErrorBoundary

### Community 23 - "AI Review Visualization"
Cohesion: 0.4
Nodes (5): AI Review Page, Insight Cards Component, Monthly Area Chart Component, ReviewData Interface, Weekly Bar Chart Component

### Community 24 - "Toast Notifications"
Cohesion: 0.5
Nodes (0): 

### Community 25 - "Net Worth Chart"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "Transaction Modal Handlers"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Email Parsing"
Cohesion: 0.67
Nodes (0): 

### Community 28 - "Timezone Utilities"
Cohesion: 0.67
Nodes (3): DEFAULT_TIMEZONE Constant, formatDate Utility, getUserTimezone Utility

### Community 29 - "Offline Fetch Queue"
Cohesion: 0.67
Nodes (3): offlineFetch, queueRequest, requestBackgroundSync

### Community 30 - "Supabase Browser Client"
Cohesion: 0.67
Nodes (3): createBrowserClient (@supabase/ssr), Supabase Browser Client (createClient), Supabase Public Env Variables (URL + Publishable Key)

### Community 31 - "Paycheck & Employer Features"
Cohesion: 0.67
Nodes (3): Feature Addendum: Employer Default Account Mapping (§2.2), Feature Addendum: Paycheck Auto Transaction Creation (§2.1), Finance Tracker Spreadsheet: Paycheck History (01-PAYCHECKS)

### Community 32 - "PWA Icons & Manifest"
Cohesion: 0.67
Nodes (3): FinanceOS App Icon 192px (dark navy with green chart/arrow logo), FinanceOS App Icon 512px, PWA Installability Audit Task

### Community 33 - "Next.js & Vercel Setup"
Cohesion: 0.67
Nodes (3): Next.js Logo SVG (framework), Next.js Project README, Vercel Logo SVG (deployment platform)

### Community 34 - "Auth Proxy Middleware"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Root Redirect Page"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Login Page"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Form Field Component"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Offline Banner"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Month Navigation"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Info Tooltip"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Status Badge"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Keyboard Shortcuts"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Help Modal"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Button Component"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Modal Component"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Service Worker Register"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Login Form"
Cohesion: 1.0
Nodes (2): Login Page, Login Form Component

### Community 48 - "Offline Banner & Util"
Cohesion: 1.0
Nodes (2): Offline Banner Component, Offline Utility (getPendingCount)

### Community 49 - "SW Registration"
Cohesion: 1.0
Nodes (2): registerServiceWorker, ServiceWorkerRegister Component

### Community 50 - "Employer & Paycheck Types"
Cohesion: 1.0
Nodes (2): Employer Type, Paycheck Type

### Community 51 - "Next.js Env Types"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Supabase DB Types"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Page (isolated)"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Page (isolated)"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Page (isolated)"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Page (isolated)"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Markdown Content"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Confirm Dialog"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Empty State"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Page Header"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Category Pie Chart"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Month Comparison Chart"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Types Module"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Next.js Env Types"
Cohesion: 1.0
Nodes (1): Next.js Environment Types

### Community 66 - "Error Boundary"
Cohesion: 1.0
Nodes (1): Error Boundary Component

### Community 67 - "Month Nav"
Cohesion: 1.0
Nodes (1): Month Navigation Component

### Community 68 - "Page Header Component"
Cohesion: 1.0
Nodes (1): PageHeader Component

### Community 69 - "Table Page Skeleton"
Cohesion: 1.0
Nodes (1): TablePageSkeleton

### Community 70 - "Grid Page Skeleton"
Cohesion: 1.0
Nodes (1): GridPageSkeleton

### Community 71 - "Accounts Page Skeleton"
Cohesion: 1.0
Nodes (1): AccountsPageSkeleton

### Community 72 - "Profile Type"
Cohesion: 1.0
Nodes (1): Profile Type

### Community 73 - "RecurringRule Type"
Cohesion: 1.0
Nodes (1): RecurringRule Type

### Community 74 - "Investment Type"
Cohesion: 1.0
Nodes (1): Investment Type

### Community 75 - "SavingsGoal Type"
Cohesion: 1.0
Nodes (1): SavingsGoal Type

### Community 76 - "Subscription Type"
Cohesion: 1.0
Nodes (1): Subscription Type

### Community 77 - "PendingImport Type"
Cohesion: 1.0
Nodes (1): PendingImport Type

### Community 78 - "Get Pending Count"
Cohesion: 1.0
Nodes (1): getPendingCount

### Community 79 - "Loan Details Page Feature"
Cohesion: 1.0
Nodes (1): Feature Addendum: Loan Details Page /loans/[loan_id] (§4.1)

## Ambiguous Edges - Review These
- `useToast Hook` → `TransactionModal Component`  [AMBIGUOUS]
  src/components/transactions/transaction-modal.tsx · relation: semantically_similar_to

## Knowledge Gaps
- **106 isolated node(s):** `FinanceOS — Excel → Supabase Migration Script ==================================`, `Safely quote a string for SQL.`, `Next.js Environment Types`, `Next.js Config`, `Root Redirect Page` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Auth Proxy Middleware`** (2 nodes): `proxy()`, `proxy.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Redirect Page`** (2 nodes): `Home()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Page`** (2 nodes): `LoginPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Form Field Component`** (2 nodes): `FormSelect()`, `form-field.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Offline Banner`** (2 nodes): `OfflineBanner()`, `offline-banner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Month Navigation`** (2 nodes): `MonthNav()`, `month-nav.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Info Tooltip`** (2 nodes): `handleClick()`, `info-tooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Status Badge`** (2 nodes): `status-badge.tsx`, `StatusBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Keyboard Shortcuts`** (2 nodes): `KeyboardShortcuts()`, `keyboard-shortcuts.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Help Modal`** (2 nodes): `HelpModal()`, `help-modal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Button Component`** (2 nodes): `Button()`, `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Modal Component`** (2 nodes): `onKey()`, `modal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Service Worker Register`** (2 nodes): `sw-register.tsx`, `ServiceWorkerRegister()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Form`** (2 nodes): `Login Page`, `Login Form Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Offline Banner & Util`** (2 nodes): `Offline Banner Component`, `Offline Utility (getPendingCount)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SW Registration`** (2 nodes): `registerServiceWorker`, `ServiceWorkerRegister Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Employer & Paycheck Types`** (2 nodes): `Employer Type`, `Paycheck Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Env Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase DB Types`** (1 nodes): `database.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page (isolated)`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page (isolated)`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page (isolated)`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page (isolated)`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Markdown Content`** (1 nodes): `markdown-content.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Confirm Dialog`** (1 nodes): `confirm-dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Empty State`** (1 nodes): `empty-state.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Header`** (1 nodes): `page-header.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Category Pie Chart`** (1 nodes): `category-pie-chart.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Month Comparison Chart`** (1 nodes): `month-comparison-chart.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Types Module`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Env Types`** (1 nodes): `Next.js Environment Types`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Error Boundary`** (1 nodes): `Error Boundary Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Month Nav`** (1 nodes): `Month Navigation Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Page Header Component`** (1 nodes): `PageHeader Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Table Page Skeleton`** (1 nodes): `TablePageSkeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Grid Page Skeleton`** (1 nodes): `GridPageSkeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accounts Page Skeleton`** (1 nodes): `AccountsPageSkeleton`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Type`** (1 nodes): `Profile Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `RecurringRule Type`** (1 nodes): `RecurringRule Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Investment Type`** (1 nodes): `Investment Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SavingsGoal Type`** (1 nodes): `SavingsGoal Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Subscription Type`** (1 nodes): `Subscription Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PendingImport Type`** (1 nodes): `PendingImport Type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Get Pending Count`** (1 nodes): `getPendingCount`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loan Details Page Feature`** (1 nodes): `Feature Addendum: Loan Details Page /loans/[loan_id] (§4.1)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `useToast Hook` and `TransactionModal Component`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `AuthProvider Component` connect `App Shell & Navigation` to `Navigation Config & AppShell`, `App Root & Layout`, `Auth & Import Flow`, `Transaction List & Modal`, `AI Chat Interface`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `GET()` (e.g. with `createServerSupabaseClient()` and `pad()`) actually correct?**
  _`GET()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `DB Table: accounts` (e.g. with `Net Worth Snapshot Cron Job` and `Investments Page`) actually correct?**
  _`DB Table: accounts` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `POST()` (e.g. with `createServerSupabaseClient()` and `DELETE()`) actually correct?**
  _`POST()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `FinanceOS — Excel → Supabase Migration Script ==================================`, `Safely quote a string for SQL.`, `Next.js Environment Types` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core Feature API Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._